import { MasteringSettings } from '../types';

/**
 * Creates a sigmoid waveshaper curve for warm analog tape/tube style saturation.
 * @param drive The saturation amount (1.0 = neutral/subtle, 4.0 = heavy drive)
 */
export function createDistortionCurve(drive: number): Float32Array {
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  
  // As drive increases, we increase the non-linear shaping factor
  const k = (drive - 1.0) * 15;
  
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    if (k === 0) {
      curve[i] = x;
    } else {
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
  }
  return curve;
}

/**
 * Master class that compiles the Audio DSP Graph for either offline rendering
 * or live real-time playback control.
 */
export class MasteringDSPGraph {
  ctx: BaseAudioContext;
  
  // Nodes
  sourceNode: AudioBufferSourceNode | MediaElementAudioSourceNode;
  gainStagingNode: GainNode;
  hpFilterNode: BiquadFilterNode;
  peakingEqNode: BiquadFilterNode;
  userEqNode: BiquadFilterNode;
  highShelfNode: BiquadFilterNode;
  compressorNode: DynamicsCompressorNode;
  saturationNode: WaveShaperNode;
  
  // Stereo Widening Sub-Graph
  lowpassCrossover: BiquadFilterNode;
  highpassCrossover: BiquadFilterNode;
  highSplitter: ChannelSplitterNode;
  highDelayL: DelayNode;
  highDelayR: DelayNode;
  highDelayGainL: GainNode;
  highDelayGainR: GainNode;
  highMerger: ChannelMergerNode;
  lowHighMerger: ChannelMergerNode;
  
  // Limiter Nodes
  makeupDriveNode: GainNode;
  limiterNode: DynamicsCompressorNode;
  
  // Master Output
  outputNode: AudioNode;

  constructor(ctx: BaseAudioContext, sourceNode: AudioBufferSourceNode | MediaElementAudioSourceNode) {
    this.ctx = ctx;
    this.sourceNode = sourceNode;
    
    // 1. Initialize Nodes
    this.gainStagingNode = ctx.createGain();
    
    // Corrective EQ Filter (Highpass sub-rumble)
    this.hpFilterNode = ctx.createBiquadFilter();
    this.hpFilterNode.type = 'highpass';
    
    // Parametric Mud-Cut EQ
    this.peakingEqNode = ctx.createBiquadFilter();
    this.peakingEqNode.type = 'peaking';
    
    // User-adjustable Peaking EQ
    this.userEqNode = ctx.createBiquadFilter();
    this.userEqNode.type = 'peaking';
    this.userEqNode.Q.value = 1.2;
    
    // High-frequency coloring (Air)
    this.highShelfNode = ctx.createBiquadFilter();
    this.highShelfNode.type = 'highshelf';
    
    // Glue Dynamics Compressor
    this.compressorNode = ctx.createDynamicsCompressor();
    
    // Saturation WaveShaper
    this.saturationNode = ctx.createWaveShaper();
    this.saturationNode.oversample = '4x';
    
    // Stereo Widening (HF crossover + mono bass)
    this.lowpassCrossover = ctx.createBiquadFilter();
    this.lowpassCrossover.type = 'lowpass';
    this.lowpassCrossover.frequency.value = 250; // Keep sub-bass in mono
    
    this.highpassCrossover = ctx.createBiquadFilter();
    this.highpassCrossover.type = 'highpass';
    this.highpassCrossover.frequency.value = 250;
    
    this.highSplitter = ctx.createChannelSplitter(2);
    this.highDelayL = ctx.createDelay(0.1);
    this.highDelayR = ctx.createDelay(0.1);
    this.highDelayGainL = ctx.createGain();
    this.highDelayGainR = ctx.createGain();
    this.highMerger = ctx.createChannelMerger(2);
    
    this.lowHighMerger = ctx.createChannelMerger(2);
    
    // Limiter Make-up Gain
    this.makeupDriveNode = ctx.createGain();
    
    // Limiter Brickwall Compressor
    this.limiterNode = ctx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -1.0; // limit true peak ceiling to -1dB
    this.limiterNode.knee.value = 0;          // hard knee
    this.limiterNode.ratio.value = 20.0;      // high ratio limit
    this.limiterNode.attack.value = 0.001;    // ultra-fast attack (1ms)
    this.limiterNode.release.value = 0.05;    // fast release (50ms)
    
    // Output Node represents finalized master stage
    this.outputNode = this.limiterNode;
    
    this.setupConnections();
  }

