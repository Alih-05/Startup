import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Sparkles, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useState, useRef } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

export default function AuthModal() {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const handleCaptchaChange = (token: string | null) => {
    setCaptchaToken(token); // Сохраняем токен, когда юзер прожал галочку
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!captchaToken) {
      alert('Пожалуйста, подтвердите, что вы не робот!');
      return;
    }

    // Отправляем запрос на регистрацию на бэкенд и докидываем туда токен капчи
    const response = await fetch('https://startup-gurz.onrender.com/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: '...',
        password: '...',
        captchaToken // <-- Отправляем токен бэкенду
      }),
    });

    // Сбрасываем капчу после отправки формы
    recaptchaRef.current?.reset();
    setCaptchaToken(null);
  };

  return (
    <form onSubmit={handleRegisterSubmit}>
      {/* Твои поля ввода Email и Пароля... */}

      {/* Виджет капчи */}
      <div className="flex justify-center my-4">
        <ReCAPTCHA
          ref={recaptchaRef}
          sitekey="ВСТАВЬ_СЮДА_ПУБЛИЧНЫЙ_SITE_KEY"
          onChange={handleCaptchaChange}
        />
      </div>

      <button type="submit">Регистрация</button>
    </form>
  );
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'signup' | 'forgot';

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [dataAgreed, setDataAgreed] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showLegalHover, setShowLegalHover] = useState(false);
  
  const { loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword } = useAuth();
  const { t, language } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Валидация сильного пароля
    if (mode === 'signup') {
      const strongPasswordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':",.<>?\\\/]).{8,}$/;

      if (!strongPasswordRegex.test(password)) {
        setError('Пароль должен быть не менее 8 символов и содержать: одну заглавную букву, одну цифру и один спецсимвол.');
        setLoading(false);
        return; // Останавливаем отправку формы, если пароль слабый
      }
    }

    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        onClose();
      } else if (mode === 'signup') {
        if (!agreed || !dataAgreed) {
          setError(t('iAgreeToTerms' as any));
          setLoading(false);
          return;
        }
        await registerWithEmail(email, password);
        onClose();
      } else {
        await resetPassword(email);
        setSuccess(t('resetLinkSent'));
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || t('authFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err) {
      console.error('Login error:', err);
      setError(t('authFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <img src="/logo.svg" alt="StyleMirror Logo" className="w-10 h-10 object-contain" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    {mode === 'login' ? t('welcomeBack') : mode === 'signup' ? t('createAccount') : t('resetPassword')}
                  </h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="space-y-6">
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 text-center">
                    {error}
                  </p>
                )}

                {success && (
                  <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-100 text-center">
                    {success}
                  </p>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Mail size={14} />
                      {t('email')}
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                      placeholder="you@example.com"
                    />
                  </div>

                  {mode !== 'forgot' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Lock size={14} />
                          {t('password')}
                        </label>
                        {mode === 'login' && (
                          <button
                            type="button"
                            onClick={() => setMode('forgot')}
                            className="text-xs text-primary hover:text-primary/80 font-medium"
                          >
                            {t('forgotPassword')}
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                        placeholder="••••••••"
                      />
                    </div>
                  )}

                  {mode === 'signup' && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center h-5">
                          <input
                            id="terms"
                            type="checkbox"
                            checked={agreed}
                            onChange={(e) => setAgreed(e.target.checked)}
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary transition-colors cursor-pointer"
                          />
                        </div>
                        <div className="text-[11px] text-gray-500 leading-normal">
                          <label htmlFor="terms" className="cursor-pointer select-none">
                            {t('iAgreeToTerms' as any)}
                          </label>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 relative">
                        <div className="flex items-center h-5">
                          <input
                            id="data-processing"
                            type="checkbox"
                            checked={dataAgreed}
                            onChange={(e) => setDataAgreed(e.target.checked)}
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary transition-colors cursor-pointer"
                          />
                        </div>
                        <div className="text-[11px] text-gray-500 leading-normal">
                          <label 
                            htmlFor="data-processing" 
                            className="cursor-pointer select-none relative"
                            onMouseEnter={() => setShowLegalHover(true)}
                            onMouseLeave={() => setShowLegalHover(false)}
                          >
                            <span className="border-b border-dotted border-gray-400">
                              {t('iAgreeToDataProcessing' as any)}
                            </span>
                            
                            <AnimatePresence>
                              {showLegalHover && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                  className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-gray-900 text-white rounded-xl text-[10px] shadow-xl z-50 pointer-events-none"
                                >
                                  <div className="font-bold mb-1 text-primary">RK Data Law (2026 Update)</div>
                                  {t('privacyPolicyInfo' as any)}
                                  <div className="absolute top-full left-4 border-8 border-transparent border-t-gray-900" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || (mode === 'signup' && (!agreed || !dataAgreed))}
                    className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : (
                      <>
                        {mode === 'login' ? t('signIn') : mode === 'signup' ? t('signUp') : t('sendResetLink')}
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-100"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-4 text-gray-400 font-medium tracking-wider">Or continue with</span>
                  </div>
                </div>

                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full py-4 bg-white border border-gray-200 hover:border-primary text-gray-700 font-semibold rounded-xl shadow-sm transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-3"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                  {t('signInWithGoogle')}
                </button>

                <div className="text-center">
                  <button
                    onClick={() => {
                      setMode(mode === 'login' ? 'signup' : 'login');
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-sm text-gray-500 hover:text-primary font-medium transition-colors"
                  >
                    {mode === 'login' ? t('noAccount') : t('hasAccount')}
                    <span className="text-primary ml-1">
                      {mode === 'login' ? t('signUp') : t('signIn')}
                    </span>
                  </button>
                </div>
              </div>

              <div className="mt-8 text-center text-[10px] text-gray-400 leading-relaxed">
                {language === 'ru' ? (
                  <>
                    Продолжая, вы соглашаетесь с нашими{' '}
                    <button onClick={() => setShowPrivacy(true)} className="text-primary hover:underline">{t('termsOfService' as any)}</button>
                    {' '}и{' '}
                    <button onClick={() => setShowPrivacy(true)} className="text-primary hover:underline">{t('privacyPolicy' as any)}</button>.
                  </>
                ) : (
                  <>
                    By signing in, you agree to our{' '}
                    <button onClick={() => setShowPrivacy(true)} className="text-primary hover:underline">{t('termsOfService' as any)}</button>
                    {' '}and{' '}
                    <button onClick={() => setShowPrivacy(true)} className="text-primary hover:underline">{t('privacyPolicy' as any)}</button>.
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Privacy Policy / Terms Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowPrivacy(false)}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Legal Terms & Privacy</h3>
              <button onClick={() => setShowPrivacy(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-gray-600 space-y-4">
              <section>
                <h4 className="font-bold text-gray-900 mb-2">Terms of Service</h4>
                <p>Welcome to StyleMirror. By using our service, you agree to these terms. StyleMirror uses AI technology to process your images and provide style advice. You maintain ownership of your uploaded images.</p>
              </section>
              <section>
                <h4 className="font-bold text-gray-900 mb-2">Privacy Policy</h4>
                <p>We take your privacy seriously. We store your account information (email, profile) and generated history securely using Firebase. We do not sell your personal data to third parties. AI processing is done using Google's Gemini models.</p>
              </section>
              <section>
                <h4 className="font-bold text-gray-900 mb-2">Data Protection</h4>
                <p>Your data is encrypted in transit and at rest. You can delete your account and data at any time through your profile settings.</p>
              </section>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button 
                onClick={() => setShowPrivacy(false)}
                className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
