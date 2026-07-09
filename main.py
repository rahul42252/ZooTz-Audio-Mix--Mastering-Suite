#!/usr/bin/env python3
"""
FastAPI Cloud Mixing & Mastering Suite
Single-file self-contained backend for instant deployment on Render.com
"""

import os
import uuid
import shutil
import numpy as np
import scipy.signal as signal
from scipy.io import wavfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment

# Initialize FastAPI App
app = FastAPI(
    title="Cloud Audio Mastering API",
    description="Automated Digital Signal Processing (DSP) Mixing and Mastering Server",
    version="1.0.0"
)

# Explicit CORS configuration for secure Vercel frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with specific Vercel URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories for temporary audio storage
STORAGE_DIR = os.path.join(os.getcwd(), "temp_storage")
os.makedirs(STORAGE_DIR, exist_ok=True)


class MasteringEngine:
    """
    Self-contained Digital Signal Processing (DSP) mastering engine.
    Implements a 7-stage mastering chain.
    """
    def __init__(self, sample_rate=44100):
        self.sr = sample_rate

    def load_audio(self, filepath):
        """Loads WAV or MP3 audio file and returns a normalized float32 numpy array."""
        if filepath.endswith('.mp3'):
            audio = AudioSegment.from_mp3(filepath)
            self.sr = audio.frame_rate
            samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
            if audio.channels == 2:
                samples = samples.reshape((-1, 2)).T
            else:
                samples = samples[np.newaxis, :]
            max_val = 2**(8 * audio.sample_width - 1)
            samples /= max_val
            return samples, self.sr
        else:
            sr, data = wavfile.read(filepath)
            self.sr = sr
            if data.dtype == np.int16:
                data = data.astype(np.float32) / 32768.0
            elif data.dtype == np.int32:
                data = data.astype(np.float32) / 2147483648.0
            elif data.dtype == np.uint8:
                data = (data.astype(np.float32) - 128.0) / 128.0
            
            if len(data.shape) == 1:
                data = data[np.newaxis, :]
            else:
                data = data.T
            return data, self.sr

    def save_audio(self, data, filepath, format='wav'):
        """Saves float32 numpy array to disk as high-quality WAV or 320kbps MP3."""
        output_data = data.T if len(data.shape) > 1 else data
        output_data = np.clip(output_data, -1.0, 1.0)
        int_data = (output_data * 32767.0).astype(np.int16)
        
        temp_wav = filepath
        if format == 'mp3':
            temp_wav = filepath.replace('.mp3', '_temp.wav')
            
        wavfile.write(temp_wav, self.sr, int_data)
        
        if format == 'mp3':
            sound = AudioSegment.from_wav(temp_wav)
            sound.export(filepath, format="mp3", bitrate="320k")
            if os.path.exists(temp_wav):
                os.remove(temp_wav)

    def gain_stage(self, data, target_headroom_db=-6.0):
        """Standardizes input levels to a safe -6dB peak headroom."""
        peak = np.max(np.abs(data))
        if peak == 0:
            return data
        target_linear = 10 ** (target_headroom_db / 20.0)
        return data * (target_linear / peak)

    def apply_highpass(self, data, cutoff=30.0):
        """Removes low-end muddy sub-bass rumble below 30Hz."""
        nyquist = 0.5 * self.sr
        normal_cutoff = cutoff / nyquist
        b, a = signal.butter(2, normal_cutoff, btype='high', analog=False)
        return signal.filtfilt(b, a, data, axis=-1)

    def apply_peaking_eq(self, data, freq=220.0, gain_db=-2.0, Q=1.0):
        """Cuts or boosts specific frequencies using a 2nd-order biquad peaking filter."""
        w0 = 2 * np.pi * freq / self.sr
        alpha = np.sin(w0) / (2 * Q)
        A = 10 ** (gain_db / 40.0)
        
        b0 = 1 + alpha * A
        b1 = -2 * np.cos(w0)
        b2 = 1 - alpha * A
        a0 = 1 + alpha / A
        a1 = -2 * np.cos(w0)
        a2 = 1 - alpha / A
        
        b = np.array([b0, b1, b2]) / a0
        a = np.array([a0, a1, a2]) / a0
        return signal.lfilter(b, a, data, axis=-1)

    def apply_high_shelf(self, data, freq=8000.0, gain_db=1.0, Q=0.707):
        """Shapes the high-end air and treble brightness."""
        w0 = 2 * np.pi * freq / self.sr
        alpha = np.sin(w0) / (2 * Q)
        A = 10 ** (gain_db / 40.0)
        
        b0 = A * ((A + 1) + (A - 1) * np.cos(w0) + 2 * np.sqrt(A) * alpha)
        b1 = -2 * A * ((A - 1) + (A + 1) * np.cos(w0))
        b2 = A * ((A + 1) + (A - 1) * np.cos(w0) - 2 * np.sqrt(A) * alpha)
        a0 = (A + 1) - (A - 1) * np.cos(w0) + 2 * np.sqrt(A) * alpha
        a1 = 2 * ((A - 1) - (A + 1) * np.cos(w0))
        a2 = (A + 1) - (A - 1) * np.cos(w0) - 2 * np.sqrt(A) * alpha
        
        b = np.array([b0, b1, b2]) / a0
        a = np.array([a0, a1, a2]) / a0
        return signal.lfilter(b, a, data, axis=-1)

    def apply_saturation(self, data, drive=1.25):
        """Soft-clipping tape style harmonic saturator."""
        if drive <= 1.0:
            return data
        return np.tanh(drive * data) / np.tanh(drive)

    def apply_stereo_widener(self, data, width_factor=1.25, low_crossover=250.0):
        """Widens side channels above 250Hz while keeping lower sub-bass strictly in mono."""
        channels = data.shape[0]
        if channels < 2:
            return data
            
        nyquist = 0.5 * self.sr
        normal_cutoff = low_crossover / nyquist
        b, a = signal.butter(4, normal_cutoff, btype='low', analog=False)
        
        low_band = signal.filtfilt(b, a, data, axis=-1)
        high_band = data - low_band
        
        # Sum bass to mono
        mono_low = np.mean(low_band, axis=0)
        low_band[0, :] = mono_low
        low_band[1, :] = mono_low
        
        # Mid/Side stereo widening on highs
        mid = high_band[0, :] + high_band[1, :]
        side = high_band[0, :] - high_band[1, :]
        side_widened = side * width_factor
        
        high_band_widened = np.zeros_like(high_band)
        high_band_widened[0, :] = (mid + side_widened) / 2.0
        high_band_widened[1, :] = (mid - side_widened) / 2.0
        
        return low_band + high_band_widened

    def compress_band(self, band_data, threshold_db=-18.0, ratio=2.0, attack_ms=10.0, release_ms=100.0, makeup_db=1.5):
        """Feed-forward dynamic range compressor simulation for a frequency band."""
        attack_sec = attack_ms / 1000.0
        release_sec = release_ms / 1000.0
        ga = np.exp(-1.0 / (self.sr * attack_sec))
        gr = np.exp(-1.0 / (self.sr * release_sec))
        
        channels, num_samples = band_data.shape
        compressed_band = np.zeros_like(band_data)
        
        for ch in range(channels):
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
            
            envelope = np.maximum(envelope, 1e-5)
            env_db = 20 * np.log10(envelope)
            
            gain_reduction_db = np.zeros(num_samples)
            above_threshold_mask = env_db > threshold_db
            gain_reduction_db[above_threshold_mask] = (1.0 - 1.0 / ratio) * (threshold_db - env_db[above_threshold_mask])
            
            total_gain_db = gain_reduction_db + makeup_db
            gain_linear = 10 ** (total_gain_db / 20.0)
            compressed_band[ch, :] = x * gain_linear
            
        return compressed_band

    def multiband_compressor(self, data):
        """Splits audio into 3 frequency bands and applies custom dynamic gluing."""
        nyquist = 0.5 * self.sr
        low_cut = 120.0
        high_cut = 3500.0
        
        b_low, a_low = signal.butter(4, low_cut / nyquist, btype='low', analog=False)
        b_high, a_high = signal.butter(4, high_cut / nyquist, btype='high', analog=False)
        
        low_band = signal.filtfilt(b_low, a_low, data, axis=-1)
        high_band = signal.filtfilt(b_high, a_high, data, axis=-1)
        mid_band = data - low_band - high_band
        
        low_comp = self.compress_band(low_band, threshold_db=-15.0, ratio=2.5, attack_ms=30.0, release_ms=150.0, makeup_db=1.5)
        mid_comp = self.compress_band(mid_band, threshold_db=-18.0, ratio=2.0, attack_ms=15.0, release_ms=100.0, makeup_db=1.0)
        high_comp = self.compress_band(high_band, threshold_db=-20.0, ratio=1.8, attack_ms=5.0, release_ms=80.0, makeup_db=0.8)
        
        return low_comp + mid_comp + high_comp

    def brickwall_limiter(self, data, target_lufs_db=-14.0, true_peak_ceiling_db=-1.0):
        """Loudness maximizer and lookahead peak limiter."""
        rms = np.sqrt(np.mean(data**2))
        if rms == 0:
            return data
            
        rms_db = 20 * np.log10(rms)
        gain_needed_db = target_lufs_db - rms_db
        gain_needed_db = np.clip(gain_needed_db, -3.0, 12.0)
        
        driven_data = data * (10 ** (gain_needed_db / 20.0))
        ceiling_linear = 10 ** (true_peak_ceiling_db / 20.0)
        
        channels, num_samples = driven_data.shape
        limited_data = np.zeros_like(driven_data)
        lookahead_samples = int(0.002 * self.sr)
        
        for ch in range(channels):
            x = driven_data[ch, :]
            g = np.ones(num_samples)
            
            for i in range(num_samples):
                end_idx = min(i + lookahead_samples, num_samples)
                peak_in_window = np.max(np.abs(x[i:end_idx]))
                if peak_in_window > ceiling_linear:
                    g[i] = ceiling_linear / peak_in_window
            
            b_smooth, a_smooth = signal.butter(1, 1000.0 / (0.5 * self.sr), btype='low')
            g_smoothed = signal.filtfilt(b_smooth, a_smooth, g)
            g_smoothed = np.minimum(g_smoothed, 1.0)
            limited_data[ch, :] = x * g_smoothed
            
        return np.clip(limited_data, -ceiling_linear, ceiling_linear)

    def process(self, input_path, output_path, target_lufs=-14.0, character='balanced'):
        """Executes the complete processing suite."""
        audio, sr = self.load_audio(input_path)
        audio = self.gain_stage(audio, target_headroom_db=-6.0)
        audio = self.apply_highpass(audio, cutoff=30.0)
        audio = self.apply_peaking_eq(audio, freq=220.0, gain_db=-2.0, Q=1.0)
        
        if character == 'warm':
            audio = self.apply_high_shelf(audio, freq=7000.0, gain_db=-1.5)
            audio = self.apply_peaking_eq(audio, freq=150.0, gain_db=1.2, Q=0.8)
            drive = 1.35
            width = 1.1
        elif character == 'bright':
            audio = self.apply_high_shelf(audio, freq=10000.0, gain_db=2.0)
            audio = self.apply_peaking_eq(audio, freq=3000.0, gain_db=1.0, Q=0.7)
            drive = 1.15
            width = 1.45
        else: # balanced
            audio = self.apply_high_shelf(audio, freq=9000.0, gain_db=0.8)
            drive = 1.25
            width = 1.25

        audio = self.multiband_compressor(audio)
        audio = self.apply_saturation(audio, drive=drive)
        audio = self.apply_stereo_widener(audio, width_factor=width)
        audio = self.brickwall_limiter(audio, target_lufs_db=target_lufs, true_peak_ceiling_db=-1.0)
        
        out_format = 'mp3' if output_path.endswith('.mp3') else 'wav'
        self.save_audio(audio, output_path, format=out_format)
        return output_path


