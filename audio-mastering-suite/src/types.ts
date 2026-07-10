export type MasteringLoudness = 'streaming' | 'club' | 'cd';
export type MasteringCharacter = 'warm' | 'bright' | 'balanced';
export type ProcessingMode = 'mix' | 'master' | 'both';

export interface MasteringSettings {
  processingMode: ProcessingMode;
  loudness: MasteringLoudness;
  character: MasteringCharacter;
  saturationDrive: number; // 1.0 to 4.0
  stereoWidth: number;      // 1.0 to 2.0
  lowCutFrequency: number;  // 20Hz to 80Hz
  muddyCutDb: number;       // -6dB to 0dB
  eqGain: number;           // -12dB to +12dB
  eqFreq: number;           // 100Hz to 8000Hz
  compressorThreshold: number; // -40dB to 0dB
  compressorRatio: number;     // 1.0 to 10.0
  lowCutEnabled: boolean;
  muddyCutEnabled: boolean;
  eqEnabled: boolean;
  compressorEnabled: boolean;
  saturationEnabled: boolean;
  stereoWidthEnabled: boolean;
  masterBypass: boolean;
}

export type ProcessingStage = 
  | 'idle'
  | 'analyzing'
  | 'eq_compression'
  | 'stereo_widening'
  | 'limiting'
  | 'completed'
  | 'failed';

export interface StageInfo {
  label: string;
  description: string;
  percentage: number;
}

export const STAGES: Record<ProcessingStage, StageInfo> = {
  idle: {
    label: 'Ready',
    description: 'Load an unmixed track to begin.',
    percentage: 0
  },
  analyzing: {
    label: 'Analyzing Audio Dynamics',
    description: 'Calculating RMS energy, crest factor, and frequency spectrum distribution...',
    percentage: 15
  },
  eq_compression: {
    label: 'Applying Corrective EQ & Glue Compression',
    description: 'Removing 200Hz mud, shaping brightness, and binding dynamic ranges together...',
    percentage: 45
  },
  stereo_widening: {
    label: 'Stereo Widening & Harmonic Excitation',
    description: 'Centering bass frequencies, widening high-end side channels, and driving warmth...',
    percentage: 75
  },
  limiting: {
    label: 'Maximizing Loudness & True Peak Limiting',
    description: 'Driving overall gain to target LUFS level and clipping peaks smoothly with lookahead...',
    percentage: 95
  },
  completed: {
    label: 'Mastering Completed',
    description: 'Industry-ready master is ready for A/B testing and download.',
    percentage: 100
  },
  failed: {
    label: 'Mastering Failed',
    description: 'An error occurred during audio processing. Please try another file.',
    percentage: 0
  }
};
