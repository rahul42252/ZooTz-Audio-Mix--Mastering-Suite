import React from 'react';
import { MasteringSettings, MasteringLoudness, MasteringCharacter, ProcessingMode } from '../types';
import { Sparkles, Sliders, Volume2, ShieldCheck, Flame, Layers, Radio, Activity } from 'lucide-react';
import { PRESETS } from '../utils/presets';

const presetIcons: Record<string, React.ComponentType<any>> = {
  Sparkles,
  Flame,
  Volume2,
  Layers,
  ShieldCheck
};

interface MasteringControlsProps {
  settings: MasteringSettings;
  onChange: (settings: MasteringSettings) => void;
  disabled: boolean;
}

export default function MasteringControls({ settings, onChange, disabled }: MasteringControlsProps) {
  const updateSetting = <K extends keyof MasteringSettings>(key: K, value: MasteringSettings[K]) => {
    onChange({
      ...settings,
      [key]: value
    });
  };

  const loudnessTargets: { value: MasteringLoudness; label: string; lufs: string; desc: string }[] = [
    { value: 'streaming', label: 'Streaming', lufs: '-14 LUFS', desc: 'YouTube, Spotify, Apple' },
    { value: 'club', label: 'Club / Heavy', lufs: '-9 LUFS', desc: 'SoundCloud, DJ Systems' },
    { value: 'cd', label: 'CD / Standard', lufs: '-7 LUFS', desc: 'High-energy physical release' }
  ];

  const characterOptions: { value: MasteringCharacter; label: string; desc: string; color: string }[] = [
    { value: 'warm', label: 'Warm & Analog', desc: 'Tube saturation, smooth transients', color: 'from-amber-500/20 to-orange-500/10 text-orange-400 border-orange-500/30' },
    { value: 'balanced', label: 'Balanced', desc: 'Transparent dynamic control', color: 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30' },
    { value: 'bright', label: 'Bright & Airy', desc: 'Excited highs, vocal air boost', color: 'from-sky-500/20 to-indigo-500/10 text-sky-400 border-sky-500/30' }
  ];

  const processingModes: { value: ProcessingMode; label: string; desc: string; dspInfo: string; badge: string; badgeColor: string }[] = [
    { 
      value: 'mix', 
      label: 'Mix Only', 
      desc: 'Sculpts sound & balance', 
      dspInfo: 'Corrective EQ, user EQ, Compression, and Saturation are active. Haas Stereo Width and Limiter loudness driver are automatically bypassed to preserve dynamic mix headroom.',
      badge: 'Mixer Clean',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    },
    { 
      value: 'master', 
      label: 'Master Only', 
      desc: 'Brings volume & width', 
      dspInfo: 'Compression, Saturation, Character Shelf, Stereo Width, and Limiter loudness are active. Corrective low-cut and mud-cut filters are automatically bypassed.',
      badge: 'Master Polish',
      badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
    },
    { 
      value: 'both', 
      label: 'Mix & Master', 
      desc: 'Complete dual chain', 
      dspInfo: 'The ultimate professional dual-stage pipeline. Corrective EQs clean the boxiness, compressor glues the track, stereo delays widen, and limiter maximizes output level.',
      badge: 'All In One',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    }
  ];

  const isMasterBypassed = settings.masterBypass === true;
  const isLoudnessBypassed = settings.processingMode === 'mix' || isMasterBypassed;
  const isCharacterBypassed = settings.processingMode === 'mix' || isMasterBypassed;
  const isSaturationActive = settings.saturationEnabled && !isMasterBypassed;
  const isStereoActive = settings.stereoWidthEnabled && settings.processingMode !== 'mix' && !isMasterBypassed;
  const isLowCutActive = settings.lowCutEnabled && settings.processingMode !== 'master' && !isMasterBypassed;
  const isMuddyCutActive = settings.muddyCutEnabled && settings.processingMode !== 'master' && !isMasterBypassed;
  const isEqActive = settings.eqEnabled && settings.processingMode !== 'master' && !isMasterBypassed;
  const isCompressorActive = settings.compressorEnabled && !isMasterBypassed;

  return (
    <div className="space-y-6">
      {/* Workstation Processing Mode Selector */}
      <div className="bg-[#0e0e10] border border-zinc-900 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center space-x-2 text-zinc-300 font-medium tracking-tight">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h4 className="text-sm uppercase font-mono tracking-wider">Processing Workstation Mode</h4>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
            Signal Path
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {processingModes.map((mode) => (
            <button
              key={mode.value}
              id={`mode-toggle-${mode.value}`}
              disabled={disabled}
              onClick={() => updateSetting('processingMode', mode.value)}
              className={`flex flex-col text-left p-3.5 rounded-xl border transition-all duration-300 relative group overflow-hidden ${
                settings.processingMode === mode.value
                  ? 'bg-gradient-to-b from-indigo-500/10 to-purple-500/5 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.04)]'
                  : 'bg-[#121214] border-zinc-800/80 hover:border-zinc-700/80'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className={`text-xs font-bold ${settings.processingMode === mode.value ? 'text-indigo-400' : 'text-zinc-300'}`}>
                  {mode.label}
                </span>
                <span className={`text-[8px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded border uppercase ${mode.badgeColor}`}>
                  {mode.badge}
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 leading-tight block">{mode.desc}</span>
              <p className="text-[9px] text-zinc-600 mt-2 border-t border-zinc-900/40 pt-2 leading-relaxed transition-colors group-hover:text-zinc-500">
                {mode.dspInfo}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Preset Selector */}
      <div className="bg-[#0e0e10] border border-zinc-900 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-zinc-300 font-medium tracking-tight">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h4 className="text-sm uppercase font-mono tracking-wider">Acoustic Mastering Presets</h4>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 uppercase">
            5 Professional Genres
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {PRESETS.map((preset) => {
            const IconComponent = presetIcons[preset.icon] || Sparkles;
            
            // Determine if active by matching settings parameters
            const isActive = 
              settings.loudness === preset.settings.loudness &&
              settings.character === preset.settings.character &&
              Math.abs(settings.saturationDrive - preset.settings.saturationDrive) < 0.05 &&
              Math.abs(settings.stereoWidth - preset.settings.stereoWidth) < 0.05 &&
              settings.lowCutFrequency === preset.settings.lowCutFrequency &&
              Math.abs(settings.muddyCutDb - preset.settings.muddyCutDb) < 0.05 &&
              Math.abs(settings.eqGain - preset.settings.eqGain) < 0.05 &&
              settings.eqFreq === preset.settings.eqFreq &&
              settings.compressorThreshold === preset.settings.compressorThreshold &&
              Math.abs(settings.compressorRatio - preset.settings.compressorRatio) < 0.05;

            return (
              <button
                key={preset.id}
                id={`preset-btn-${preset.id}`}
                disabled={disabled}
                onClick={() => onChange(preset.settings)}
                className={`flex flex-col items-center text-center p-3.5 rounded-xl border transition-all duration-300 group ${
                  isActive
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.05)]'
                    : 'bg-[#121214] border-zinc-800/80 hover:border-zinc-700/80 text-zinc-400 hover:text-zinc-200'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                title={preset.description}
              >
                <IconComponent className={`w-5 h-5 mb-2 transition-transform duration-300 ${isActive ? 'scale-110 text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                <span className="text-xs font-semibold tracking-tight block truncate w-full">
                  {preset.name}
                </span>
                <span className="text-[9px] text-zinc-600 mt-1 line-clamp-1 group-hover:text-zinc-500">
                  {preset.settings.loudness.toUpperCase()} • {preset.settings.character}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Loudness Zone */}
      <div className={`bg-[#0e0e10] border rounded-2xl p-5 space-y-4 shadow-sm transition-all duration-300 ${isLoudnessBypassed ? 'opacity-40 border-zinc-900/60' : 'border-zinc-900'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-zinc-300 font-medium tracking-tight">
            <Volume2 className="w-5 h-5 text-emerald-500" />
            <h4 className="text-sm uppercase font-mono tracking-wider">Target Mastering Loudness</h4>
          </div>
          {isLoudnessBypassed && (
            <span className="text-[9px] font-mono font-bold text-amber-500/90 uppercase tracking-widest bg-amber-500/5 px-2.5 py-1 rounded border border-amber-500/20">
              Bypassed in Mix Only
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {loudnessTargets.map((target) => (
            <button
              key={target.value}
              id={`loudness-toggle-${target.value}`}
              disabled={disabled || isLoudnessBypassed}
              onClick={() => updateSetting('loudness', target.value)}
              className={`flex flex-col text-left p-4 rounded-xl border transition-all duration-300 ${
                !isLoudnessBypassed && settings.loudness === target.value
                  ? 'bg-emerald-500/5 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.03)]'
                  : 'bg-[#121214] border-zinc-800/80 hover:border-zinc-700/80'
              } ${disabled || isLoudnessBypassed ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="flex items-center justify-between w-full">
                <span className={`text-sm font-semibold ${!isLoudnessBypassed && settings.loudness === target.value ? 'text-emerald-400' : 'text-zinc-300'}`}>
                  {target.label}
                </span>
                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                  {target.lufs}
                </span>
              </span>
              <span className="text-xs text-zinc-500 mt-1.5 leading-relaxed">{target.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mastering Character Color Options */}
      <div className={`bg-[#0e0e10] border rounded-2xl p-5 space-y-4 transition-all duration-300 ${isCharacterBypassed ? 'opacity-40 border-zinc-900/60' : 'border-zinc-900'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-zinc-300 font-medium tracking-tight">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h4 className="text-sm uppercase font-mono tracking-wider">Acoustic Tone & Character</h4>
          </div>
          {isCharacterBypassed && (
            <span className="text-[9px] font-mono font-bold text-amber-500/90 uppercase tracking-widest bg-amber-500/5 px-2.5 py-1 rounded border border-amber-500/20">
              Bypassed in Mix Only
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {characterOptions.map((char) => (
            <button
              key={char.value}
              id={`character-toggle-${char.value}`}
              disabled={disabled || isCharacterBypassed}
              onClick={() => updateSetting('character', char.value)}
              className={`flex flex-col text-left p-4 rounded-xl border transition-all duration-300 ${
                !isCharacterBypassed && settings.character === char.value
                  ? `bg-gradient-to-b ${char.color}`
                  : 'bg-[#121214] border-zinc-800/80 hover:border-zinc-700/80 text-zinc-400 hover:text-zinc-300'
              } ${disabled || isCharacterBypassed ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={`text-sm font-semibold ${!isCharacterBypassed && settings.character === char.value ? 'text-inherit' : 'text-zinc-300'}`}>
                {char.label}
              </span>
              <span className="text-xs text-zinc-500 mt-1.5 leading-relaxed">{char.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Rack Slider Panel */}
      <div className="bg-[#0e0e10] border border-zinc-900 rounded-2xl p-5 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
          <div className="flex items-center space-x-2 text-zinc-300 font-medium tracking-tight">
            <Sliders className="w-5 h-5 text-indigo-500" />
            <h4 className="text-sm uppercase font-mono tracking-wider">Rack Settings (Fine Tuning)</h4>
          </div>
          <button
            id="toggle-master-bypass"
            disabled={disabled}
            onClick={() => updateSetting('masterBypass', !settings.masterBypass)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
              settings.masterBypass
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-300 hover:border-zinc-700'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={settings.masterBypass ? 'Engage Processing Chain' : 'Bypass All FX Rack Processing'}
          >
            <span className={`w-2 h-2 rounded-full ${settings.masterBypass ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span>Master Bypass: {settings.masterBypass ? 'ON' : 'OFF'}</span>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
          {/* Tape Saturation */}
          <div className={`space-y-3 p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl transition-all duration-300 ${!isSaturationActive ? 'opacity-40' : 'border-amber-500/10'}`}>
            <div className="flex justify-between items-center text-xs pb-1.5 border-b border-zinc-900/60">
              <span className="flex items-center text-zinc-400 font-mono uppercase tracking-wider">
                <button
                  id="toggle-saturation"
                  disabled={disabled || isMasterBypassed}
                  onClick={() => updateSetting('saturationEnabled', !settings.saturationEnabled)}
                  className={`mr-2 flex items-center justify-center px-1.5 py-0.5 rounded-md border transition-all cursor-pointer ${
                    isSaturationActive
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                  }`}
                  title={isMasterBypassed ? 'Locked in Master Bypass mode' : settings.saturationEnabled ? 'Bypass Tape Saturation' : 'Enable Tape Saturation'}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isSaturationActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}></span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {isMasterBypassed ? 'AUTO BYP' : settings.saturationEnabled ? 'ON' : 'BYP'}
                  </span>
                </button>
                <Flame className={`w-3.5 h-3.5 mr-1.5 ${isSaturationActive ? 'text-orange-500' : 'text-zinc-600'}`} />
                Tape Saturation
              </span>
              <span className={`font-mono text-sm font-semibold ${isSaturationActive ? 'text-amber-500' : 'text-zinc-600'}`}>
                {!isSaturationActive ? (isMasterBypassed ? 'Auto Bypassed' : 'Bypassed') : `${((settings.saturationDrive - 1) * 33).toFixed(0)}% Drive`}
              </span>
            </div>
            <input
              id="slider-saturation"
              type="range"
              min="1.0"
              max="4.0"
              step="0.1"
              value={settings.saturationDrive}
              disabled={disabled || !isSaturationActive}
              onChange={(e) => updateSetting('saturationDrive', parseFloat(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
            />
            <p className="text-[10px] text-zinc-500">Adds rich even/odd harmonics, rounding off peaks with warm tape soft clipping.</p>
          </div>

          {/* Stereo Width */}
          <div className={`space-y-3 p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl transition-all duration-300 ${!isStereoActive ? 'opacity-40' : 'border-sky-500/10'}`}>
            <div className="flex justify-between items-center text-xs pb-1.5 border-b border-zinc-900/60">
              <span className="flex items-center text-zinc-400 font-mono uppercase tracking-wider">
                <button
                  id="toggle-stereo-width"
                  disabled={disabled || settings.processingMode === 'mix' || isMasterBypassed}
                  onClick={() => updateSetting('stereoWidthEnabled', !settings.stereoWidthEnabled)}
                  className={`mr-2 flex items-center justify-center px-1.5 py-0.5 rounded-md border transition-all cursor-pointer ${
                    isStereoActive
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                  }`}
                  title={isMasterBypassed ? 'Locked in Master Bypass mode' : settings.processingMode === 'mix' ? 'Locked in Mix Only mode' : isStereoActive ? 'Bypass Stereo Width' : 'Enable Stereo Width'}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isStereoActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}></span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {isMasterBypassed ? 'AUTO BYP' : settings.processingMode === 'mix' ? 'AUTO BYP' : settings.stereoWidthEnabled ? 'ON' : 'BYP'}
                  </span>
                </button>
                <Layers className={`w-3.5 h-3.5 mr-1.5 ${isStereoActive ? 'text-sky-500' : 'text-zinc-600'}`} />
                Stereo Width
              </span>
              <span className={`font-mono text-sm font-semibold ${isStereoActive ? 'text-sky-500' : 'text-zinc-600'}`}>
                {!isStereoActive ? (settings.processingMode === 'mix' ? 'Auto Bypassed' : 'Bypassed') : settings.stereoWidth === 1.0 ? 'Mono Keep' : `+${((settings.stereoWidth - 1) * 100).toFixed(0)}% Wide`}
              </span>
            </div>
            <input
              id="slider-stereo-width"
              type="range"
              min="1.0"
              max="2.0"
              step="0.05"
              value={settings.stereoWidth}
              disabled={disabled || !isStereoActive}
              onChange={(e) => updateSetting('stereoWidth', parseFloat(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-500 focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
            />
            <p className="text-[10px] text-zinc-500">Applies high-frequency side-channel Haas expansion while maintaining solid mono sub-bass.</p>
          </div>
 
          {/* Corrective Low Cut Filter */}
          <div className={`space-y-3 p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl transition-all duration-300 ${!isLowCutActive ? 'opacity-40' : 'border-red-500/10'}`}>
            <div className="flex justify-between items-center text-xs pb-1.5 border-b border-zinc-900/60">
              <span className="flex items-center text-zinc-400 font-mono uppercase tracking-wider">
                <button
                  id="toggle-low-cut"
                  disabled={disabled || settings.processingMode === 'master' || isMasterBypassed}
                  onClick={() => updateSetting('lowCutEnabled', !settings.lowCutEnabled)}
                  className={`mr-2 flex items-center justify-center px-1.5 py-0.5 rounded-md border transition-all cursor-pointer ${
                    isLowCutActive
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                  }`}
                  title={isMasterBypassed ? 'Locked in Master Bypass mode' : settings.processingMode === 'master' ? 'Locked in Master Only mode' : isLowCutActive ? 'Bypass Low Cut Filter' : 'Enable Low Cut Filter'}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isLowCutActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}></span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {isMasterBypassed ? 'AUTO BYP' : settings.processingMode === 'master' ? 'AUTO BYP' : settings.lowCutEnabled ? 'ON' : 'BYP'}
                  </span>
                </button>
                <ShieldCheck className={`w-3.5 h-3.5 mr-1.5 ${isLowCutActive ? 'text-red-500' : 'text-zinc-600'}`} />
                Sub-bass Rumble Filter
              </span>
              <span className={`font-mono text-sm font-semibold ${isLowCutActive ? 'text-red-500' : 'text-zinc-600'}`}>
                {!isLowCutActive ? (settings.processingMode === 'master' ? 'Auto Bypassed' : 'Bypassed') : `${settings.lowCutFrequency} Hz`}
              </span>
            </div>
            <input
              id="slider-low-cut"
              type="range"
              min="20"
              max="80"
              step="5"
              value={settings.lowCutFrequency}
              disabled={disabled || !isLowCutActive}
              onChange={(e) => updateSetting('lowCutFrequency', parseInt(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-500 focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
            />
            <p className="text-[10px] text-zinc-500">Filters out ultra-low non-audible frequencies below the cutoff to clear up overall amplifier headroom.</p>
          </div>
 
          {/* Mud Cut dB */}
          <div className={`space-y-3 p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl transition-all duration-300 ${!isMuddyCutActive ? 'opacity-40' : 'border-zinc-500/10'}`}>
            <div className="flex justify-between items-center text-xs pb-1.5 border-b border-zinc-900/60">
              <span className="flex items-center text-zinc-400 font-mono uppercase tracking-wider">
                <button
                  id="toggle-mud-cut"
                  disabled={disabled || settings.processingMode === 'master' || isMasterBypassed}
                  onClick={() => updateSetting('muddyCutEnabled', !settings.muddyCutEnabled)}
                  className={`mr-2 flex items-center justify-center px-1.5 py-0.5 rounded-md border transition-all cursor-pointer ${
                    isMuddyCutActive
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                  }`}
                  title={isMasterBypassed ? 'Locked in Master Bypass mode' : settings.processingMode === 'master' ? 'Locked in Master Only mode' : isMuddyCutActive ? 'Bypass Mud Cut' : 'Enable Mud Cut'}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isMuddyCutActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}></span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {isMasterBypassed ? 'AUTO BYP' : settings.processingMode === 'master' ? 'AUTO BYP' : settings.muddyCutEnabled ? 'ON' : 'BYP'}
                  </span>
                </button>
                <Sliders className={`w-3.5 h-3.5 mr-1.5 ${isMuddyCutActive ? 'text-zinc-400' : 'text-zinc-600'}`} />
                Low-Mid Mud Cut (220 Hz)
              </span>
              <span className={`font-mono text-sm font-semibold ${isMuddyCutActive ? 'text-zinc-300' : 'text-zinc-600'}`}>
                {!isMuddyCutActive ? (settings.processingMode === 'master' ? 'Auto Bypassed' : 'Bypassed') : `${settings.muddyCutDb.toFixed(1)} dB`}
              </span>
            </div>
            <input
              id="slider-mud-cut"
              type="range"
              min="-6.0"
              max="0.0"
              step="0.5"
              value={settings.muddyCutDb}
              disabled={disabled || !isMuddyCutActive}
              onChange={(e) => updateSetting('muddyCutDb', parseFloat(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-500 focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
            />
            <p className="text-[10px] text-zinc-500">Cuts the muddy, boxy low-mid buildup typical in unmixed stereo tracks for a cleaner, modern sound.</p>
          </div>
 
          {/* Parametric EQ Module */}
          <div className={`space-y-4 md:col-span-2 p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl transition-all duration-300 ${!isEqActive ? 'opacity-40' : 'border-emerald-500/15'}`}>
            <div className="flex justify-between items-center text-xs border-b border-zinc-900/60 pb-2">
              <span className="flex items-center text-zinc-400 font-mono uppercase tracking-wider">
                <button
                  id="toggle-eq"
                  disabled={disabled || settings.processingMode === 'master' || isMasterBypassed}
                  onClick={() => updateSetting('eqEnabled', !settings.eqEnabled)}
                  className={`mr-2 flex items-center justify-center px-1.5 py-0.5 rounded-md border transition-all cursor-pointer ${
                    isEqActive
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                  }`}
                  title={isMasterBypassed ? 'Locked in Master Bypass mode' : settings.processingMode === 'master' ? 'Locked in Master Only mode' : isEqActive ? 'Bypass Parametric EQ' : 'Enable Parametric EQ'}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isEqActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}></span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {isMasterBypassed ? 'AUTO BYP' : settings.processingMode === 'master' ? 'AUTO BYP' : settings.eqEnabled ? 'ON' : 'BYP'}
                  </span>
                </button>
                <Sliders className={`w-3.5 h-3.5 mr-1.5 ${isEqActive ? 'text-emerald-400' : 'text-zinc-600'}`} />
                Parametric EQ Module
              </span>
              <span className={`font-mono text-xs ${isEqActive ? 'text-emerald-400' : 'text-zinc-600'}`}>
                {!isEqActive ? (settings.processingMode === 'master' ? 'Auto Bypassed' : 'Bypassed') : `${settings.eqGain > 0 ? `+${settings.eqGain.toFixed(1)}` : settings.eqGain.toFixed(1)} dB @ ${settings.eqFreq >= 1000 ? `${(settings.eqFreq / 1000).toFixed(2)} kHz` : `${settings.eqFreq} Hz`}`}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* EQ Gain */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-mono">
                  <span>EQ Gain</span>
                  <span className={isEqActive ? 'text-zinc-300 font-medium' : ''}>{settings.eqGain > 0 ? `+${settings.eqGain.toFixed(1)}` : settings.eqGain.toFixed(1)} dB</span>
                </div>
                <input
                  id="slider-eq-gain"
                  type="range"
                  min="-12.0"
                  max="12.0"
                  step="0.5"
                  value={settings.eqGain}
                  disabled={disabled || !isEqActive}
                  onChange={(e) => updateSetting('eqGain', parseFloat(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
                />
              </div>
 
              {/* EQ Frequency */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-mono">
                  <span>EQ Frequency</span>
                  <span className={isEqActive ? 'text-zinc-300 font-medium' : ''}>{settings.eqFreq >= 1000 ? `${(settings.eqFreq / 1000).toFixed(2)} kHz` : `${settings.eqFreq} Hz`}</span>
                </div>
                <input
                  id="slider-eq-freq"
                  type="range"
                  min="100"
                  max="8000"
                  step="50"
                  value={settings.eqFreq}
                  disabled={disabled || !isEqActive}
                  onChange={(e) => updateSetting('eqFreq', parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <p className="text-[10px] text-zinc-500">Boosts or cuts target frequencies to shape lead instruments or vocals on the fly.</p>
          </div>
          {/* Glue Compressor Module */}
          <div className={`space-y-4 md:col-span-2 p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl transition-all duration-300 ${!isCompressorActive ? 'opacity-40' : 'border-indigo-500/15'}`}>
            <div className="flex justify-between items-center text-xs border-b border-zinc-900/60 pb-2">
              <span className="flex items-center text-zinc-400 font-mono uppercase tracking-wider">
                <button
                  id="toggle-compressor"
                  disabled={disabled || isMasterBypassed}
                  onClick={() => updateSetting('compressorEnabled', !settings.compressorEnabled)}
                  className={`mr-2 flex items-center justify-center px-1.5 py-0.5 rounded-md border transition-all cursor-pointer ${
                    isCompressorActive
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                  }`}
                  title={isMasterBypassed ? 'Locked in Master Bypass mode' : settings.compressorEnabled ? 'Bypass Glue Compressor' : 'Enable Glue Compressor'}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isCompressorActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}></span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {isMasterBypassed ? 'AUTO BYP' : settings.compressorEnabled ? 'ON' : 'BYP'}
                  </span>
                </button>
                <Sliders className={`w-3.5 h-3.5 mr-1.5 ${isCompressorActive ? 'text-indigo-400' : 'text-zinc-600'}`} />
                Glue Compressor Module
              </span>
              <span className={`font-mono text-xs ${isCompressorActive ? 'text-indigo-400' : 'text-zinc-600'}`}>
                {!isCompressorActive ? (isMasterBypassed ? 'Auto Bypassed' : 'Bypassed') : `${settings.compressorThreshold.toFixed(0)} dB @ ${settings.compressorRatio.toFixed(1)}:1`}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Threshold */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-mono">
                  <span>Threshold</span>
                  <span className={isCompressorActive ? 'text-zinc-300 font-medium' : ''}>{settings.compressorThreshold.toFixed(0)} dB</span>
                </div>
                <input
                  id="slider-compressor-threshold"
                  type="range"
                  min="-40"
                  max="0"
                  step="1"
                  value={settings.compressorThreshold}
                  disabled={disabled || !isCompressorActive}
                  onChange={(e) => updateSetting('compressorThreshold', parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
                />
              </div>

              {/* Ratio */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-mono">
                  <span>Ratio</span>
                  <span className={isCompressorActive ? 'text-zinc-300 font-medium' : ''}>{settings.compressorRatio.toFixed(1)}:1</span>
                </div>
                <input
                  id="slider-compressor-ratio"
                  type="range"
                  min="1.0"
                  max="10.0"
                  step="0.1"
                  value={settings.compressorRatio}
                  disabled={disabled || !isCompressorActive}
                  onChange={(e) => updateSetting('compressorRatio', parseFloat(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <p className="text-[10px] text-zinc-500">Sets the level at which the glue compressor begins acting. Lower threshold means more compression.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