  private setupConnections() {
    // Connect input source to gain staging
    this.sourceNode.connect(this.gainStagingNode);
    
    // Chain EQ stages
    this.gainStagingNode.connect(this.hpFilterNode);
    this.hpFilterNode.connect(this.peakingEqNode);
    this.peakingEqNode.connect(this.userEqNode);
    this.userEqNode.connect(this.highShelfNode);
    
    // Connect to Dynamic Glue Compressor
    this.highShelfNode.connect(this.compressorNode);
    
    // Connect to Harmonic Saturation
    this.compressorNode.connect(this.saturationNode);
    
    // --- Stereo Widening Routing (Mid-Side Haas Delay) ---
    // Route saturation out to Low and High crossovers
    this.saturationNode.connect(this.lowpassCrossover);
    this.saturationNode.connect(this.highpassCrossover);
    
    // Low band goes direct to mergers (Sum to Mono)
    // We sum Left and Right of lowpass and feed it to both Left/Right channels of merger
    const lowpassSplitter = this.ctx.createChannelSplitter(2);
    const lowpassMonoMerger = this.ctx.createChannelMerger(2);
    const lowpassGainNode = this.ctx.createGain();
    lowpassGainNode.gain.value = 0.5; // Gain adjustment to compensate sum
    
    this.lowpassCrossover.connect(lowpassSplitter);
    lowpassSplitter.connect(lowpassGainNode, 0); // Left channel
    lowpassSplitter.connect(lowpassGainNode, 1); // Right channel
    
    lowpassGainNode.connect(lowpassMonoMerger, 0, 0); // mono left
    lowpassGainNode.connect(lowpassMonoMerger, 0, 1); // mono right
    
    // High band split for delay-based Haas widening
    this.highpassCrossover.connect(this.highSplitter);
    
    // Channel 0 (Left) -> Direct & through small delay
    this.highSplitter.connect(this.highDelayL, 0);
    this.highDelayL.connect(this.highDelayGainL);
    this.highDelayGainL.connect(this.highMerger, 0, 0); // Direct Left
    
    // Channel 1 (Right) -> Direct & delayed by up to 15ms (creates 3D space)
    this.highSplitter.connect(this.highDelayR, 1);
    this.highDelayR.connect(this.highDelayGainR);
    this.highDelayGainR.connect(this.highMerger, 0, 1); // Delayed Right
    
    // Merge Low and High bands back together
    // Channels 0/1 of mono lowpass feed Left/Right of lowHighMerger
    const lowpassMergerSplitter = this.ctx.createChannelSplitter(2);
    lowpassMonoMerger.connect(lowpassMergerSplitter);
    
    const highpassMergerSplitter = this.ctx.createChannelSplitter(2);
    this.highMerger.connect(highpassMergerSplitter);
    
    // Mix Left Low with Left High
    const leftMix = this.ctx.createGain();
    lowpassMergerSplitter.connect(leftMix, 0);
    highpassMergerSplitter.connect(leftMix, 0);
    leftMix.connect(this.lowHighMerger, 0, 0);
    
    // Mix Right Low with Right High
    const rightMix = this.ctx.createGain();
    lowpassMergerSplitter.connect(rightMix, 1);
    highpassMergerSplitter.connect(rightMix, 1);
    rightMix.connect(this.lowHighMerger, 0, 1);
    
    // Connect combined signals to Make-up gain / Loudness driver
    this.lowHighMerger.connect(this.makeupDriveNode);
    
    // Route to brickwall limiter
    this.makeupDriveNode.connect(this.limiterNode);
  }

