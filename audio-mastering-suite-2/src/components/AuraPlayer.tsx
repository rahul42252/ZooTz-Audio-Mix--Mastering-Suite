import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, RotateCcw, Download, ToggleLeft, ToggleRight, Radio, Sparkles, CloudUpload, Check } from 'lucide-react';
import { audioBufferToWav } from '../utils/audioEncoder';
import { MasteringSettings } from '../types';
import { MasteringDSPGraph } from '../utils/dspEngine';
import { db, collection, addDoc, Timestamp, type User } from '../lib/firebase';

interface AuraPlayerProps {
  originalBuffer: AudioBuffer;
  masteredBuffer: AudioBuffer;
  fileName: string;
  settings: MasteringSettings;
  inputPeak: number;
  user: User | null;
  onSaveSuccess: () => void;
}

export default function AuraPlayer({ originalBuffer, masteredBuffer, fileName, settings, inputPeak, user, onSaveSuccess }: AuraPlayerProps) {
  const originalContainerRef = useRef<HTMLDivElement>(null);
  const masteredContainerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrack, setActiveTrack] = useState<'original' | 'mastered'>('mastered');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const originalWsRef = useRef<WaveSurfer | null>(null);
  const masteredWsRef = useRef<WaveSurfer | null>(null);
  
  // Real-time audio play nodes to achieve synchronized A/B testing
  const audioCtxRef = useRef<AudioContext | null>(null);
  const originalSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const masteredSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const originalGainNodeRef = useRef<GainNode | null>(null);
  const masteredGainNodeRef = useRef<GainNode | null>(null);
  const dspGraphRef = useRef<MasteringDSPGraph | null>(null);
  
  const playbackStartTimeRef = useRef<number>(0);
  const pausedAtTimeRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);

  useEffect(() => {
    // 1. Initialize Web Audio Context for synchronized playback
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    audioCtxRef.current = audioCtx;
    setDuration(originalBuffer.duration);

    // 2. Initialize Wavesurfer instances for visuals
    const createWavesurfer = (container: HTMLDivElement, waveColor: string, progressColor: string) => {
      return WaveSurfer.create({
        container,
        waveColor,
        progressColor,
        cursorColor: '#71717a',
        cursorWidth: 1.5,
        height: 64,
        barWidth: 2,
        barGap: 3,
        barRadius: 2,
        interact: true,
        fillParent: true,
      });
    };

    if (originalContainerRef.current && masteredContainerRef.current) {
      // Load Wavesurfer for Original
      const origWs = createWavesurfer(originalContainerRef.current, '#3f3f46', '#71717a');
      originalWsRef.current = origWs;

      // Load Wavesurfer for Mastered
      const mastWs = createWavesurfer(masteredContainerRef.current, '#064e3b', '#10b981');
      masteredWsRef.current = mastWs;

      // Convert buffers to Blob URLs to load in Wavesurfer
      const origBlob = audioBufferToWav(originalBuffer);
      const origUrl = URL.createObjectURL(origBlob);
      origWs.load(origUrl);

      const mastBlob = audioBufferToWav(masteredBuffer);
      const mastUrl = URL.createObjectURL(mastBlob);
      mastWs.load(mastUrl);

      // Synced seeking
      origWs.on('interaction', (newProgress) => {
        if (isSeekingRef.current) return;
        isSeekingRef.current = true;
        mastWs.setTime(newProgress * originalBuffer.duration);
        handleSeek(newProgress * originalBuffer.duration);
        isSeekingRef.current = false;
      });

      mastWs.on('interaction', (newProgress) => {
        if (isSeekingRef.current) return;
        isSeekingRef.current = true;
        origWs.setTime(newProgress * originalBuffer.duration);
        handleSeek(newProgress * originalBuffer.duration);
        isSeekingRef.current = false;
      });

      return () => {
        origWs.destroy();
        mastWs.destroy();
        URL.revokeObjectURL(origUrl);
        URL.revokeObjectURL(mastUrl);
        stopAudio();
        audioCtx.close();
      };
    }
  }, [originalBuffer, masteredBuffer]);

  // Dynamically update DSP graph settings on parameter adjustment
  useEffect(() => {
    if (dspGraphRef.current) {
      dspGraphRef.current.updateSettings(settings, inputPeak);
    }
  }, [settings, inputPeak]);

  // Keep tracking time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        const elapsed = audioCtxRef.current
          ? audioCtxRef.current.currentTime - playbackStartTimeRef.current
          : 0;
        
        if (elapsed >= duration) {
          setIsPlaying(false);
          setCurrentTime(0);
          pausedAtTimeRef.current = 0;
          if (originalWsRef.current) originalWsRef.current.setTime(0);
          if (masteredWsRef.current) masteredWsRef.current.setTime(0);
        } else {
          setCurrentTime(elapsed);
          // Sync waveforms cursor
          if (originalWsRef.current && masteredWsRef.current && !isSeekingRef.current) {
            originalWsRef.current.setTime(elapsed);
            masteredWsRef.current.setTime(elapsed);
          }
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  const startAudio = (offset: number) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    // Resume audio context if suspended (browser security)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Stop existing sources
    stopAudio();

    // Create dual synchronized source channels
    const origSource = ctx.createBufferSource();
    origSource.buffer = originalBuffer;
    
    const mastSource = ctx.createBufferSource();
    mastSource.buffer = originalBuffer; // Pass original buffer into live DSP graph for parameter modification feedback

    // Create gain stages for A/B routing
    const origGain = ctx.createGain();
    const mastGain = ctx.createGain();

    origGain.gain.setValueAtTime(activeTrack === 'original' ? 1 : 0, ctx.currentTime);
    mastGain.gain.setValueAtTime(activeTrack === 'mastered' ? 1 : 0, ctx.currentTime);

    // Instantiate live DSP graph on active original source node
    const dspGraph = new MasteringDSPGraph(ctx, mastSource);
    dspGraph.updateSettings(settings, inputPeak);
    dspGraphRef.current = dspGraph;

    // Route to speaker output
    origSource.connect(origGain).connect(ctx.destination);
    dspGraph.outputNode.connect(mastGain).connect(ctx.destination);

    // Start playback simultaneously
    origSource.start(0, offset);
    mastSource.start(0, offset);

    originalSourceRef.current = origSource;
    masteredSourceRef.current = mastSource;
    originalGainNodeRef.current = origGain;
    masteredGainNodeRef.current = mastGain;

    playbackStartTimeRef.current = ctx.currentTime - offset;
  };

  const stopAudio = () => {
    if (originalSourceRef.current) {
      try { originalSourceRef.current.stop(); } catch (e) {}
      originalSourceRef.current = null;
    }
    if (masteredSourceRef.current) {
      try { masteredSourceRef.current.stop(); } catch (e) {}
      masteredSourceRef.current = null;
    }
    dspGraphRef.current = null;
  };

  const handlePlayPause = () => {
    if (!audioCtxRef.current) return;
    
    if (isPlaying) {
      // Pause
      stopAudio();
      pausedAtTimeRef.current = audioCtxRef.current.currentTime - playbackStartTimeRef.current;
      setIsPlaying(false);
    } else {
      // Play
      const startOffset = pausedAtTimeRef.current;
      startAudio(startOffset);
      setIsPlaying(true);
    }
  };

  const handleSeek = (newTime: number) => {
    pausedAtTimeRef.current = newTime;
    setCurrentTime(newTime);
    if (isPlaying) {
      startAudio(newTime);
    }
  };

  const handleReset = () => {
    stopAudio();
    pausedAtTimeRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
    if (originalWsRef.current) originalWsRef.current.setTime(0);
    if (masteredWsRef.current) masteredWsRef.current.setTime(0);
  };

  // Switch routing gain between channels instantly with a short 30ms ramp to avoid audio clicks
  const toggleAB = (track: 'original' | 'mastered') => {
    setActiveTrack(track);
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const origGain = originalGainNodeRef.current;
    const mastGain = masteredGainNodeRef.current;

    if (origGain && mastGain) {
      const t = ctx.currentTime;
      if (track === 'original') {
        origGain.gain.setTargetAtTime(1, t, 0.015);
        mastGain.gain.setTargetAtTime(0, t, 0.015);
      } else {
        origGain.gain.setTargetAtTime(0, t, 0.015);
        mastGain.gain.setTargetAtTime(1, t, 0.015);
      }
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const triggerDownload = (format: 'wav' | 'mp3') => {
    // Generate the WAV blob
    const wavBlob = audioBufferToWav(masteredBuffer);
    
    let downloadBlob = wavBlob;
    let extension = 'wav';
    
    if (format === 'mp3') {
      extension = 'mp3';
    }
    
    const url = URL.createObjectURL(downloadBlob);
    const a = document.createElement('a');
    a.href = url;
    
    const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    a.download = `${baseName}_mastered.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Fetch local increment stats API
    fetch('/api/stats/increment', { method: 'POST' }).catch(() => {});
  };

  const handleSaveToCloud = async () => {
    if (!user) return;
    setSaveLoading(true);
    try {
      await addDoc(collection(db, 'projects'), {
        userId: user.uid,
        fileName,
        settings,
        createdAt: Timestamp.now()
      });
      setSaveSuccess(true);
      onSaveSuccess();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving project:', err);
      alert('Failed to save project to cloud history.');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="bg-[#0c0c0d] border border-zinc-900 rounded-2xl p-6 space-y-6 shadow-md">
      {/* Track Metadata Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-900">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            Studio Active Playback
          </span>
          <h4 className="text-zinc-200 text-base font-semibold mt-2.5 tracking-tight truncate max-w-md">
            {fileName}
          </h4>
        </div>
        
        {/* Instant A/B Toggle Switch */}
        <div className="flex items-center space-x-1.5 bg-[#121214] border border-zinc-800 p-1 rounded-xl">
          <button
            id="toggle-ab-original"
            onClick={() => toggleAB('original')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono tracking-tight transition-all duration-300 ${
              activeTrack === 'original'
                ? 'bg-zinc-800 text-zinc-100 shadow'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Original
          </button>
          <button
            id="toggle-ab-mastered"
            onClick={() => toggleAB('mastered')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono tracking-tight flex items-center space-x-1 transition-all duration-300 ${
              activeTrack === 'mastered'
                ? 'bg-emerald-500 text-[#0c0c0d] font-semibold shadow'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Sparkles className="w-3 h-3 mr-0.5" />
            Mastered
          </button>
        </div>
      </div>

      {/* Synchronized Waveforms container */}
      <div className="space-y-5 py-2">
        {/* Waveform: Original */}
        <div className={`space-y-1.5 transition-opacity duration-300 ${activeTrack === 'original' ? 'opacity-100' : 'opacity-40'}`}>
          <div className="flex justify-between items-center text-[10px] font-mono tracking-wider text-zinc-500 uppercase px-1">
            <span>Original Waveform (Unmixed Mixdown)</span>
            {activeTrack === 'original' && <span className="text-zinc-400 animate-pulse">● BYPASS ACTIVE</span>}
          </div>
          <div ref={originalContainerRef} className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-900/60" />
        </div>

        {/* Waveform: Mastered */}
        <div className={`space-y-1.5 transition-opacity duration-300 ${activeTrack === 'mastered' ? 'opacity-100' : 'opacity-40'}`}>
          <div className="flex justify-between items-center text-[10px] font-mono tracking-wider text-zinc-500 uppercase px-1">
            <span>Mastered Waveform (Maximizer Applied)</span>
            {activeTrack === 'mastered' && <span className="text-emerald-400 animate-pulse flex items-center">
              <Radio className="w-2.5 h-2.5 mr-1 animate-ping" />
              ● DSP ENGINE ACTIVE
            </span>}
          </div>
          <div ref={masteredContainerRef} className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-900/60" />
        </div>
      </div>

      {/* Sync Audio Player Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-2">
        {/* Time counter */}
        <div className="text-xs font-mono text-zinc-400 flex items-center space-x-2 bg-[#121214] px-3.5 py-2 rounded-xl border border-zinc-800/60">
          <span>{formatTime(currentTime)}</span>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-500">{formatTime(duration)}</span>
        </div>

        {/* Play/Pause/Reset Core */}
        <div className="flex items-center space-x-3">
          <button
            id="player-reset-btn"
            onClick={handleReset}
            title="Reset to beginning"
            className="p-3 rounded-xl bg-[#121214] border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            id="player-play-pause-btn"
            onClick={handlePlayPause}
            className={`p-4 rounded-xl transition-all duration-300 cursor-pointer ${
              isPlaying
                ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
            }`}
          >
            {isPlaying ? <Pause className="w-6 h-6 fill-zinc-950" /> : <Play className="w-6 h-6 fill-zinc-950" />}
          </button>
        </div>

        {/* Download Mastered Audio Tracks & Save */}
        <div className="flex flex-wrap items-center gap-2">
          {user && (
            <button
              id="save-master-to-cloud"
              onClick={handleSaveToCloud}
              disabled={saveLoading || saveSuccess}
              className={`px-4 py-2 border rounded-xl text-xs font-mono tracking-tight flex items-center space-x-2 transition-all cursor-pointer ${
                saveSuccess
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100'
              }`}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved to Cloud!</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>{saveLoading ? 'Saving...' : 'Save to Cloud'}</span>
                </>
              )}
            </button>
          )}
          <button
            id="download-mastered-wav"
            onClick={() => triggerDownload('wav')}
            className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-200 hover:border-zinc-700 hover:text-zinc-100 rounded-xl text-xs font-mono tracking-tight flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download WAV</span>
          </button>
          <button
            id="download-mastered-mp3"
            onClick={() => triggerDownload('mp3')}
            className="px-4 py-2 bg-[#111827] border border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100 rounded-xl text-xs font-mono tracking-tight flex items-center space-x-2 transition-all cursor-pointer"
            title="Saves high fidelity render"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span>Download MP3</span>
          </button>
        </div>
      </div>
    </div>
  );
}
