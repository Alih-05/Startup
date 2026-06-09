import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { User, Mail, Calendar, LogOut, ArrowLeft, Shield, Camera, Loader2, CheckCircle2, AlertCircle, Lock, Key, Sparkles, UserPlus, UserMinus, UserCheck, X, Check, Users, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db, handleFirestoreError, OperationType, auth, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from '../firebase';
import { doc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';

interface Friendship {
  id: string;
  initiatorId: string;
  receiverId: string;
  initiatorName: string;
  initiatorPhoto?: string;
  receiverName: string;
  receiverPhoto?: string;
  status: 'pending' | 'accepted';
  createdAt: any;
}

interface ProfilePageProps {
  onBack: () => void;
  onUpgrade: () => void;
  friendships: Friendship[];
  onAcceptRequest: (id: string) => void;
  onRemoveFriendship: (id: string) => void;
  onOpenChat: (friendship: Friendship) => void;
}

export default function ProfilePage({ onBack, onUpgrade, friendships, onAcceptRequest, onRemoveFriendship, onOpenChat }: ProfilePageProps) {
  const { user, logout, updateUser } = useAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState(user?.username || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Refund states
  const [refunding, setRefunding] = useState(false);
  const [refundSent, setRefundSent] = useState(false);

  if (!user) return null;

  const isPasswordUser = auth.currentUser?.providerData.some(
    (provider) => provider.providerId === 'password'
  );

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const path = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        username,
        updatedAt: serverTimestamp()
      });
      
      updateUser({ ...user, username });
      setSuccess(t('updateSuccess'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      setError(t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordsDoNotMatch'));
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) throw new Error('No user found');

      // Re-authenticate user first (required for password change)
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      
      // Update password
      await updatePassword(currentUser, newPassword);
      
      setPasswordSuccess(t('updateSuccess'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err: any) {
      console.error('Password update error:', err);
      setPasswordError(err.message || t('errorGeneric'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    const path = `users/${user.uid}`;
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            avatar_data: base64Data,
            updatedAt: serverTimestamp()
          });
          
          updateUser({ ...user, avatar_data: base64Data });
          setSuccess(t('avatarUpdated'));
          setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
          setError(t('errorGeneric'));
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(t('errorGeneric'));
      setLoading(false);
    }
  };

  const handleRequestRefund = async () => {
    setRefunding(true);
    try {
      // Simulate API call to refund system
      await addDoc(collection(db, 'refund_requests'), {
        userId: user.uid,
        email: user.email,
        plan: user.plan,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setRefundSent(true);
      setTimeout(() => setRefundSent(false), 5000);
    } catch (err) {
      console.error('Refund error:', err);
    } finally {
      setRefunding(false);
    }
  };

  return (
    <div className="min-h-screen bg-site-bg transition-colors duration-500">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <button
          onClick={onBack}
          className={cn(
            "flex items-center gap-2 transition-colors mb-8 group",
            user.settings?.isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-black"
          )}
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          {t('backToEditor')}
        </button>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="md:col-span-1 space-y-6">
            <div className={cn(
              "rounded-3xl p-8 shadow-sm border text-center transition-colors",
              user.settings?.isDarkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
            )}>
              <div className="relative w-24 h-24 mx-auto mb-4 group">
                <div className={cn(
                  "w-full h-full bg-primary/10 rounded-full flex items-center justify-center text-primary overflow-hidden border-4 shadow-sm",
                  user.settings?.isDarkMode ? "border-gray-800" : "border-white"
                )}>
                  {user.avatar_data ? (
                    <img src={user.avatar_data} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <User size={48} />
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 transition-all"
                >
                  <Camera size={14} />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
              <h2 className={cn("text-xl font-bold transition-colors", user.settings?.isDarkMode ? "text-white" : "text-gray-900")}>{user.username}</h2>
              <p className={cn("text-sm transition-colors", user.settings?.isDarkMode ? "text-gray-400" : "text-gray-500")}>{user.email}</p>
            </div>

            <button
              onClick={() => {
                logout();
                onBack();
              }}
              className={cn(
                "w-full flex items-center justify-center gap-2 p-4 font-semibold rounded-2xl border transition-colors",
                user.settings?.isDarkMode 
                  ? "bg-gray-900 border-gray-800 text-red-500 hover:bg-red-500/10" 
                  : "bg-gray-100 text-red-600 border-red-50 hover:bg-red-50"
              )}
            >
              <LogOut size={20} />
              {t('signOut')}
            </button>
          </div>

          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {/* Plan Info */}
            <div className={cn(
              "rounded-3xl p-8 shadow-sm border transition-colors",
              user.settings?.isDarkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
            )}>
              <h3 className={cn("text-lg font-bold mb-6 flex items-center gap-2 transition-colors", user.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                <Sparkles size={20} className="text-primary" />
                {t('plan')}
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-6 rounded-3xl bg-primary/5 border border-primary/10">
                  <div>
                    <span className="text-xs font-bold text-primary uppercase tracking-widest">{t('plan')}</span>
                    <h4 className="text-xl font-black text-primary uppercase">{t(`${user.plan}Plan` as any)}</h4>
                  </div>
                  <button
                    onClick={onUpgrade}
                    className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-full hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                  >
                    {t('upgradeNow')}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className={cn(
                    "p-4 rounded-2xl border transition-colors",
                    user.settings?.isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100"
                  )}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      {user.plan === 'trial' ? t('generationsLeft') : t('dailyGenerationsLeft')}
                    </p>
                    <div className="flex items-end gap-2">
                      <p className={cn("text-2xl font-bold transition-colors", user.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                        {user.plan === 'trial' 
                          ? Math.max(0, 10 - user.usage.totalGenerations) 
                          : user.plan === 'basic' 
                            ? Math.max(0, 20 - user.usage.dailyGenerations)
                            : '∞'}
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl border transition-colors",
                    user.settings?.isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100"
                  )}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      {t('savedLooksLimit')}
                    </p>
                    <p className={cn("text-2xl font-bold transition-colors", user.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                      {user.plan === 'premium' ? '∞' : user.plan === 'basic' ? '10' : '∞'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Update */}
            <div className={cn(
              "rounded-3xl p-8 shadow-sm border transition-colors",
              user.settings?.isDarkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
            )}>
              <h3 className={cn("text-lg font-bold mb-6 flex items-center gap-2 transition-colors", user.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                <Shield size={20} className="text-primary" />
                {t('updateProfile')}
              </h3>
              
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">{t('username')}</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={cn(
                        "w-full pl-12 pr-4 py-3 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all",
                        user.settings?.isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-50 border-gray-100 text-gray-900"
                      )}
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}

                {success && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : t('updateProfile')}
                </button>
              </form>
            </div>

            {/* Password Update - Only for Email users */}
            {isPasswordUser && (
              <div className={cn(
                "rounded-3xl p-8 shadow-sm border transition-colors",
                user.settings?.isDarkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
              )}>
                <h3 className={cn("text-lg font-bold mb-6 flex items-center gap-2 transition-colors", user.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                  <Key size={20} className="text-primary" />
                  {t('changePassword')}
                </h3>
                
                <form onSubmit={handleUpdatePassword} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">{t('password')}</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Current Password"
                        className={cn(
                          "w-full pl-12 pr-4 py-3 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all",
                          user.settings?.isDarkMode ? "bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" : "bg-gray-50 border-gray-100 text-gray-900"
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">{t('newPassword')}</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New Password"
                        className={cn(
                          "w-full pl-12 pr-4 py-3 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all",
                          user.settings?.isDarkMode ? "bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" : "bg-gray-50 border-gray-100 text-gray-900"
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">{t('confirmPassword')}</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm New Password"
                        className={cn(
                          "w-full pl-12 pr-4 py-3 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all",
                          user.settings?.isDarkMode ? "bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" : "bg-gray-50 border-gray-100 text-gray-900"
                        )}
                      />
                    </div>
                  </div>

                  {passwordError && (
                    <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                      <AlertCircle size={18} />
                      {passwordError}
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm flex items-center gap-2">
                      <CheckCircle2 size={18} />
                      {passwordSuccess}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {passwordLoading ? <Loader2 className="animate-spin" size={20} /> : t('changePassword')}
                  </button>
                </form>
              </div>
            )}

            {/* Account Info */}
            <div className={cn(
              "rounded-3xl p-8 shadow-sm border transition-colors",
              user.settings?.isDarkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
            )}>
              <h3 className={cn("text-lg font-bold mb-6 flex items-center gap-2 transition-colors", user.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                <Mail size={20} className="text-primary" />
                {t('accountInfo')}
              </h3>
              
              <div className="space-y-4">
                <div className={cn(
                  "flex items-center gap-4 p-4 rounded-2xl border transition-colors",
                  user.settings?.isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100"
                )}>
                  <div className={cn("p-3 rounded-xl shadow-sm transition-colors", user.settings?.isDarkMode ? "bg-gray-900" : "bg-white")}>
                    <Mail size={20} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('email')}</p>
                    <p className={cn("font-medium transition-colors", user.settings?.isDarkMode ? "text-white" : "text-gray-900")}>{user.email}</p>
                  </div>
                </div>

                <div className={cn(
                  "flex items-center gap-4 p-4 rounded-2xl border transition-colors",
                  user.settings?.isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100"
                )}>
                  <div className={cn("p-3 rounded-xl shadow-sm transition-colors", user.settings?.isDarkMode ? "bg-gray-900" : "bg-white")}>
                    <Calendar size={20} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('memberSince')}</p>
                    <p className={cn("font-medium transition-colors", user.settings?.isDarkMode ? "text-white" : "text-gray-900")}>{t('february')} 2026</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Billing & Refund System */}
            <div className={cn(
              "rounded-3xl p-8 shadow-sm border transition-colors",
              user.settings?.isDarkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
            )}>
              <h3 className={cn("text-lg font-bold mb-6 flex items-center gap-2 transition-colors", user.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                <AlertCircle size={20} className="text-primary" />
                {t('refundPolicy')}
              </h3>
              
              <div className="space-y-6">
                <div className={cn(
                  "p-6 rounded-2xl border transition-colors",
                  user.settings?.isDarkMode ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-gray-50 border-gray-100 text-gray-600"
                )}>
                  <p className="text-sm leading-relaxed mb-4">
                    {t('refundDescription')}
                  </p>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400">
                    Consumer Rights RK 2026: Protected
                  </p>
                </div>

                {refundSent ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    {t('refundRequested')}
                  </div>
                ) : (
                  <button
                    onClick={handleRequestRefund}
                    disabled={refunding || user.plan === 'trial'}
                    className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-gray-200"
                  >
                    {refunding ? <Loader2 className="animate-spin" size={20} /> : t('requestRefund')}
                  </button>
                )}
              </div>
            </div>

            {/* Friend Requests */}
            {friendships.filter(f => f.status === 'pending' && f.receiverId === user.uid).length > 0 && (
              <div className={cn(
                "rounded-3xl p-8 shadow-sm border transition-colors",
                user.settings?.isDarkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
              )}>
                <h3 className={cn("text-lg font-bold mb-6 flex items-center gap-2 transition-colors", user.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                  <UserPlus size={20} className="text-amber-500" />
                  {t('friendRequests')}
                </h3>
                <div className="space-y-4">
                  {friendships.filter(f => f.status === 'pending' && f.receiverId === user.uid).map(request => (
                    <div key={request.id} className="flex items-center justify-between p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50">
                      <div className="flex items-center gap-3">
                        {request.initiatorPhoto ? (
                          <img src={request.initiatorPhoto} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-amber-500 border border-amber-200">
                            <User size={20} />
                          </div>
                        )}
                        <div>
                          <p className={cn("font-bold transition-colors", user.settings?.isDarkMode ? "text-white" : "text-gray-900")}>{request.initiatorName}</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{t('requestSent')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => onAcceptRequest(request.id)}
                          className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200"
                        >
                          <Check size={18} />
                        </button>
                        <button 
                          onClick={() => onRemoveFriendship(request.id)}
                          className="p-2 bg-gray-100 text-gray-400 rounded-xl hover:text-red-500 border border-gray-200 hover:border-red-100 transition-all"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends List */}
            <div className={cn(
              "rounded-3xl p-8 shadow-sm border transition-colors",
              user.settings?.isDarkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
            )}>
              <h3 className={cn("text-lg font-bold mb-6 flex items-center gap-2 transition-colors", user.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                <UserCheck size={20} className="text-emerald-500" />
                {t('friends')}
              </h3>
              
              <div className="space-y-4">
                {friendships.filter(f => f.status === 'accepted').length > 0 ? (
                  friendships.filter(f => f.status === 'accepted').map(friendship => {
                    const isInitiator = friendship.initiatorId === user.uid;
                    const friendName = isInitiator ? friendship.receiverName : friendship.initiatorName;
                    const friendPhoto = isInitiator ? friendship.receiverPhoto : friendship.initiatorPhoto;

                    return (
                      <div key={friendship.id} className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border group transition-colors",
                        user.settings?.isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100"
                      )}>
                        <div className="flex items-center gap-3">
                          {friendPhoto ? (
                            <img src={friendPhoto} alt="" className={cn("w-10 h-10 rounded-full object-cover border-2 shadow-sm transition-colors", user.settings?.isDarkMode ? "border-gray-900" : "border-white")} />
                          ) : (
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-gray-400 border transition-colors", user.settings?.isDarkMode ? "bg-gray-900 border-gray-800" : "bg-gray-100 border-gray-200")}>
                              <User size={20} />
                            </div>
                          )}
                          <div>
                            <p className={cn("font-bold transition-colors", user.settings?.isDarkMode ? "text-white" : "text-gray-900")}>{friendName}</p>
                            <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-bold">{t('isFriend')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => onOpenChat(friendship)}
                            className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all"
                            title={t('chat')}
                          >
                            <MessageCircle size={18} />
                          </button>
                          <button 
                            onClick={() => onRemoveFriendship(friendship.id)}
                            className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            title={t('removeFriend')}
                          >
                            <UserMinus size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <Users className="mx-auto text-gray-200 mb-3" size={40} />
                    <p className="text-sm text-gray-400 italic">{t('noFriends')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
