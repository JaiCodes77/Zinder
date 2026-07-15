import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { GatewayNetwork } from './GatewayNetwork';

// ==========================================
// VALIDATION HELPERS
// ==========================================
const validateEmail = (email: string): string | null => {
  if (!email) return 'Email is required';
  if (email.includes('@')) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Enter a valid email address';
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
  if (!name) return 'Name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters';
  return null;
};

// ==========================================
// NARRATIVE PIECES
// ==========================================
const lineReveal = {
  hidden: { opacity: 0, y: 26 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + i * 0.14, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const COMMITS = [
  { hash: 'a30f9c2', msg: 'you arrive, stack in hand' },
  { hash: '7d21e4b', msg: 'someone likes your architecture' },
  { hash: 'f96b0aa', msg: 'merge: two roadmaps become one' },
];

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

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);

  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);

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

  const handleEmailBlur = () => {
    setEmailTouched(true);
    setEmailError(validateEmail(email));
  };

  const handlePasswordBlur = () => {
    setPasswordTouched(true);
    setPasswordError(validatePassword(password));
  };

  const handleNameBlur = () => {
    setNameTouched(true);
    setNameError(validateName(name));
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailTouched) setEmailError(validateEmail(e.target.value));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (passwordTouched) setPasswordError(validatePassword(e.target.value));
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (nameTouched) setNameError(validateName(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    const nErr = !isLogin ? validateName(name) : null;

    setEmailError(eErr);
    setPasswordError(pErr);
    setNameError(nErr);
    setEmailTouched(true);
    setPasswordTouched(true);
    setNameTouched(true);

    if (eErr || pErr || nErr) return;

    setIsLoading(true);
    setToastMessage(null);

    try {
      const url = isLogin
        ? 'http://localhost:8080/api/v1/auth/login'
        : 'http://localhost:8080/api/v1/auth/register';

      const body = isLogin ? { email, password } : { email, password, name };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (!response.ok) {
        let errorDetail = 'Something went wrong. Please try again.';
        try {
          const data = await response.json();
          if (data && data.detail) errorDetail = data.detail;
          else if (data && data.message) errorDetail = data.message;
        } catch {
          // ignore parse failure, keep generic message
        }
        throw new Error(errorDetail);
      }

      if (isLogin) {
        setToastMessage({ text: 'Signed in. Your story continues…', type: 'success' });
        setTimeout(() => {
          onLoginSuccess();
        }, 900);
      } else {
        setToastMessage({ text: 'Account created — sign in to begin.', type: 'success' });
        setTimeout(() => {
          setIsLogin(true);
          setToastMessage(null);
          setPassword('');
          setPasswordTouched(false);
        }, 1800);
      }
    } catch (error: any) {
      setToastMessage({ text: error.message || 'Something went wrong. Please try again.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = (touched: boolean, error: string | null) =>
    `field w-full px-3.5 py-2.5 text-sm text-fg placeholder-fg-subtle focus:outline-none ${
      touched && error ? 'field-error' : ''
    }`;

  return (
    <div className="relative min-h-screen w-full bg-ink-950 lg:grid lg:grid-cols-[1.1fr_1fr]">
      <GatewayNetwork />

      {/* ==========================================
          LEFT — THE PROLOGUE
          ========================================== */}
      <section className="relative z-10 hidden lg:flex flex-col justify-between p-12 xl:p-16 border-r rule">
        {/* Masthead */}
        <div className="flex items-center gap-3">
          <div className="brand-mark w-8 h-8 rounded-lg flex items-center justify-center">
            <span className="text-[15px] font-bold text-ink-950 leading-none select-none display">Z</span>
          </div>
          <span className="display text-[19px] text-fg">Zinder</span>
        </div>

        {/* Manifesto */}
        <div className="max-w-xl">
          <motion.p
            custom={0}
            variants={lineReveal}
            initial="hidden"
            animate="show"
            className="kicker mb-8"
          >
            Prologue · N°01
          </motion.p>

          <h1 className="text-[56px] xl:text-[68px] leading-[1.04]">
            <motion.span custom={1} variants={lineReveal} initial="hidden" animate="show" className="display block text-fg">
              Every great build
            </motion.span>
            <motion.span custom={2} variants={lineReveal} initial="hidden" animate="show" className="display block text-fg">
              begins with
            </motion.span>
            <motion.span custom={3} variants={lineReveal} initial="hidden" animate="show" className="display-italic block text-gradient-brand">
              a match.
            </motion.span>
          </h1>

          {/* Commit log marginalia */}
          <div className="mt-12 space-y-2.5">
            {COMMITS.map((c, i) => (
              <motion.p
                key={c.hash}
                custom={4 + i}
                variants={lineReveal}
                initial="hidden"
                animate="show"
                className="font-mono text-xs text-fg-subtle"
              >
                <span className="text-accent/70">{c.hash}</span>
                <span className="mx-2 text-fg-subtle/50">—</span>
                {c.msg}
              </motion.p>
            ))}
          </div>
        </div>

        {/* Foot meta */}
        <motion.div
          custom={8}
          variants={lineReveal}
          initial="hidden"
          animate="show"
          className="flex items-end justify-between"
        >
          <p className="text-sm text-fg-muted max-w-[300px] leading-relaxed">
            For developers who would rather not build alone.
          </p>
          <p className="mono-label">est. 2026 · localhost</p>
        </motion.div>
      </section>

      {/* ==========================================
          RIGHT — THE SIGNATURE PAGE
          ========================================== */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        {/* Compact masthead for mobile */}
        <div className="lg:hidden flex flex-col items-center mb-8 text-center">
          <div className="brand-mark w-10 h-10 rounded-xl flex items-center justify-center">
            <span className="text-[18px] font-bold text-ink-950 leading-none select-none display">Z</span>
          </div>
          <p className="display text-2xl text-fg mt-4">
            Every great build begins with <span className="display-italic text-gradient-brand">a match.</span>
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[400px]"
        >
          <div className="mb-7">
            <p className="kicker mb-3">{isLogin ? 'Returning reader' : 'New character'}</p>
            <h2 className="display text-[32px] leading-tight text-fg">
              {isLogin ? 'Welcome back.' : 'Join the story.'}
            </h2>
            <p className="mt-2 text-sm text-fg-muted">
              {isLogin ? 'Sign in to pick up where you left off.' : 'Meet developers. Build together.'}
            </p>
          </div>

          {/* Status message */}
          <AnimatePresence mode="wait">
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                role="status"
                className={`px-3.5 py-3 rounded-lg flex items-start gap-2.5 mb-5 text-[13px] leading-snug border ${
                  toastMessage.type === 'success'
                    ? 'bg-like/8 border-like/20 text-like'
                    : 'bg-pass/8 border-pass/20 text-pass'
                }`}
              >
                {toastMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-px" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
                )}
                <span>{toastMessage.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} noValidate>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={isLogin ? 'login' : 'signup'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                {!isLogin && (
                  <div className="space-y-1.5">
                    <label htmlFor="fullname" className="block text-[13px] font-medium text-fg-muted">
                      Full name
                    </label>
                    <input
                      id="fullname"
                      name="name"
                      type="text"
                      placeholder="Ada Lovelace"
                      value={name}
                      onChange={handleNameChange}
                      onBlur={handleNameBlur}
                      disabled={isLoading}
                      required
                      autoComplete="name"
                      className={inputClass(nameTouched, nameError)}
                    />
                    {nameTouched && nameError && <p className="text-xs text-pass pt-0.5">{nameError}</p>}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-[13px] font-medium text-fg-muted">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="text"
                    placeholder="you@example.com"
                    value={email}
                    onChange={handleEmailChange}
                    onBlur={handleEmailBlur}
                    disabled={isLoading}
                    required
                    autoComplete="username"
                    className={inputClass(emailTouched, emailError)}
                  />
                  {emailTouched && emailError && <p className="text-xs text-pass pt-0.5">{emailError}</p>}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-[13px] font-medium text-fg-muted">
                      Password
                    </label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() =>
                          setToastMessage({ text: 'Password reset isn’t available in this preview.', type: 'error' })
                        }
                        className="text-xs font-medium text-fg-subtle hover:text-accent transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={isLogin ? 'Your password' : 'At least 8 characters'}
                      value={password}
                      onChange={handlePasswordChange}
                      onBlur={handlePasswordBlur}
                      disabled={isLoading}
                      required
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      className={`${inputClass(passwordTouched, passwordError)} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-fg-subtle hover:text-fg-muted transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordTouched && passwordError && (
                    <p className="text-xs text-pass pt-0.5">{passwordError}</p>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full mt-6 py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isLogin ? 'Signing in…' : 'Creating account…'}</span>
                </>
              ) : (
                <span>{isLogin ? 'Sign in' : 'Create account'}</span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-fg/8" />
            <span className="text-[11px] font-medium text-fg-subtle">or</span>
            <div className="flex-1 h-px bg-fg/8" />
          </div>

          {/* SSO */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                setToastMessage({ text: 'Single sign-on isn’t available in this preview.', type: 'error' })
              }
              className="btn-ghost flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-[13px]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="currentColor"
                  d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.54 9.103 1.51 12.06 1.005 1.45 2.176 3.078 3.75 3.014 1.52-.062 2.09-.98 3.93-.98 1.83 0 2.365.98 3.96.948 1.627-.027 2.66-1.478 3.655-2.92 1.157-1.688 1.63-3.325 1.66-3.418-.03-.01-3.178-1.22-3.21-4.816-.026-3.003 2.46-4.444 2.574-4.515-1.41-2.063-3.582-2.29-4.35-2.35-2.072-.167-3.308.766-4.158.766zM15.93 3.559c.813-1.002 1.35-2.387 1.2-3.774-1.19.048-2.63.792-3.483 1.79-.766.88-1.436 2.293-1.258 3.653 1.325.1 2.695-.694 3.54-1.67z"
                />
              </svg>
              <span>Apple</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setToastMessage({ text: 'Single sign-on isn’t available in this preview.', type: 'error' })
              }
              className="btn-ghost flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-[13px]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="currentColor"
                  d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.51 0-6.355-2.845-6.355-6.355s2.845-6.355 6.355-6.355c1.61 0 3.076.61 4.205 1.61l3.123-3.123C19.11 1.79 15.89 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c6.88 0 12.24-5.48 12.24-12.24 0-.82-.08-1.61-.24-2.385H12.24z"
                />
              </svg>
              <span>Google</span>
            </button>
          </div>

          {/* Toggle */}
          <p className="mt-7 text-center text-sm text-fg-muted">
            {isLogin ? 'New to Zinder?' : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={toggleView}
              className="font-medium text-accent hover:text-accent-bright transition-colors"
            >
              {isLogin ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </motion.div>
      </section>
    </div>
  );
};
