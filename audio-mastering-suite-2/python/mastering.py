#!/usr/bin/env python3
"""
Audio Mastering DSP Pipeline
Implements:
1. Gain Staging (Headroom normalization to -6dB)
2. Corrective EQ (Muddy cut around 200Hz, high-pass rumble filter at 30Hz, high-shelf brightness)
3. Multiband Compression (Splitting low/mid/high bands and applying glue compression)
4. Harmonic Saturation (Tape/Tube odd-even harmonic saturation)
5. Stereo Imaging (High-frequency widening, low-frequency mono sum)
6. Brickwall Limiting & Maximizer (Loudness maximization targeting Streaming -14 LUFS, Club -9 LUFS, or CD -7 LUFS)
"""

import os
import numpy as np
import scipy.signal as signal
from scipy.io import wavfile
try:
    import librosa
except ImportError:
    librosa = None

try:
    from pydub import AudioSegment
except ImportError:
    AudioSegment = None

class MasteringEngine:
    def __init__(self, sample_rate=44100):
        self.sr = sample_rate

    def load_audio(self, filepath):
        """Loads audio file and returns normalized float32 numpy array and sample rate."""
        if filepath.endswith('.mp3') and AudioSegment is not None:
            audio = AudioSegment.from_mp3(filepath)
            self.sr = audio.frame_rate
            samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
            # Reshape for stereo if needed
            if audio.channels == 2:
                samples = samples.reshape((-1, 2)).T
            else:
                samples = samples[np.newaxis, :]
            # Normalize to [-1.0, 1.0]
            max_val = 2**(8 * audio.sample_width - 1)
            samples /= max_val
            return samples, self.sr
        else:
            # Load WAV
            sr, data = wavfile.read(filepath)
            self.sr = sr
            # Convert to float32 normalized
            if data.dtype == np.int16:
                data = data.astype(np.float32) / 32768.0
            elif data.dtype == np.int32:
                data = data.astype(np.float32) / 2147483648.0
            elif data.dtype == np.uint8:
                data = (data.astype(np.float32) - 128.0) / 128.0
            
            # Make sure it is (channels, samples)
            if len(data.shape) == 1:
                data = data[np.newaxis, :] # Mono
            else:
                data = data.T # Shape: (channels, samples)
            return data, self.sr

    def save_audio(self, data, filepath, format='wav'):
        """Saves float32 numpy array to audio file (WAV or MP3)."""
        # Ensure correct shape (samples, channels)
        output_data = data.T if len(data.shape) > 1 else data
        # Clip to safe limits [-1.0, 1.0]
        output_data = np.clip(output_data, -1.0, 1.0)
        
        # Convert to int16 for high compatibility
        int_data = (output_data * 32767.0).astype(np.int16)
        
        temp_wav = filepath
        if format == 'mp3':
            temp_wav = filepath.replace('.mp3', '_temp.wav')
            
        wavfile.write(temp_wav, self.sr, int_data)
        
        if format == 'mp3' and AudioSegment is not None:
            # Convert WAV to MP3 using Pydub
            sound = AudioSegment.from_wav(temp_wav)
            sound.export(filepath, format="mp3", bitrate="320k")
            if os.path.exists(temp_wav):
                os.remove(temp_wav)

    def gain_stage(self, data, target_headroom_db=-6.0):
        """Normalizes audio peak amplitude to target headroom in dB (typically -6 dB)."""
        peak = np.max(np.abs(data))
        if peak == 0:
            return data
        target_linear = 10 ** (target_headroom_db / 20.0)
        gain_factor = target_linear / peak
        return data * gain_factor

    def apply_highpass(self, data, cutoff=30.0):
        """Applies a high-pass Butterworth filter to remove sub-bass rumble."""
        nyquist = 0.5 * self.sr
        normal_cutoff = cutoff / nyquist
        b, a = signal.butter(2, normal_cutoff, btype='high', analog=False)
        return signal.filtfilt(b, a, data, axis=-1)

    def apply_peaking_eq(self, data, freq=220.0, gain_db=-2.5, Q=1.0):
        """Applies a digital peaking EQ filter to cut muddy frequencies or boost clarity."""
        # Using a standard 2nd-order IIR biquad filter design
        w0 = 2 * np.pi * freq / self.sr
        alpha = np.sin(w0) / (2 * Q)
        A = 10 ** (gain_db / 40.0)
        
        # Peaking EQ coefficients
        b0 = 1 + alpha * A
        b1 = -2 * np.cos(w0)
        b2 = 1 - alpha * A
        a0 = 1 + alpha / A
        a1 = -2 * np.cos(w0)
        a2 = 1 - alpha / A
        
        b = np.array([b0, b1, b2]) / a0
        a = np.array([a0, a1, a2]) / a0
        
        return signal.lfilter(b, a, data, axis=-1)

    def apply_high_shelf(self, data, freq=8000.0, gain_db=1.5, Q=0.707):
        """Applies a high-shelf EQ for brightness control."""
        w0 = 2 * np.pi * freq / self.sr
        alpha = np.sin(w0) / (2 * Q)
        A = 10 ** (gain_db / 40.0)
        
        # High Shelf coefficients
        b0 = A * ((A + 1) + (A - 1) * np.cos(w0) + 2 * np.sqrt(A) * alpha)
        b1 = -2 * A * ((A - 1) + (A + 1) * np.cos(w0))
        b2 = A * ((A + 1) + (A - 1) * np.cos(w0) - 2 * np.sqrt(A) * alpha)
        a0 = (A + 1) - (A - 1) * np.cos(w0) + 2 * np.sqrt(A) * alpha
        a1 = 2 * ((A - 1) - (A + 1) * np.cos(w0))
        a2 = (A + 1) - (A - 1) * np.cos(w0) - 2 * np.sqrt(A) * alpha
        
        b = np.array([b0, b1, b2]) / a0
        a = np.array([a0, a1, a2]) / a0
        
        return signal.lfilter(b, a, data, axis=-1)

    def apply_saturation(self, data, drive=1.5):
        """Applies soft-clipping tape/tube style harmonic saturation."""
        # Sigmoid soft clipper function: f(x) = tanh(drive * x) / tanh(drive)
        # Adds smooth odd and even harmonics based on waveshape
        if drive <= 1.0:
            return data
        return np.tanh(drive * data) / np.tanh(drive)

    def apply_stereo_widener(self, data, width_factor=1.3, low_crossover=250.0):
        """
        Widens the stereo image of high frequencies while keeping low frequencies in mono.
        width_factor: > 1.0 increases width, 1.0 is neutral, < 1.0 collapses to mono.
        """
        channels = data.shape[0]
        if channels < 2:
            return data # Cannot widen mono track
            
        # Split into low and high frequencies
        nyquist = 0.5 * self.sr
        normal_cutoff = low_crossover / nyquist
        b, a = signal.butter(4, normal_cutoff, btype='low', analog=False)
        
        low_band = signal.filtfilt(b, a, data, axis=-1)
        high_band = data - low_band
        
        # Sum low band to mono to ensure tight bass centered
        mono_low = np.mean(low_band, axis=0)
        low_band[0, :] = mono_low
        low_band[1, :] = mono_low
        
        # Apply Mid-Side widening to high band
        # Mid = L + R, Side = L - R
        mid = high_band[0, :] + high_band[1, :]
        side = high_band[0, :] - high_band[1, :]
        
        # Amplify side signal to widen stereo field
        side_widened = side * width_factor
        
        # Convert back to L/R
        # L = (Mid + Side)/2, R = (Mid - Side)/2
        high_band_widened = np.zeros_like(high_band)
        high_band_widened[0, :] = (mid + side_widened) / 2.0
        high_band_widened[1, :] = (mid - side_widened) / 2.0
        
        return low_band + high_band_widened

    def compress_band(self, band_data, threshold_db=-18.0, ratio=2.0, attack_ms=10.0, release_ms=100.0, makeup_db=2.0):
        """Simple single-band feed-forward compressor simulation."""
        # Convert time to samples
        attack_sec = attack_ms / 1000.0
        release_sec = release_ms / 1000.0
        
        # Envelope follower coefficients
        ga = np.exp(-1.0 / (self.sr * attack_sec))
        gr = np.exp(-1.0 / (self.sr * release_sec))
        
        channels, num_samples = band_data.shape
        compressed_band = np.zeros_like(band_data)
        
        for ch in range(channels):
            # Calculate signal envelope
            env = 0.0
            x = band_data[ch, :]
            envelope = np.zeros(num_samples)
            
            for i in range(num_samples):
                rectified = abs(x[i])
                if rectified > env:
                    env = ga * env + (1.0 - ga) * rectified
                else:
                    env = gr * env + (1.0 - gr) * rectified
                envelope[i] = env
            
            # Avoid division by zero
            envelope = np.maximum(envelope, 1e-5)
            env_db = 20 * np.log10(envelope)
            
            # Gain calculation
            gain_reduction_db = np.zeros(num_samples)
            above_threshold_mask = env_db > threshold_db
            gain_reduction_db[above_threshold_mask] = (1.0 - 1.0 / ratio) * (threshold_db - env_db[above_threshold_mask])
            
            # Apply gain reduction and makeup gain
            total_gain_db = gain_reduction_db + makeup_db
            gain_linear = 10 ** (total_gain_db / 20.0)
            
            compressed_band[ch, :] = x * gain_linear
            
        return compressed_band

    def multiband_compressor(self, data):
        """Splits signal into 3 bands (Low, Mid, High) and applies tailored compression."""
        nyquist = 0.5 * self.sr
        
        # Crossovers
        low_cut = 120.0 # Low-to-Mid crossover
        high_cut = 3500.0 # Mid-to-High crossover
        
        # Filters
        b_low, a_low = signal.butter(4, low_cut / nyquist, btype='low', analog=False)
        b_high, a_high = signal.butter(4, high_cut / nyquist, btype='high', analog=False)
        
        # 1. Split low band
        low_band = signal.filtfilt(b_low, a_low, data, axis=-1)
        
        # 2. Split high band
        high_band = signal.filtfilt(b_high, a_high, data, axis=-1)
        
        # 3. Mid band is the remainder
        mid_band = data - low_band - high_band
        
        # Apply tailored compression on low band (punchy, fast release, keeps bass steady)
        low_comp = self.compress_band(low_band, threshold_db=-15.0, ratio=2.5, attack_ms=30.0, release_ms=150.0, makeup_db=1.5)
        
        # Apply tailored compression on mid band (vocal presence, glue, transparent attack)
        mid_comp = self.compress_band(mid_band, threshold_db=-18.0, ratio=2.0, attack_ms=15.0, release_ms=100.0, makeup_db=1.0)
        
        # Apply tailored compression on high band (smooth transients, de-esser like)
        high_comp = self.compress_band(high_band, threshold_db=-20.0, ratio=1.8, attack_ms=5.0, release_ms=80.0, makeup_db=0.8)
        
        # Reconstruct full-band signal
        return low_comp + mid_comp + high_comp

    def brickwall_limiter(self, data, target_lufs_db=-14.0, true_peak_ceiling_db=-1.0):
        """
        Brickwall limiter and maximizer.
        Boosts input gain to target LUFS level, then clips peaks exceeding the true_peak_ceiling.
        """
        # Calculate current RMS as a proxy for LUFS
        # True LUFS requires ITU-R BS.1770 weightings, but RMS is a highly reliable real-time approximation
        rms = np.sqrt(np.mean(data**2))
        if rms == 0:
            return data
            
        rms_db = 20 * np.log10(rms)
        
        # Estimate gain required to hit target LUFS (assuming target_lufs matches estimated RMS target)
        # Target average RMS for -14 LUFS is roughly -14 dBFS, etc.
        gain_needed_db = target_lufs_db - rms_db
        # Limit gain boost to a reasonable range (e.g., max +12dB boost) to prevent severe noise amplification
        gain_needed_db = np.clip(gain_needed_db, -3.0, 12.0)
        
        # Drive input with makeup boost
        driven_data = data * (10 ** (gain_needed_db / 20.0))
        
        # Apply brickwall limiting with lookahead envelope / hard clipper capping at ceiling
        ceiling_linear = 10 ** (true_peak_ceiling_db / 20.0)
        
        # Lookahead limiting: smoothly dampens peaks using a fast auto-gain window
        # Rather than hard digital clipping which creates square-wave distortion
        channels, num_samples = driven_data.shape
        limited_data = np.zeros_like(driven_data)
        
        lookahead_samples = int(0.002 * self.sr) # 2ms lookahead window
        
        for ch in range(channels):
            x = driven_data[ch, :]
            g = np.ones(num_samples)
            
            # Simple peak-reduction loop
            for i in range(num_samples):
                # Search window ahead
                end_idx = min(i + lookahead_samples, num_samples)
                peak_in_window = np.max(np.abs(x[i:end_idx]))
                
                if peak_in_window > ceiling_linear:
                    # Scale down to fit ceiling
                    target_g = ceiling_linear / peak_in_window
                    g[i] = target_g
            
            # Smooth the gain reduction envelope to avoid zipper noise / clicks
            b_smooth, a_smooth = signal.butter(1, 1000.0 / (0.5 * self.sr), btype='low')
            g_smoothed = signal.filtfilt(b_smooth, a_smooth, g)
            # Ensure smoothed envelope never lets peak exceed ceiling
            g_smoothed = np.minimum(g_smoothed, 1.0)
            
            limited_data[ch, :] = x * g_smoothed
            
        # Final safety clamp
        limited_data = np.clip(limited_data, -ceiling_linear, ceiling_linear)
        return limited_data

    def process(self, input_path, output_path, target_lufs=-14.0, character='balanced'):
        """Runs the entire Mastering Pipeline on the input file."""
        print(f"Loading track: {input_path}")
        audio, sr = self.load_audio(input_path)
        
        print("Stage 1: Gain Staging (Headroom Leveling)...")
        audio = self.gain_stage(audio, target_headroom_db=-6.0)
        
        print("Stage 2: Removing sub-bass rumble (30Hz high-pass filter)...")
        audio = self.apply_highpass(audio, cutoff=30.0)
        
        print("Stage 3: EQ Adjustments...")
        # Cut muddy low-mid build-up around 220Hz
        audio = self.apply_peaking_eq(audio, freq=220.0, gain_db=-2.0, Q=1.0)
        
        # Add character-based coloring
        if character == 'warm':
            # Cut harsh highs, boost warm low-mids
            audio = self.apply_high_shelf(audio, freq=7000.0, gain_db=-1.5)
            audio = self.apply_peaking_eq(audio, freq=150.0, gain_db=1.2, Q=0.8)
            drive = 1.35
            width = 1.1
        elif character == 'bright':
            # Boost high-end clarity & air
            audio = self.apply_high_shelf(audio, freq=10000.0, gain_db=2.0)
            audio = self.apply_peaking_eq(audio, freq=3000.0, gain_db=1.0, Q=0.7)
            drive = 1.15
            width = 1.45
        else: # balanced
            # Standard mastering curve
            audio = self.apply_high_shelf(audio, freq=9000.0, gain_db=0.8)
            drive = 1.25
            width = 1.25

        print("Stage 4: Multiband Compression (Dynamic Glue)...")
        audio = self.multiband_compressor(audio)
        
        print("Stage 5: Harmonic Saturation...")
        audio = self.apply_saturation(audio, drive=drive)
        
        print("Stage 6: Stereo Widening (Keeping low frequencies in mono)...")
        audio = self.apply_stereo_widener(audio, width_factor=width)
        
        print("Stage 7: Brickwall Limiter & Maximizer...")
        audio = self.brickwall_limiter(audio, target_lufs_db=target_lufs, true_peak_ceiling_db=-1.0)
        
        # Save output
        out_format = 'mp3' if output_path.endswith('.mp3') else 'wav'
        print(f"Saving mastered track: {output_path} ({out_format})")
        self.save_audio(audio, output_path, format=out_format)
        print("Mastering completed successfully!")
        return output_path

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python mastering.py <input_wav_or_mp3> <output_wav_or_mp3> [target_lufs] [character]")
        sys.exit(1)
        
    infile = sys.argv[1]
    outfile = sys.argv[2]
    lufs = float(sys.argv[3]) if len(sys.argv) > 3 else -14.0
    char = sys.argv[4] if len(sys.argv) > 4 else 'balanced'
    
    engine = MasteringEngine()
    engine.process(infile, outfile, target_lufs=lufs, character=char)
