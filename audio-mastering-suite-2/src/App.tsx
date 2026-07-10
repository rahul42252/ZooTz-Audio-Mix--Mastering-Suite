import { useState, useEffect } from 'react';
import { Sparkles, Sliders, Volume2, ShieldCheck, Download, Code, ListFilter, Play, FileAudio, Info } from 'lucide-react';
import UploadZone from './components/UploadZone';
import MasteringControls from './components/MasteringControls';
import ProcessingDashboard from './components/ProcessingDashboard';
import AuraPlayer from './components/AuraPlayer';
import { MasteringSettings, ProcessingStage } from './types';
import { processMasteringOffline } from './utils/dspEngine';
import { auth, onAuthStateChanged, signOut, type User } from './lib/firebase';
import AuthModal from './components/AuthModal';
import HistoryDashboard from './components/HistoryDashboard';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null);
  const [masteredBuffer, setMasteredBuffer] = useState<AudioBuffer | null>(null);
  const [inputPeak, setInputPeak] = useState<number>(0.707);
  
  const [settings, setSettings] = useState<MasteringSettings>({
    processingMode: 'both',
    loudness: 'streaming',
    character: 'balanced',
    saturationDrive: 1.5,
    stereoWidth: 1.2,
    lowCutFrequency: 30,
    muddyCutDb: -2.0,
    eqGain: 0.0,
    eqFreq: 2500,
    compressorThreshold: -18.0,
    compressorRatio: 2.0,
    lowCutEnabled: true,
    muddyCutEnabled: true,
    eqEnabled: true,
    compressorEnabled: true,
    saturationEnabled: true,
    stereoWidthEnabled: true,
    masterBypass: false,
  });

  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ processedTracksCount: number; pythonBackendAvailable: boolean } | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Sync auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleApplySettings = (savedSettings: MasteringSettings, loadedFileName: string) => {
    setSettings({
      ...savedSettings,
      processingMode: savedSettings.processingMode || 'both',
      lowCutEnabled: savedSettings.lowCutEnabled !== false,
      muddyCutEnabled: savedSettings.muddyCutEnabled !== false,
      eqEnabled: savedSettings.eqEnabled !== false,
      compressorEnabled: savedSettings.compressorEnabled !== false,
      saturationEnabled: savedSettings.saturationEnabled !== false,
      stereoWidthEnabled: savedSettings.stereoWidthEnabled !== false,
      masterBypass: savedSettings.masterBypass === true,
    });
  };

  // Fetch backend statistics on load
  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  const handleFileSelect = async (selectedFile: File) => {
    try {
      setFile(selectedFile);
      setOriginalBuffer(null);
      setMasteredBuffer(null);
      setStage('analyzing');
      setError(null);

      // Create Web Audio Context to decode the file directly in the browser
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();

      const arrayBuffer = await selectedFile.arrayBuffer();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      setOriginalBuffer(decodedBuffer);

      // Analyze Peak Amplitude for Gain Staging calibration
      let peak = 0;
      for (let ch = 0; ch < decodedBuffer.numberOfChannels; ch++) {
        const channelData = decodedBuffer.getChannelData(ch);
        for (let i = 0; i < channelData.length; i++) {
          const val = Math.abs(channelData[i]);
          if (val > peak) peak = val;
        }
      }
      setInputPeak(peak);
      setStage('idle'); // Decoded and ready to master
    } catch (err: any) {
      console.error(err);
      setError('Failed to decode audio file. Make sure it is a valid, uncorrupted stereo WAV or MP3 audio file.');
      setStage('failed');
    }
  };

  const handleMaster = async () => {
    if (!originalBuffer) return;
    setIsProcessing(true);
    setError(null);

    try {
      const rendered = await processMasteringOffline(
        originalBuffer,
        settings,
        inputPeak,
        (currentStage) => {
          setStage(currentStage);
        }
      );

      setMasteredBuffer(rendered);
      setStage('completed');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during mastering offline render.');
      setStage('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setOriginalBuffer(null);
    setMasteredBuffer(null);
    setStage('idle');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#070708] text-zinc-100 flex flex-col font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Header */}
      <header className="border-b border-zinc-900 bg-[#0c0c0d]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-zinc-100 font-semibold tracking-tight text-base sm:text-lg">
                Audio Mastering Suite
              </h1>
              <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider hidden sm:block">
                Professional DSP Mastering Chain
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {stats && (
              <span className="text-xs font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full hidden sm:inline-flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                Masters Exported: {stats.processedTracksCount}
              </span>
            )}
            
            {/* User Account Controls */}
            {user ? (
              <div className="flex items-center space-x-3 bg-zinc-900/60 border border-zinc-800/80 px-3 py-1.5 rounded-xl">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-semibold text-zinc-300 truncate max-w-[120px]" title={user.email || ''}>
                    {user.email}
                  </span>
                  <span className="text-[9px] font-mono text-emerald-400 font-semibold tracking-wider">STUDIO MEMBER</span>
                </div>
                <button
                  onClick={() => signOut(auth)}
                  className="text-xs font-mono text-zinc-400 hover:text-red-400 transition-colors bg-zinc-950 border border-zinc-800 hover:border-red-500/30 px-2.5 py-1 rounded-lg cursor-pointer"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="text-xs font-mono text-[#070708] bg-emerald-500 hover:bg-emerald-400 transition-colors px-3.5 py-1.5 rounded-xl font-bold cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.15)]"
              >
                Sign In
              </button>
            )}

            <a 
              href="#python-deploy"
              className="text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5"
            >
              <Code className="w-3.5 h-3.5" />
              <span>Python Backend Code</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Studio Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Welcome Intro Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
              In-Browser Mastering Studio
            </h2>
            <p className="text-zinc-400 text-sm max-w-2xl">
              Optimize loudness, color, and stereo imaging using our client-side 
              offline-render digital signal processor. Industry ready masters in seconds.
            </p>
          </div>
        </div>

        {/* Studio Rack Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT PANEL: Upload & Settings Rack (7 Columns) */}
          <div className="lg:col-span-7 space-y-6">
            {!file ? (
              <UploadZone onFileSelect={handleFileSelect} isProcessing={isProcessing} />
            ) : (
              <div className="bg-[#0e0e10] border border-zinc-900 rounded-2xl p-5 flex items-center justify-between">
                <div className="flex items-center space-x-3.5 truncate">
                  <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-400">
                    <FileAudio className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="truncate">
                    <h4 className="text-zinc-200 text-sm font-semibold truncate">{file.name}</h4>
                    <p className="text-[10px] font-mono text-zinc-500 mt-1 uppercase">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • {originalBuffer ? `${originalBuffer.numberOfChannels} Ch` : 'Decoding...'} • {originalBuffer ? `${originalBuffer.sampleRate} Hz` : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  disabled={isProcessing}
                  className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 rounded-xl text-xs font-mono transition-colors cursor-pointer"
                >
                  Remove File
                </button>
              </div>
            )}

            {/* Mastering Sliders and Character options */}
            <MasteringControls
              settings={settings}
              onChange={setSettings}
              disabled={isProcessing || !file}
            />

            {/* Trigger Mastering Button */}
            {file && stage !== 'completed' && !isProcessing && (
              <button
                id="master-track-btn"
                onClick={handleMaster}
                disabled={!originalBuffer}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-[#09090b] font-semibold rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.25)] transition-all duration-300 flex items-center justify-center space-x-2 text-base cursor-pointer"
              >
                <Sparkles className="w-5 h-5 fill-[#09090b]" />
                <span>Render & Master Track</span>
              </button>
            )}
          </div>

          {/* RIGHT PANEL: Live Monitor & Pipelines (5 Columns) */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            
            {/* Monitor / Waveform Player */}
            {stage === 'completed' && originalBuffer && masteredBuffer && file ? (
              <AuraPlayer
                originalBuffer={originalBuffer}
                masteredBuffer={masteredBuffer}
                fileName={file.name}
                settings={settings}
                inputPeak={inputPeak}
                user={user}
                onSaveSuccess={() => setRefreshTrigger((prev) => prev + 1)}
              />
            ) : (
              <div className="bg-[#0e0e10]/40 border border-zinc-900 border-dashed rounded-2xl p-8 flex flex-col items-center text-center justify-center min-h-[280px]">
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-900 text-zinc-600 mb-4 animate-pulse">
                  <Play className="w-8 h-8" />
                </div>
                <h4 className="text-zinc-400 text-sm font-semibold">Master Monitor</h4>
                <p className="text-zinc-600 text-xs mt-1.5 max-w-xs leading-relaxed">
                  {file 
                    ? "Click 'Render & Master Track' to process your audio with the customized DSP settings above."
                    : "Upload an audio file in the zone on the left to activate the real-time master monitor."}
                </p>
              </div>
            )}

            {/* Stage Indicator Tracker */}
            {(isProcessing || stage === 'completed' || stage === 'failed' || stage === 'analyzing') && (
              <ProcessingDashboard currentStage={stage} error={error} />
            )}

            {/* Historic Masters Cloud Dashboard */}
            <HistoryDashboard 
              user={user} 
              onApplySettings={handleApplySettings} 
              refreshTrigger={refreshTrigger} 
            />
          </div>
        </div>

        {/* Python Deployment Section */}
        <section id="python-deploy" className="border-t border-zinc-900 pt-10 space-y-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <Code className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-zinc-200">
                Python Production Server Reference
              </h3>
              <p className="text-zinc-500 text-xs">
                Learn how to deploy this exact mastering chain on your dedicated server or cloud VMs
              </p>
            </div>
          </div>

          <div className="bg-[#0e0e10] border border-zinc-900 rounded-2xl p-6 space-y-6">
            <div className="space-y-3">
              <p className="text-zinc-400 text-sm leading-relaxed">
                As part of this application suite, we have included the complete production-grade **Python DSP Pipeline** and **FastAPI upload server** scripts in your workspace. This code mirrors the high-fidelity mastering settings running in your browser, utilizing optimized low-level libraries like `librosa`, `scipy`, and `pydub`.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* File 1: mastering.py */}
              <div className="p-5 rounded-xl bg-[#121214] border border-zinc-800/60 space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-emerald-400">/python/mastering.py</h4>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Implements the complete mathematical signal-processing chain: Butterworth high-pass rumble cuts, peaking EQs, tanh-saturation, mid-side Haas delay widening, and a lookahead peak maximizer.
                </p>
              </div>

              {/* File 2: server.py */}
              <div className="p-5 rounded-xl bg-[#121214] border border-zinc-800/60 space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-indigo-400">/python/server.py</h4>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Sets up a production-ready FastAPI backend with `/upload`, `/process`, and `/download` endpoints, allowing multi-format MP3/WAV storage and background rendering.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="text-zinc-300 text-xs uppercase font-mono tracking-wider flex items-center">
                <Info className="w-4 h-4 mr-1.5 text-zinc-500" />
                How to Run Python Code Locally:
              </h4>
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-900/80 font-mono text-xs text-zinc-400 space-y-2 leading-relaxed">
                <div># 1. Install required dependencies</div>
                <div className="text-emerald-400">pip install numpy scipy fastapi uvicorn pydub librosa python-multipart</div>
                
                <div className="pt-2"># 2. Run the FastAPI development server</div>
                <div className="text-emerald-400">cd python && uvicorn server:app --host 0.0.0.0 --port 8000</div>
                
                <div className="pt-2"># 3. Alternatively, process files directly via the CLI</div>
                <div className="text-emerald-400">python mastering.py input.wav mastered_output.wav -14.0 balanced</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-[#070708] py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2">
          <p className="text-zinc-600 text-xs">
            Audio Mastering Suite • Created for professional music mixing, mastering, and audio visualization.
          </p>
          <p className="text-[10px] text-zinc-700">
            Powered by high-performance Web Audio API OfflineAudioContext algorithms.
          </p>
        </div>
      </footer>

      {/* Cloud Authentication Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
