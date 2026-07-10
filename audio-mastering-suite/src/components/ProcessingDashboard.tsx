import { STAGES, ProcessingStage } from '../types';
import { Activity, Radio, Cpu, Music, Play, AlertTriangle } from 'lucide-react';

interface ProcessingDashboardProps {
  currentStage: ProcessingStage;
  error?: string | null;
}

export default function ProcessingDashboard({ currentStage, error }: ProcessingDashboardProps) {
  const stageInfo = STAGES[currentStage];
  
  const getIcon = (stage: ProcessingStage) => {
    switch (stage) {
      case 'analyzing':
        return <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />;
      case 'eq_compression':
        return <Radio className="w-5 h-5 text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />;
      case 'stereo_widening':
        return <Cpu className="w-5 h-5 text-sky-400 animate-bounce" />;
      case 'limiting':
        return <Music className="w-5 h-5 text-amber-400 animate-pulse" />;
      case 'completed':
        return <Play className="w-5 h-5 text-emerald-500" />;
      case 'failed':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-zinc-500" />;
    }
  };

  // List of active stages in sequence to render as a list
  const steps: { stage: ProcessingStage; label: string }[] = [
    { stage: 'analyzing', label: 'Analyzing Audio Dynamics' },
    { stage: 'eq_compression', label: 'Applying EQ & Compression' },
    { stage: 'stereo_widening', label: 'Stereo Widening & Harmonic Excitation' },
    { stage: 'limiting', label: 'Limiting & Mastering' }
  ];

  const getStepStatus = (stepStage: ProcessingStage) => {
    const stageSequence: ProcessingStage[] = ['idle', 'analyzing', 'eq_compression', 'stereo_widening', 'limiting', 'completed'];
    const currentIdx = stageSequence.indexOf(currentStage);
    const stepIdx = stageSequence.indexOf(stepStage);
    
    if (currentStage === 'failed') return 'failed';
    if (currentIdx > stepIdx) return 'completed';
    if (currentIdx === stepIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="bg-[#0e0e10] border border-zinc-900 rounded-2xl p-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-zinc-200 text-sm font-semibold tracking-tight flex items-center">
            {getIcon(currentStage)}
            <span className="ml-2 font-mono uppercase text-xs tracking-wider">DSP Mastering Pipeline</span>
          </h4>
          <span className="text-zinc-400 text-xs font-mono">{stageInfo.percentage}%</span>
        </div>
        
        {/* Main Progress Bar */}
        <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
          <div
            id="processing-progress-bar"
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              currentStage === 'failed' ? 'bg-red-500' : 'bg-gradient-to-r from-emerald-500 via-indigo-500 to-sky-500'
            }`}
            style={{ width: `${stageInfo.percentage}%` }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {/* Active Stage Description */}
        <div className="p-4 rounded-xl bg-[#121214] border border-zinc-800/60">
          <h5 className="text-zinc-300 text-sm font-medium">{stageInfo.label}</h5>
          <p className="text-zinc-500 text-xs mt-1.5 leading-relaxed">{stageInfo.description}</p>
          {currentStage === 'failed' && error && (
            <p className="text-red-400 text-xs mt-2 font-mono p-2 bg-red-950/20 rounded border border-red-900/30">
              {error}
            </p>
          )}
        </div>

        {/* Phase List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {steps.map((step) => {
            const status = getStepStatus(step.stage);
            return (
              <div
                key={step.stage}
                className={`flex items-center space-x-3 p-3 rounded-xl border transition-all duration-300 ${
                  status === 'completed'
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400/80'
                    : status === 'active'
                    ? 'bg-indigo-500/5 border-indigo-500/30 text-indigo-300 font-medium scale-[1.01]'
                    : status === 'failed'
                    ? 'bg-red-500/5 border-red-500/20 text-red-400'
                    : 'bg-[#121214]/40 border-zinc-900/50 text-zinc-600'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${
                  status === 'completed'
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                    : status === 'active'
                    ? 'bg-indigo-400 animate-ping'
                    : status === 'failed'
                    ? 'bg-red-500'
                    : 'bg-zinc-800'
                }`} />
                <span className="text-xs font-mono tracking-tight">{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
