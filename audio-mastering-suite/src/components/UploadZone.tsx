import React, { useState, useRef } from 'react';
import { Upload, FileAudio, AlertCircle } from 'lucide-react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export default function UploadZone({ onFileSelect, isProcessing }: UploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const validateAndSelectFile = (file: File) => {
    setError(null);
    const validTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav', 'audio/x-m4a', 'audio/m4a'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    const isValidType = validTypes.includes(file.type) || ['wav', 'mp3', 'm4a'].includes(fileExtension || '');
    
    if (!isValidType) {
      setError('Unsupported file format. Please upload an unmixed stereo WAV or MP3 track.');
      return;
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      setError('File is too large. Please upload an unmixed track under 100MB.');
      return;
    }

    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        id="audio-upload-dropzone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={isProcessing ? undefined : onButtonClick}
        className={`relative flex flex-col items-center justify-center min-h-[260px] p-8 border-2 border-dashed rounded-2xl transition-all duration-300 ${
          isProcessing ? 'pointer-events-none opacity-50 bg-[#161618]/30 border-zinc-800' : 'cursor-pointer'
        } ${
          isDragActive
            ? 'border-emerald-500/70 bg-emerald-500/5 text-emerald-400 scale-[0.99] shadow-[0_0_20px_rgba(16,185,129,0.05)]'
            : 'border-zinc-800 bg-[#0d0d0e] hover:border-zinc-700 hover:bg-[#121214]/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".wav,.mp3,.m4a"
          onChange={handleChange}
          disabled={isProcessing}
        />

        <div className="flex flex-col items-center text-center space-y-4 max-w-md">
          <div className={`p-4 rounded-full transition-colors duration-300 ${
            isDragActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-900 text-zinc-400'
          }`}>
            <Upload className="w-10 h-10 animate-pulse" />
          </div>

          <div className="space-y-1">
            <h3 className="text-zinc-200 font-medium text-lg tracking-tight">
              Upload your unmixed stereo bounce
            </h3>
            <p className="text-zinc-400 text-sm">
              Drag and drop your audio file, or click to browse
            </p>
          </div>

          <div className="flex items-center space-x-4 pt-2 text-xs text-zinc-500">
            <span className="flex items-center">
              <FileAudio className="w-3.5 h-3.5 mr-1" />
              WAV / MP3
            </span>
            <span>•</span>
            <span>Up to 100 MB</span>
            <span>•</span>
            <span>Optimal headroom: -6dB</span>
          </div>
        </div>
      </div>

      {error && (
        <div id="upload-error" className="mt-4 flex items-start space-x-2 p-3 bg-red-950/25 border border-red-900/30 text-red-400 rounded-xl text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