  /**
   * Updates all DSP nodes dynamically based on active mastering settings.
   */
  public updateSettings(settings: MasteringSettings, inputPeak: number) {
    const t = this.ctx.currentTime;
    
    if (settings.masterBypass === true) {
      // MASTER BYPASS: Reset all parameters to flat, completely clean pass-through
      this.gainStagingNode.gain.setTargetAtTime(1.0, t, 0.01);
      this.hpFilterNode.type = 'allpass';
      this.peakingEqNode.gain.setTargetAtTime(0.0, t, 0.01);
      this.userEqNode.gain.setTargetAtTime(0.0, t, 0.01);
      this.highShelfNode.gain.setTargetAtTime(0.0, t, 0.01);
      this.saturationNode.curve = null;
      this.compressorNode.threshold.setTargetAtTime(0.0, t, 0.01);
      this.compressorNode.ratio.setTargetAtTime(1.0, t, 0.01);
      this.highDelayL.delayTime.setTargetAtTime(0.0, t, 0.01);
      this.highDelayR.delayTime.setTargetAtTime(0.0, t, 0.01);
      this.highDelayGainL.gain.setTargetAtTime(1.0, t, 0.01);
      this.highDelayGainR.gain.setTargetAtTime(1.0, t, 0.01);
      this.makeupDriveNode.gain.setTargetAtTime(1.0, t, 0.01);
      this.limiterNode.threshold.setTargetAtTime(0.0, t, 0.01);
      this.limiterNode.ratio.setTargetAtTime(1.0, t, 0.01);
      return;
    }

    // Normal mode: Restore default brickwall limiter thresholds
    this.limiterNode.threshold.setTargetAtTime(-1.0, t, 0.01);
    this.limiterNode.ratio.setTargetAtTime(20.0, t, 0.01);

    // 1. Gain Staging (Target -6dBFS peak headroom)
    const targetPeakDb = -6.0;
    const targetPeakLinear = Math.pow(10, targetPeakDb / 20);
    const peakNormalized = inputPeak > 0 ? inputPeak : 0.707;
    const stagingGain = targetPeakLinear / peakNormalized;
    this.gainStagingNode.gain.setTargetAtTime(stagingGain, t, 0.01);
    
    // 2. Highpass Filter Frequency (Corrective EQ - disabled in Master Only mode)
    if (settings.lowCutEnabled === false || settings.processingMode === 'master') {
      this.hpFilterNode.type = 'allpass';
    } else {
      this.hpFilterNode.type = 'highpass';
      this.hpFilterNode.frequency.setTargetAtTime(settings.lowCutFrequency, t, 0.01);
    }
    
    // 3. Mud-cut EQ Db (Corrective EQ - disabled in Master Only mode)
    this.peakingEqNode.frequency.setTargetAtTime(220, t, 0.01);
    this.peakingEqNode.Q.setTargetAtTime(1.0, t, 0.01);
    const muddyCutGain = (settings.muddyCutEnabled !== false && settings.processingMode !== 'master') ? settings.muddyCutDb : 0.0;
    this.peakingEqNode.gain.setTargetAtTime(muddyCutGain, t, 0.01);
    
    // 3b. User-adjustable Peaking EQ (Corrective/Custom EQ - disabled in Master Only mode)
    this.userEqNode.frequency.setTargetAtTime(settings.eqFreq, t, 0.01);
    const userEqGain = (settings.eqEnabled !== false && settings.processingMode !== 'master') ? settings.eqGain : 0.0;
    this.userEqNode.gain.setTargetAtTime(userEqGain, t, 0.01);
    
    // 4. Character (Warm / Bright / Balanced) Air High-Shelf (Tone Coloring - flat/disabled in Mix Only mode)
    let characterHighGain = 0.0;
    let characterLowBoost = 0;
    
    if (settings.processingMode !== 'mix') {
      characterHighGain = 0.5; // balanced default
      if (settings.character === 'warm') {
        characterHighGain = -1.5;
        characterLowBoost = 1.0; // Warm low-end bump
      } else if (settings.character === 'bright') {
        characterHighGain = 2.5; // Beautiful clear air
        characterLowBoost = -0.5;
      }
    }
    
    this.highShelfNode.frequency.setTargetAtTime(8500, t, 0.01);
    this.highShelfNode.gain.setTargetAtTime(characterHighGain, t, 0.01);
    
    // 5. Tape Saturation Drive
    if (settings.saturationEnabled === false) {
      this.saturationNode.curve = null;
    } else {
      this.saturationNode.curve = createDistortionCurve(settings.saturationDrive);
    }
    
    // 6. Dynamic Glue Compressor Tuning
    const compThreshold = settings.compressorEnabled !== false ? settings.compressorThreshold : 0.0;
    const compRatio = settings.compressorEnabled !== false ? settings.compressorRatio : 1.0;
    this.compressorNode.threshold.setTargetAtTime(compThreshold, t, 0.01);
    this.compressorNode.ratio.setTargetAtTime(compRatio, t, 0.01);
    this.compressorNode.knee.setTargetAtTime(12, t, 0.01);
    this.compressorNode.attack.setTargetAtTime(0.015, t, 0.01);
    this.compressorNode.release.setTargetAtTime(0.12, t, 0.01);
    
    // 7. Stereo Widening Haas Delay (Stereo Widening - bypassed/disabled in Mix Only mode)
    const delayTimeSec = (settings.stereoWidthEnabled !== false && settings.processingMode !== 'mix') 
      ? 0.012 * (settings.stereoWidth - 1.0) 
      : 0.0; // scales from 0 (mono high) to 12ms (fully wide)
    
    this.highDelayL.delayTime.setTargetAtTime(0, t, 0.01);
    this.highDelayR.delayTime.setTargetAtTime(delayTimeSec, t, 0.01);
    
    // Set gains based on stereo width
    // Modulate gain to avoid phasing issues on mono sums
    this.highDelayGainL.gain.setTargetAtTime(1.0, t, 0.01);
    this.highDelayGainR.gain.setTargetAtTime(1.0, t, 0.01);
    
    // 8. Brickwall Limiter & Maximizer Make-up Gain Drive (Loudness driver - bypassed/disabled in Mix Only mode to keep dynamic headroom)
    let targetLoudnessDb = -14.0; // streaming
    let makeupBoostDb = 0.0;      // 0dB in Mix mode to preserve mixing headroom
    
    if (settings.processingMode !== 'mix') {
      makeupBoostDb = 5.0;      // Default driver boost to saturate limiter
      if (settings.loudness === 'club') {
        targetLoudnessDb = -9.0;
        makeupBoostDb = 9.0;
      } else if (settings.loudness === 'cd') {
        targetLoudnessDb = -7.0;
        makeupBoostDb = 12.0;
      }
    }
    
    // Compensate low boost if any
    const totalBoostDb = makeupBoostDb + characterLowBoost;
    const boostLinear = Math.pow(10, totalBoostDb / 20);
    this.makeupDriveNode.gain.setTargetAtTime(boostLinear, t, 0.01);
  }
}

