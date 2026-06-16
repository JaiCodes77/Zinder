import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

// ==========================================
import { GatewayNetwork } from './GatewayNetwork';

// ==========================================
// VALIDATION HELPER FUNCTIONS
// ==========================================
const validateEmail = (email: string): string | null => {
  if (!email) return 'Email or username is required';
  if (email.includes('@')) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
  } else {
    if (email.length < 3) return 'Username must be at least 3 characters';
  }
  return null;
};

const validatePassword = (password: string): string | null => {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  return null;
};

const validateName = (name: string): string | null => {
  if (!name) return 'Full name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters';
  return null;
};

// ==========================================
// MAIN COMPONENT
// ==========================================
interface AuthPageProps {
  onLoginSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form Field States
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);

  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);

  // Focus tracking for card glow colors
  const [focusedField, setFocusedField] = useState<'email' | 'password' | 'name' | null>(null);

  // Reset errors and fields on toggle
  const toggleView = () => {
    setIsLogin(!isLogin);
    setEmailError(null);
    setPasswordError(null);
    setNameError(null);
    setEmailTouched(false);
    setPasswordTouched(false);
    setNameTouched(false);
    setToastMessage(null);
  };

  // Field Blur Event Handlers (Trigger Validation)
  const handleEmailBlur = () => {
    setEmailTouched(true);
    setEmailError(validateEmail(email));
    setFocusedField(null);
  };

  const handlePasswordBlur = () => {
    setPasswordTouched(true);
    setPasswordError(validatePassword(password));
    setFocusedField(null);
  };

  const handleNameBlur = () => {
    setNameTouched(true);
    setNameError(validateName(name));
    setFocusedField(null);
  };

  // Field Change Event Handlers (Clear errors as user types)
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailTouched) {
      // Re-validate dynamically to clear error if resolved
      setEmailError(validateEmail(e.target.value));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (passwordTouched) {
      setPasswordError(validatePassword(e.target.value));
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (nameTouched) {
      setNameError(validateName(e.target.value));
    }
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Trigger all validations
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    const nErr = !isLogin ? validateName(name) : null;

    setEmailError(eErr);
    setPasswordError(pErr);
    setNameError(nErr);
    setEmailTouched(true);
    setPasswordTouched(true);
    setNameTouched(true);

    if (eErr || pErr || nErr) {
      setToastMessage({ text: 'Please resolve errors in the form.', type: 'error' });
      return;
    }

    setIsLoading(true);
    setToastMessage(null);

    try {
      const url = isLogin 
        ? 'http://localhost:8080/api/v1/auth/login' 
        : 'http://localhost:8080/api/v1/auth/register';
      
      const body = isLogin 
        ? { email, password } 
        : { email, password, name };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        credentials: 'include', // Ensure credentials/cookies are stored and sent
      });

      if (!response.ok) {
        let errorDetail = 'Authentication failed. Please try again.';
        try {
          const data = await response.json();
          if (data && data.detail) {
            errorDetail = data.detail;
          } else if (data && data.message) {
            errorDetail = data.message;
          }
        } catch (e) {
          // ignore
        }
        throw new Error(errorDetail);
      }
      
      if (isLogin) {
        setToastMessage({ 
          text: `Welcome back! Gateway authorization successful. Session token stored.`, 
          type: 'success' 
        });
        setTimeout(() => {
          onLoginSuccess();
        }, 1500);
      } else {
        setToastMessage({ 
          text: `Account created successfully! Welcome to Zinder.`, 
          type: 'success' 
        });
        // Auto-switch to login after signup success
        setTimeout(() => {
          setIsLogin(true);
          setToastMessage(null);
          setPassword('');
          setPasswordTouched(false);
        }, 2500);
      }
    } catch (error: any) {
      setToastMessage({ text: error.message || 'Authentication failed. Please try again.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Dynamic card border glow based on active focus
  const getGlowClass = () => {
    if (focusedField === 'email') return 'shadow-[0_0_50px_rgba(6,182,212,0.15)] border-brand-teal/30';
    if (focusedField === 'name') return 'shadow-[0_0_50px_rgba(139,92,246,0.15)] border-brand-purple/30';
    if (focusedField === 'password') return 'shadow-[0_0_50px_rgba(236,72,153,0.15)] border-brand-magenta/30';
    return 'shadow-2xl border-white/5';
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#070b12] px-4 py-12 overflow-hidden select-none">
      
      {/* Background Animated Layers */}
      <GatewayNetwork />
      
      {/* Floating Ambient Orbs */}
      <div className="absolute top-[10%] left-[15%] w-80 h-80 rounded-full bg-brand-teal/10 blur-[100px] animate-orb-slow pointer-events-none" />
      <div className="absolute bottom-[10%] right-[15%] w-96 h-96 rounded-full bg-brand-magenta/10 blur-[120px] animate-orb-slow [animation-delay:4s] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-72 h-72 rounded-full bg-brand-purple/10 blur-[110px] animate-orb-slow [animation-delay:8s] pointer-events-none" />

      {/* Glassmorphic Auth Container */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`relative w-full max-w-[460px] glass-card rounded-3xl p-8 md:p-10 z-10 transition-all duration-500 ease-out border ${getGlowClass()}`}
      >
        
        {/* Gateway Pulsing Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-purple to-brand-magenta p-[2px] shadow-[0_0_30px_rgba(236,72,153,0.3)] group cursor-pointer">
            <div className="flex items-center justify-center w-full h-full bg-[#0a0f1e] rounded-2xl transition-all duration-300 group-hover:bg-transparent">
              <Sparkles className="w-8 h-8 text-white group-hover:scale-110 transition-transform duration-300" />
            </div>
            {/* Pulsing ring outer */}
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-brand-purple to-brand-magenta opacity-30 blur-md group-hover:opacity-75 transition-opacity duration-300 animate-pulse-slow" />
          </div>
          
          <h1 className="mt-6 text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            ZINDER
          </h1>
          <p className="text-zinc-500 text-xs tracking-[0.2em] font-medium uppercase mt-1">
            Microservices dating gateway
          </p>
        </div>

        {/* View Toggle Header */}
        <div className="flex justify-center mb-8 bg-zinc-950/60 p-1.5 rounded-xl border border-white/5">
          <button 
            type="button"
            onClick={() => !isLogin && toggleView()}
            className={`flex-1 text-center py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
              isLogin 
                ? 'bg-gradient-to-r from-brand-teal/20 to-brand-purple/20 text-brand-teal border border-brand-teal/20' 
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            Sign In
          </button>
          <button 
            type="button"
            onClick={() => isLogin && toggleView()}
            className={`flex-1 text-center py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
              !isLogin 
                ? 'bg-gradient-to-r from-brand-purple/20 to-brand-magenta/20 text-brand-magenta border border-brand-magenta/20' 
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Status Alerts / Toast */}
        <AnimatePresence mode="wait">
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-4 rounded-xl flex items-start gap-3 mb-6 text-sm ${
                toastMessage.type === 'success' 
                  ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}
            >
              {toastMessage.type === 'success' ? (
                <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <span>{toastMessage.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Authentication Form */}
        <form onSubmit={handleSubmit} noValidate>
          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? 'login' : 'signup'}
              initial={{ opacity: 0, x: isLogin ? -15 : 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isLogin ? 15 : -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <h2 className="text-xl font-bold text-white mb-2">
                {isLogin ? 'Welcome Back' : 'Get Connected'}
              </h2>

              {/* Sign Up: Full Name field */}
              {!isLogin && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fullname" className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input 
                      id="fullname"
                      name="name"
                      type="text"
                      placeholder="Jane Doe"
                      value={name}
                      onChange={handleNameChange}
                      onBlur={handleNameBlur}
                      onFocus={() => setFocusedField('name')}
                      disabled={isLoading}
                      required
                      autoComplete="name"
                      className={`w-full glass-input rounded-xl pl-11 pr-10 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none ${
                        nameTouched && nameError ? 'input-error' : nameTouched && !nameError ? 'input-success' : ''
                      }`}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
                      {nameTouched && nameError && <AlertCircle className="w-5 h-5 text-red-500" />}
                      {nameTouched && !nameError && name.length > 0 && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    </div>
                  </div>
                  {nameTouched && nameError && (
                    <span className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3.5 h-3.5" /> {nameError}
                    </span>
                  )}
                </div>
              )}

              {/* Email / Username field */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">
                  Email or Username
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input 
                    id="email"
                    name="email"
                    type="text"
                    placeholder="email@example.com"
                    value={email}
                    onChange={handleEmailChange}
                    onBlur={handleEmailBlur}
                    onFocus={() => setFocusedField('email')}
                    disabled={isLoading}
                    required
                    autoComplete="username"
                    className={`w-full glass-input rounded-xl pl-11 pr-10 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none ${
                      emailTouched && emailError ? 'input-error' : emailTouched && !emailError ? 'input-success' : ''
                    }`}
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
                    {emailTouched && emailError && <AlertCircle className="w-5 h-5 text-red-500" />}
                    {emailTouched && !emailError && email.length > 0 && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                  </div>
                </div>
                {emailTouched && emailError && (
                  <span className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-3.5 h-3.5" /> {emailError}
                  </span>
                )}
              </div>

              {/* Password field */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">
                    Password
                  </label>
                  {isLogin && (
                    <a 
                      href="#forgot" 
                      onClick={(e) => {
                        e.preventDefault();
                        setToastMessage({ text: 'Password reset link dispatched.', type: 'success' });
                      }}
                      className="text-xs font-semibold text-brand-teal-light hover:text-brand-teal hover:underline transition-colors"
                    >
                      Forgot?
                    </a>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input 
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={handlePasswordChange}
                    onBlur={handlePasswordBlur}
                    onFocus={() => setFocusedField('password')}
                    disabled={isLoading}
                    required
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    className={`w-full glass-input rounded-xl pl-11 pr-20 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none ${
                      passwordTouched && passwordError ? 'input-error' : passwordTouched && !passwordError ? 'input-success' : ''
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                    {passwordTouched && passwordError && <AlertCircle className="w-5 h-5 text-red-500" />}
                    {passwordTouched && !passwordError && password.length > 0 && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                  </div>
                </div>
                {passwordTouched && passwordError ? (
                  <span className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-3.5 h-3.5" /> {passwordError}
                  </span>
                ) : (
                  !isLogin && (
                    <span className="text-[10px] text-zinc-500 mt-0.5 block">
                      Must be at least 8 characters.
                    </span>
                  )
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Primary CTA Submit Button */}
          <div className="mt-8">
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`relative w-full py-4 px-6 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 overflow-hidden shadow-lg transition-all duration-300 ${
                isLogin 
                  ? 'bg-gradient-to-r from-brand-teal via-brand-purple to-brand-magenta hover:shadow-[0_0_24px_rgba(6,182,212,0.4)]' 
                  : 'bg-gradient-to-r from-brand-magenta via-brand-purple to-brand-teal hover:shadow-[0_0_24px_rgba(236,72,153,0.4)]'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Connecting Gateway...</span>
                </>
              ) : (
                <>
                  <span>{isLogin ? 'Access Account' : 'Initialize Session'}</span>
                  <ArrowRight className="w-4 h-4 mt-[1px]" />
                </>
              )}
              {/* Sleek reflection overlay effect on hover */}
              <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity duration-300" />
            </motion.button>
          </div>
        </form>

        {/* OAuth Dividers & Social Row */}
        <div className="mt-8 flex flex-col items-center">
          <div className="flex items-center w-full mb-6">
            <div className="flex-1 h-[1px] bg-white/10" />
            <span className="px-4 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">
              Gateway Identity
            </span>
            <div className="flex-1 h-[1px] bg-white/10" />
          </div>

          <div className="flex gap-4 w-full">
            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setToastMessage({ text: 'Apple OAuth redirection simulated.', type: 'success' });
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-white/5 bg-zinc-950/40 hover:bg-zinc-900/60 text-sm font-medium transition-all"
            >
              <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.54 9.103 1.51 12.06 1.005 1.45 2.176 3.078 3.75 3.014 1.52-.062 2.09-.98 3.93-.98 1.83 0 2.365.98 3.96.948 1.627-.027 2.66-1.478 3.655-2.92 1.157-1.688 1.63-3.325 1.66-3.418-.03-.01-3.178-1.22-3.21-4.816-.026-3.003 2.46-4.444 2.574-4.515-1.41-2.063-3.582-2.29-4.35-2.35-2.072-.167-3.308.766-4.158.766zM15.93 3.559c.813-1.002 1.35-2.387 1.2-3.774-1.19.048-2.63.792-3.483 1.79-.766.88-1.436 2.293-1.258 3.653 1.325.1 2.695-.694 3.54-1.67z" />
              </svg>
              <span>Apple ID</span>
            </motion.button>
            
            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setToastMessage({ text: 'Google OAuth redirection simulated.', type: 'success' });
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-white/5 bg-zinc-950/40 hover:bg-zinc-900/60 text-sm font-medium transition-all"
            >
              <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.51 0-6.355-2.845-6.355-6.355s2.845-6.355 6.355-6.355c1.61 0 3.076.61 4.205 1.61l3.123-3.123C19.11 1.79 15.89 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c6.88 0 12.24-5.48 12.24-12.24 0-.82-.08-1.61-.24-2.385H12.24z" />
              </svg>
              <span>Google</span>
            </motion.button>
          </div>
        </div>

        {/* Microservices Node Status Footer */}
        <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center text-[10px] text-zinc-500 tracking-wide font-medium">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
            <span>GATEWAY-SSL ACTIVE</span>
          </div>
          <div className="text-right">
            <span>v1.2.0-PROD</span>
          </div>
        </div>

      </motion.div>
    </div>
  );
};