@app.post("/process")
async def process_audio(
    file: UploadFile = File(...),
    target_lufs: float = Form(-14.0),
    character: str = Form("balanced")
):
    """
    On-the-fly audio processing endpoint.
    Uploads, masters, and exposes download references.
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".wav", ".mp3"]:
        raise HTTPException(status_code=400, detail="Only WAV and MP3 files are supported.")
    
    # Generate unique session identifier
    session_id = str(uuid.uuid4())
    input_filename = f"input_{session_id}{ext}"
    input_path = os.path.join(STORAGE_DIR, input_filename)
    
    # Save uploaded unmixed file
    try:
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write input file: {str(e)}")
        
    try:
        engine = MasteringEngine()
        wav_out_path = os.path.join(STORAGE_DIR, f"mastered_{session_id}.wav")
        mp3_out_path = os.path.join(STORAGE_DIR, f"mastered_{session_id}.mp3")
        
        # Process and generate mastered WAV
        engine.process(input_path, wav_out_path, target_lufs=target_lufs, character=character)
        
        # Save high-quality MP3 format too
        engine.save_audio(engine.load_audio(wav_out_path)[0], mp3_out_path, format='mp3')
        
    except Exception as e:
        # Cleanup input file on failure
        if os.path.exists(input_path):
            os.remove(input_path)
        raise HTTPException(status_code=500, detail=f"DSP engine processing failed: {str(e)}")
        
    # Clean up input file after successful processing to save space
    if os.path.exists(input_path):
        os.remove(input_path)
        
    return {
        "status": "success",
        "message": "Track successfully mastered with pristine DSP processing.",
        "session_id": session_id,
        "wav_url": f"/download/{session_id}/wav",
        "mp3_url": f"/download/{session_id}/mp3"
    }


@app.get("/download/{session_id}/{audio_format}")
def download_mastered_file(session_id: str, audio_format: str):
    """Retrieves the processed, high-quality mastered file."""
    audio_format = audio_format.lower()
    if audio_format not in ["wav", "mp3"]:
        raise HTTPException(status_code=400, detail="Invalid audio format. Use 'wav' or 'mp3'.")
        
    filename = f"mastered_{session_id}.{audio_format}"
    file_path = os.path.join(STORAGE_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Mastered file not found or expired on server.")
        
    media_types = {
        "wav": "audio/wav",
        "mp3": "audio/mpeg"
    }
    
    return FileResponse(
        path=file_path,
        media_type=media_types[audio_format],
        filename=filename
    )


@app.get("/health")
def health_check():
    """Service health state check."""
    return {"status": "healthy", "service": "Cloud Audio Mastering API"}


if __name__ == "__main__":
    import uvicorn
    # Bind to port 8000 for standard local testing
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
