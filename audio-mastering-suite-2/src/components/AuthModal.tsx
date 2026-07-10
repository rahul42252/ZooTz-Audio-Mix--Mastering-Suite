import React, { useState } from 'react';
import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential
} from '../lib/firebase';
import { Sparkles, Mail, Lock, X, LogIn, UserPlus, AlertCircle, Loader2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      let errMsg = 'Authentication failed. Please check your inputs.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errMsg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'This email is already registered.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'Password must be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Please enter a valid email address.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/85 backdrop-blur-sm animate-fade-in">
      <div 
        id="auth-modal-content"
        className="relative w-full max-w-md bg-[#0c0c0d] border border-zinc-900 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Text */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400 mb-2">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-100">
            {isRegister ? 'Create Studio Account' : 'Welcome to Mastering Suite'}
          </h3>
          <p className="text-zinc-400 text-xs max-w-xs mx-auto leading-relaxed">
            {isRegister 
              ? 'Join our studio to save presets, track historic mixdowns, and manage processed masters.' 
              : 'Log in to access your cloud studio mix history and customized mastering parameters.'}
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start space-x-2.5 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-600" />
              <input
                type="email"
                required
                placeholder="producer@studio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#121214] border border-zinc-800 focus:border-emerald-500/50 text-zinc-200 pl-11 pr-4 py-3 rounded-xl text-sm transition-all focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-600" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#121214] border border-zinc-800 focus:border-emerald-500/50 text-zinc-200 pl-11 pr-4 py-3 rounded-xl text-sm transition-all focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-semibold rounded-xl text-sm shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isRegister ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Log In</span>
              </>
            )}
          </button>
        </form>

        {/* Bottom Toggle */}
        <div className="text-center pt-2 border-t border-zinc-900/60">
          <p className="text-xs text-zinc-500">
            {isRegister ? 'Already have an account?' : 'New to Mastering Suite?'}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="text-emerald-400 font-medium hover:text-emerald-300 ml-1.5 focus:outline-none cursor-pointer"
            >
              {isRegister ? 'Log In' : 'Sign Up Free'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
