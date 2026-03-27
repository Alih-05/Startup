import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { login } = useAuth();
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (view === 'register' && password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      setLoading(false);
      return;
    }

    if (view === 'forgot') {
      try {
        const res = await fetch('/api/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
          credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
          setSuccess(t('resetLinkSent'));
        } else {
          setError(data.error || t('errorGeneric'));
        }
      } catch (err) {
        setError(t('errorGeneric'));
      } finally {
        setLoading(false);
      }
      return;
    }

    const endpoint = view === 'login' ? '/api/login' : '/api/register';
    const body = view === 'login' ? { email, password } : { username, email, password };

    try {
      console.log(`Attempting ${view} for ${email}...`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include'
      });

      const contentType = res.headers.get('content-type');
      let data: any = {};
      
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
      }

      if (res.ok) {
        console.log(`${view} successful!`, data.user);
        login(data.user, data.token);
        onClose();
      } else {
        console.error(`${view} failed:`, data.error);
        setError(data.error || t('authFailed'));
      }
    } catch (err) {
      console.error(`${view} error:`, err);
      setError(t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (view === 'login') return t('welcomeBack');
    if (view === 'register') return t('createAccount');
    return t('resetPassword');
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
                <h2 className="text-2xl font-bold text-gray-900">
                  {getTitle()}
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {view === 'register' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">{t('username')}</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        placeholder="johndoe"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">{t('email')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      placeholder="name@example.com"
                    />
                  </div>
                </div>

                {view !== 'forgot' && (
                  <>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-gray-700">{t('password')}</label>
                        {view === 'login' && (
                          <button
                            type="button"
                            onClick={() => setView('forgot')}
                            className="text-xs font-semibold text-indigo-600 hover:underline"
                          >
                            {t('forgotPassword')}
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    {view === 'register' && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">{t('confirmPassword')}</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                    {error}
                  </p>
                )}

                {success && (
                  <p className="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                    {success}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : (
                    view === 'login' ? t('signIn') : (view === 'register' ? t('signUp') : t('sendResetLink'))
                  )}
                </button>
              </form>

              <div className="mt-8 text-center text-sm text-gray-500">
                {view === 'forgot' ? (
                  <button
                    onClick={() => setView('login')}
                    className="text-indigo-600 font-semibold hover:underline"
                  >
                    {t('backToLogin')}
                  </button>
                ) : (
                  <>
                    {view === 'login' ? t('noAccount') : t('hasAccount')}{' '}
                    <button
                      onClick={() => setView(view === 'login' ? 'register' : 'login')}
                      className="text-indigo-600 font-semibold hover:underline"
                    >
                      {view === 'login' ? t('signUp') : t('signIn')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
