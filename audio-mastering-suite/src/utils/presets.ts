import { MasteringSettings } from '../types';

export interface Preset {
  id: string;
  name: string;
  description: string;
  settings: MasteringSettings;
  icon: string; // To help style the buttons nicely
}

export const PRESETS: Preset[] = [
  {
    id: 'pop-bright',
    name: 'Pop Bright',
    description: 'Brings vocals forward with excited air, subtle sub-bass lift, and standard radio loudness.',
    icon: 'Sparkles',
    settings: {
      processingMode: 'both',
      loudness: 'cd',
      character: 'bright',
      saturationDrive: 1.8,
      stereoWidth: 1.35,
      lowCutFrequency: 35,
      muddyCutDb: -1.5,
      eqGain: 1.8,
      eqFreq: 4500,
      compressorThreshold: -15.0,
      compressorRatio: 2.0,
      lowCutEnabled: true,
      muddyCutEnabled: true,
      eqEnabled: true,
      compressorEnabled: true,
      saturationEnabled: true,
      stereoWidthEnabled: true,
      masterBypass: false
    }
  },
  {
    id: 'rock-punchy',
    name: 'Rock Punchy',
    description: 'Drives warm analog saturation, shapes heavy mids, and tightens dynamic control for high impact.',
    icon: 'Flame',
    settings: {
      processingMode: 'both',
      loudness: 'club',
      character: 'balanced',
      saturationDrive: 2.6,
      stereoWidth: 1.25,
      lowCutFrequency: 40,
      muddyCutDb: -3.0,
      eqGain: -2.0,
      eqFreq: 400,
      compressorThreshold: -22.0,
      compressorRatio: 3.0,
      lowCutEnabled: true,
      muddyCutEnabled: true,
      eqEnabled: true,
      compressorEnabled: true,
      saturationEnabled: true,
      stereoWidthEnabled: true,
      masterBypass: false
    }
  },
  {
    id: 'jazz-warm',
    name: 'Jazz Warm',
    description: 'Smooth, subtle compression, warm tube-style rounding, and natural organic acoustics.',
    icon: 'Volume2',
    settings: {
      processingMode: 'both',
      loudness: 'streaming',
      character: 'warm',
      saturationDrive: 2.0,
      stereoWidth: 1.1,
      lowCutFrequency: 20,
      muddyCutDb: -0.5,
      eqGain: 1.2,
      eqFreq: 250,
      compressorThreshold: -12.0,
      compressorRatio: 1.5,
      lowCutEnabled: true,
      muddyCutEnabled: true,
      eqEnabled: true,
      compressorEnabled: true,
      saturationEnabled: true,
      stereoWidthEnabled: true,
      masterBypass: false
    }
  },
  {
    id: 'electronic-dance',
    name: 'Electronic Dance',
    description: 'Aggressive sub-bass rumble cut to clear headroom, wide stereo Haas field, and maximum club volume.',
    icon: 'Layers',
    settings: {
      processingMode: 'both',
      loudness: 'club',
      character: 'bright',
      saturationDrive: 2.2,
      stereoWidth: 1.6,
      lowCutFrequency: 45,
      muddyCutDb: -2.0,
      eqGain: 2.5,
      eqFreq: 6000,
      compressorThreshold: -18.0,
      compressorRatio: 2.5,
      lowCutEnabled: true,
      muddyCutEnabled: true,
      eqEnabled: true,
      compressorEnabled: true,
      saturationEnabled: true,
      stereoWidthEnabled: true,
      masterBypass: false
    }
  },
  {
    id: 'classical-clarity',
    name: 'Classical Clarity',
    description: 'Pristine, transparent signal path. No coloration, wide dynamic range, and extremely natural spacing.',
    icon: 'ShieldCheck',
    settings: {
      processingMode: 'both',
      loudness: 'streaming',
      character: 'balanced',
      saturationDrive: 1.1,
      stereoWidth: 1.15,
      lowCutFrequency: 25,
      muddyCutDb: 0.0,
      eqGain: 0.0,
      eqFreq: 2000,
      compressorThreshold: -8.0,
      compressorRatio: 1.2,
      lowCutEnabled: true,
      muddyCutEnabled: true,
      eqEnabled: true,
      compressorEnabled: true,
      saturationEnabled: true,
      stereoWidthEnabled: true,
      masterBypass: false
    }
  }
];