/**
 * Renders the audio buffer offline to achieve pristine, click-free rendering.
 */
export async function processMasteringOffline(
  inputBuffer: AudioBuffer,
  settings: MasteringSettings,
  inputPeak: number,
  onProgress: (stage: 'analyzing' | 'eq_compression' | 'stereo_widening' | 'limiting' | 'completed') => void
): Promise<AudioBuffer> {
  
  // Create offline context
  const offlineCtx = new OfflineAudioContext(
    inputBuffer.numberOfChannels,
    inputBuffer.length,
    inputBuffer.sampleRate
  );
  
  // Stage 1: Analyze
  onProgress('analyzing');
  await new Promise((resolve) => setTimeout(resolve, 500)); // allow UI update
  
  // Create Source
  const sourceNode = offlineCtx.createBufferSource();
  sourceNode.buffer = inputBuffer;
  
  // Instantiate mastering DSP graph
  onProgress('eq_compression');
  const dsp = new MasteringDSPGraph(offlineCtx, sourceNode);
  dsp.updateSettings(settings, inputPeak);
  
  // Connect master DSP output to offline context target
  dsp.outputNode.connect(offlineCtx.destination);
  
  // Start play
  sourceNode.start(0);
  
  onProgress('stereo_widening');
  await new Promise((resolve) => setTimeout(resolve, 300));
  
  onProgress('limiting');
  // Run offline rendering
  const renderedBuffer = await offlineCtx.startRendering();
  
  onProgress('completed');
  return renderedBuffer;
}
