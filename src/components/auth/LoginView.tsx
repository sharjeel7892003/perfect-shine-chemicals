import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Building2
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Profile, UserRole } from '../../types';

interface LoginViewProps {
  onLoginSuccess: (user: Profile) => void;
  availableProfiles?: Profile[];
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, availableProfiles = [] }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Forgot Password Modal State
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSentSuccess, setResetSentSuccess] = useState(false);

  // New Password Reset Mode (if URL contains recovery token)
  const [isResetPasswordMode, setIsResetPasswordMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Check URL hash for type=recovery (Supabase password reset redirect)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && (hash.includes('type=recovery') || hash.includes('access_token'))) {
        setIsResetPasswordMode(true);
      }
    }
  }, []);

  // Password Complexity Validation Helper
  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score; // 0 to 5
  };

  const strength = getPasswordStrength(isResetPasswordMode ? newPassword : password);

  // Handle Standard Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    setIsLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        // 1. Authenticate with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: password,
        });

        if (authError) {
          console.error('[Supabase Auth Error]:', authError);
          const rawMsg = authError.message;
          if (rawMsg === '{}' || authError.status === 500) {
            setErrorMessage('Supabase Auth Error (500: Database error querying schema). GoTrue scanner found NULL token fields on auth.users.');
          } else if (rawMsg.includes('Invalid login credentials')) {
            setErrorMessage('Invalid email or password. Please verify your factory credentials.');
          } else if (rawMsg.includes('Email not confirmed')) {
            setErrorMessage('Email address has not been confirmed in Supabase Auth. Please toggle "Auto Confirm" or confirm in Supabase Dashboard.');
          } else {
            setErrorMessage(rawMsg || `Authentication error (${authError.status || 'unknown'})`);
          }
          setIsLoading(false);
          return;
        }

        // 2. Fetch associated user profile safely
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .or(`id.eq.${authData.user.id},email.ilike.${trimmedEmail}`)
          .limit(1);

        const profileData = profiles && profiles.length > 0 ? profiles[0] : null;

        if (profileError || !profileData) {
          // Fallback matching against local profiles
          const matchedLocal = availableProfiles.find(p => p.email.toLowerCase() === trimmedEmail);
          if (matchedLocal) {
            onLoginSuccess(matchedLocal);
            return;
          }
          setErrorMessage('Authenticated successfully with Supabase, but no matching staff profile was found in public.profiles.');
          setIsLoading(false);
          return;
        }

        if (profileData.is_deactivated || !profileData.is_active) {
          await supabase.auth.signOut();
          setErrorMessage('Your staff account has been deactivated. Please contact the factory admin.');
          setIsLoading(false);
          return;
        }

        onLoginSuccess(profileData as Profile);
      } else {
        // Local fallback if Supabase is unconfigured
        const matched = availableProfiles.find(p => p.email.toLowerCase() === trimmedEmail);
        if (matched) {
          onLoginSuccess(matched);
        } else {
          setErrorMessage('No staff account found with this email.');
        }
      }
    } catch (err: any) {
      console.error('[Login Catch Exception]:', err);
      const fallbackMsg = err?.message && err.message !== '{}' 
        ? err.message 
        : (err?.status ? `Authentication server error (${err.status})` : 'Authentication error. Please try again.');
      setErrorMessage(fallbackMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Forgot Password Dispatch
  const handleSendForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setIsSendingReset(true);
    setErrorMessage(null);

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}/#type=recovery`,
        });

        if (error) throw error;
        setResetSentSuccess(true);
      } else {
        setResetSentSuccess(true);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to dispatch password recovery email.');
    } finally {
      setIsSendingReset(false);
    }
  };

  // Handle Setting New Password from Recovery Link
  const handleUpdateNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    setErrorMessage(null);

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;

        setSuccessMessage('Password updated successfully! You can now sign in.');
        setIsResetPasswordMode(false);
        setPassword(newPassword);
        window.location.hash = '';
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Preset Credentials Helper (Quick-fill for factory staff)
  const handleQuickFill = (emailPreset: string) => {
    setEmail(emailPreset);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 font-sans relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Authentication Card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl shadow-black/80 p-6 sm:p-8 relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mb-3.5 shadow-lg shadow-emerald-500/10">
            <img 
              src="/assets/logo.png" 
              alt="Perfect Shine Chemicals" 
              className="w-11 h-11 object-contain drop-shadow" 
            />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Perfect Shine Chemicals</h1>
          <p className="text-xs text-slate-400 mt-1">
            Factory POS & ERP Enterprise Management System
          </p>
        </div>

        {/* Password Reset Mode Banner */}
        {isResetPasswordMode ? (
          <form onSubmit={handleUpdateNewPassword} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
              <div className="font-bold flex items-center gap-1.5 mb-1">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Reset Your Password</span>
              </div>
              <p className="text-[11px] text-amber-300/90">
                Enter your new secure password below to regain access to the factory system.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-black shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUpdatingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span>Save New Password & Sign In</span>
            </button>
          </form>
        ) : (
          /* Standard Sign-In Form */
          <form onSubmit={handleLogin} className="space-y-4">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <p className="font-semibold">{errorMessage}</p>
                  <p className="text-[10px] text-rose-400/80 mt-0.5">Please check credentials or contact system administrator.</p>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-400" />
                <span>Staff Email Address</span>
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. sharjeel.ahmad41@gmail.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Password</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setIsForgotPasswordOpen(true);
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                >
                  Forgot Password?
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1.5">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`flex-1 rounded-full transition-colors ${
                          lvl <= strength
                            ? strength <= 2
                              ? 'bg-rose-500'
                              : strength <= 4
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                            : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>
                      {strength <= 2 ? 'Weak password' : strength <= 4 ? 'Moderate strength' : 'Strong password'}
                    </span>
                    <span>Min 8 chars, mixed case & numbers</span>
                  </div>
                </div>
              )}
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-black shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/35 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Factory System</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Quick Staff Credentials Helper (Real Factory Accounts) */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Quick Select Staff Account:
            </span>
            <span className="text-[10px] text-slate-500">Auto-fill email</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {(availableProfiles && availableProfiles.length > 0 
              ? availableProfiles.filter(p => p.is_active && !p.is_deactivated)
              : [
                  { name: 'Sharjeel Ahmad (Owner)', email: 'sharjeel.ahmad41@gmail.com', role: 'owner' },
                  { name: 'Aqeel Arshad (Plant Supervisor)', email: 'perfectshinechemicals@gmail.com', role: 'general_staff' }
                ]
            ).map((staff: any) => {
              const roleColors: Record<string, string> = {
                owner: 'text-emerald-400',
                general_staff: 'text-amber-400',
                sales_staff: 'text-purple-400',
                accounts_staff: 'text-blue-400',
              };
              const color = roleColors[staff.role] || 'text-slate-300';
              return (
                <button
                  key={staff.email}
                  type="button"
                  onClick={() => handleQuickFill(staff.email)}
                  className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left text-xs transition-colors"
                >
                  <div className={`font-bold ${color} truncate`}>{staff.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">{staff.email}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>Password Recovery</span>
              </h3>
              <button
                onClick={() => {
                  setIsForgotPasswordOpen(false);
                  setResetSentSuccess(false);
                }}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            {resetSentSuccess ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">Recovery Email Dispatched</h4>
                <p className="text-xs text-slate-400">
                  If an account exists for <strong className="text-white">{forgotEmail}</strong>, password reset instructions have been sent. Please check your inbox.
                </p>
                <button
                  onClick={() => {
                    setIsForgotPasswordOpen(false);
                    setResetSentSuccess(false);
                  }}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendForgotPassword} className="space-y-3.5">
                <p className="text-xs text-slate-400">
                  Enter your registered factory email address. We will send a secure recovery link to reset your password.
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="your-name@perfectshine.pk"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingReset}
                    className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSendingReset && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Send Link</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Security Footer Notice */}
      <div className="mt-6 text-center text-slate-500 text-xs">
        <p className="flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500/70" />
          <span>Encrypted Row Level Security (RLS) Active</span>
        </p>
        <p className="text-[10px] text-slate-600 mt-1">
          Near Tariq Hameed Mosque R, A 2 Block China Scheme, Lahore
        </p>
      </div>
    </div>
  );
};
