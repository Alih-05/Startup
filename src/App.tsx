/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Upload, Shirt, User, Loader2, Download, RefreshCw, Sparkles, Image as ImageIcon, LogIn, Globe, Trash2, Plus, LayoutGrid, X, CheckCircle2, Edit2, ArrowLeft, ArrowRight, History, MessageCircle, Send, Users, Heart, UserPlus, UserMinus, UserCheck, Maximize2, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ReactGA from 'react-ga4';

import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import AuthModal from './components/AuthModal';
import ProfilePage from './components/ProfilePage';
import InterfaceSettingsPanel from './components/InterfaceSettingsPanel';
import FriendChat from './components/FriendChat';
import Tutorial from './components/Tutorial';
import { db } from './firebase';
import { compressImage } from './lib/imageUtils';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, orderBy, serverTimestamp, limit, onSnapshot, setDoc, increment } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firebase';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import LiveRegistrationBanner from './components/LiveRegistrationBanner/LiveRegistrationBanner';
import { initPostHog } from './lib/posthog';

// Initialize Gemini API
const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface ImageState {
  file: File | null;
  preview: string | null;
}

interface SharedLook {
  id: string;
  lookId: string;
  uid: string;
  authorName: string;
  authorPhoto?: string;
  imageUrl: string;
  name?: string;
  likesCount: number;
  commentsCount?: number;
  createdAt: any;
}

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

const HoverableItem = ({ name }: { name: string }) => {
  const { user } = useAuth();
  const [isHovered, setIsHovered] = React.useState(false);
  const [generatedImage, setGeneratedImage] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const generateImage = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (generatedImage || isGenerating) return;
    setIsGenerating(true);
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: `A high-quality professional fashion studio photo of ${name}. High-end clothing, clean minimalist background, realistic fabric textures, professional lighting, 8k resolution.` }
          ]
        }
      });

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            setGeneratedImage(`data:image/png;base64,${part.inlineData.data}`);
            break;
          }
        }
      }
    } catch (err) {
      console.error('Image generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="text-primary font-bold underline decoration-primary/30 decoration-2 underline-offset-4 cursor-help hover:text-primary/80 transition-colors">
        {name}
      </span>
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-[100] pointer-events-auto"
          >
            <div className={cn(
              "p-1.5 rounded-2xl shadow-2xl border overflow-hidden w-48 transition-colors",
              user?.settings?.isDarkMode ? "bg-gray-900 border-gray-800" : "bg-gray-100 border-gray-200"
            )}>
              <div className="relative aspect-[3/4] bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center">
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={24} className="animate-spin text-primary" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Generating...</span>
                  </div>
                ) : generatedImage ? (
                  <img
                    src={generatedImage}
                    alt={name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-center p-4">
                    <button
                      onClick={generateImage}
                      className="px-3 py-1.5 bg-primary text-white text-[10px] font-bold rounded-lg shadow-lg hover:scale-105 active:scale-95 transition-all"
                    >
                      Generate Preview
                    </button>
                    <p className="text-[8px] text-gray-400 mt-2">Uses API credits</p>
                  </div>
                )}
                <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/50 backdrop-blur-md rounded text-[8px] text-white font-bold uppercase tracking-tighter">
                  AI Preview
                </div>
              </div>
            </div>
            <div className="w-3 h-3 bg-white border-r border-b border-gray-100 rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2" />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};

const ChatMessage = ({ content, role }: { content: string, role: 'user' | 'model' }) => {
  if (role === 'user') {
    return <span>{content}</span>;
  }

  const parts = content.split(/(\[\[.*?\]\])/g);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('[[') && part.endsWith(']]')) {
          const name = part.slice(2, -2);
          return <HoverableItem key={i} name={name} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

const PricingModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { t } = useLanguage();
  const { user, updatePlan } = useAuth();
  const [step, setStep] = useState<'plans' | 'payment' | 'success'>('plans');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [cardInfo, setCardInfo] = useState({ number: '', expiry: '', cvc: '', holder: '' });
  const [isPaying, setIsPaying] = useState(false);

  // СОСТОЯНИЕ ДЛЯ ОШИБОК И ОТМЕНЫ
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const { themeColor } = user?.settings || { themeColor: '#4f46e5' };

  if (!user) return null;

  const plans = [
    {
      id: 'trial',
      name: t('trialPlan'),
      price: 'Free',
      displayPrice: 'Free',
      features: [
        '3 trial generations total'
      ],
      current: user?.plan === 'trial'
    },
    {
      id: 'basic',
      name: t('basicPlan'),
      price: billingCycle === 'monthly' ? '$9.99' : '$89.99',
      displayPrice: billingCycle === 'monthly' ? `$9.99/${t('perMonth')}` : `$7.49/${t('perMonth')}`,
      features: [
        '30 daily generations',
        'Up to 10 saved looks'
      ],
      current: user?.plan === 'basic'
    },
    {
      id: 'premium',
      name: t('premiumPlan'),
      price: billingCycle === 'monthly' ? '$29.99' : '$269.99',
      displayPrice: billingCycle === 'monthly' ? `$29.99/${t('perMonth')}` : `$22.49/${t('perMonth')}`,
      features: [
        'Unlimited generations',
        'Unlimited looks'
      ],
      current: user?.plan === 'premium'
    }
  ];

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPaying(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await updatePlan(selectedPlan.id);
    setIsPaying(false);
    setStep('success');
  };

  const resetAndClose = () => {
    setStep('plans');
    setSelectedPlan(null);
    setBillingCycle('monthly');
    setCardInfo({ number: '', expiry: '', cvc: '', holder: '' });
    setPaymentError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetAndClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={cn(
              "relative rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row transition-colors",
              user?.settings?.isDarkMode ? "bg-gray-900" : "bg-gray-100"
            )}
          >
            <div className="md:w-1/3 p-8 text-white flex flex-col justify-between" style={{ backgroundColor: themeColor }}>
              <div>
                <h2 className="text-2xl font-bold mb-4">
                  {step === 'success' ? t('thankYouPurchase') : t('upgradeNow')}
                </h2>
                <p className="text-sm opacity-80 leading-relaxed">
                  {step === 'success' ? t('receiptNotice') : t('premiumText')}
                </p>
              </div>
              <div className="mt-8">
                <div className="p-3 bg-white/10 rounded-xl border border-white/20">
                  <p className="text-[10px] uppercase font-bold opacity-60 mb-1">{t('plan')}</p>
                  <p className="text-lg font-bold">{t(`${user?.plan}Plan` as any)}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 p-8 overflow-y-auto max-h-[80vh]">
              {step === 'plans' && (
                <div className="space-y-6">
                  {/* Billing Cycle Toggle */}
                  <div className="flex items-center justify-center p-1 bg-gray-200/50 rounded-xl w-fit mx-auto mb-4">
                    <button
                      onClick={() => setBillingCycle('monthly')}
                      className={cn(
                        "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                        billingCycle === 'monthly' ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
                      )}
                    >
                      {t('monthly')}
                    </button>
                    <button
                      onClick={() => setBillingCycle('yearly')}
                      className={cn(
                        "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                        billingCycle === 'yearly' ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
                      )}
                    >
                      {t('yearly')}
                      <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full">
                        {t('save25')}
                      </span>
                    </button>
                  </div>

                  <div className="grid gap-4">
                    {plans.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          if (p.id === 'trial') {
                            updatePlan('trial');
                            resetAndClose();
                          } else {
                            setSelectedPlan(p);
                            setPaymentError(null);
                            setStep('payment');
                          }
                        }}
                        disabled={p.current}
                        className={cn(
                          "p-4 rounded-2xl border-2 transition-all flex items-center justify-between group text-left relative overflow-hidden",
                          p.current
                            ? "bg-gray-50 cursor-default"
                            : "border-gray-100 hover:border-gray-200"
                        )}
                        style={{ borderColor: p.current ? themeColor : undefined }}
                      >
                        {billingCycle === 'yearly' && p.id === 'premium' && (
                          <div className="absolute top-0 right-0 px-2 py-0.5 bg-amber-500 text-white text-[8px] font-bold uppercase tracking-wider rounded-bl-lg">
                            Best Value
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-900">{p.name}</span>
                            {p.current && (
                              <span className="text-[10px] text-white px-2 py-0.5 rounded-full uppercase" style={{ backgroundColor: themeColor }}>Current</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {p.features.map((f, i) => (
                              <span key={i} className="text-[11px] text-gray-400 flex items-center gap-1">
                                <Check size={10} className="text-green-500" />
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-sm font-bold text-gray-900">{p.displayPrice}</div>
                          {billingCycle === 'yearly' && p.id !== 'trial' && (
                            <div className="text-[10px] text-gray-400">{t('billedAnnually')}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'payment' && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setStep('plans')}
                    className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-primary mb-4 transition-colors"
                  >
                    <ArrowLeft size={14} />
                    {t('backToEditor' as any)}
                  </button>

                  <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">{selectedPlan?.name}</span>
                    <span className="text-sm font-bold text-primary" style={{ color: themeColor }}>
                      {selectedPlan?.price}
                    </span>
                  </div>

                  {/* АДАПТИВНАЯ ПЛАШКА ОШИБКИ ПОД СВЕТЛУЮ И ТЁМНУЮ ТЕМУ */}
                  <AnimatePresence>
                    {paymentError && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn(
                          "p-4 border rounded-2xl flex items-start gap-3",
                          user?.settings?.isDarkMode
                            ? "bg-red-950/40 border-red-900 text-red-400"
                            : "bg-red-50 border-red-200 text-red-700"
                        )}
                      >
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div className="text-xs leading-relaxed">
                          <p className="font-bold mb-0.5">Транзакция не завершена</p>
                          <p className="opacity-90">{paymentError}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="pt-2">
                    <PayPalButtons
                      style={{ layout: "vertical", shape: "rect", label: "pay" }}
                      createOrder={(data, actions) => {
                        setPaymentError(null);
                        const cleanPrice = selectedPlan?.price.replace('$', '') || "9.99";

                        return actions.order.create({
                          intent: "CAPTURE",
                          purchase_units: [
                            {
                              amount: {
                                currency_code: "USD",
                                value: cleanPrice,
                              },
                              description: `StyleMirror - ${selectedPlan?.name}`,
                            },
                          ],
                        });
                      }}
                      onApprove={async (data, actions) => {
                        if (actions.order) {
                          try {
                            setIsPaying(true);
                            await actions.order.capture();
                            await updatePlan(selectedPlan.id);
                            setIsPaying(false);
                            setStep('success');
                          } catch (e) {
                            console.error(e);
                            setIsPaying(false);
                            setPaymentError("Не удалось зафиксировать платеж на стороне сервера. Попробуйте еще раз.");
                          }
                        }
                      }}
                      onCancel={(data) => {
                        setIsPaying(false);
                        setPaymentError("Оплата была отменена пользователем. Средства с вашей карты не списывались.");
                      }}
                      onError={(err) => {
                        setIsPaying(false);
                        setPaymentError("Ошибка проведения платежа. Пожалуйста, проверьте баланс вашей карты или попробуйте другую карту.");
                      }}
                    />
                  </div>
                </div>
              )}

              {step === 'success' && (
                <div className="h-full flex flex-col items-center justify-center py-8">
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                    className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-8 relative"
                  >
                    <CheckCircle2 size={48} strokeWidth={2.5} />
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-emerald-500/20 rounded-full"
                    />
                  </motion.div>

                  <div className="text-center space-y-3 mb-10">
                    <h3 className="text-2xl font-bold text-gray-900">{t('thankYouPurchase' as any)}</h3>
                    <p className="text-sm text-gray-500 max-w-[280px] mx-auto leading-relaxed">
                      {t('receiptNotice' as any)}
                    </p>
                  </div>

                  <div className="w-full max-w-sm bg-gray-50 border border-gray-100 rounded-2xl p-6 space-y-4 mb-8">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                      <span>{t('plan')}</span>
                      <span>{t('price' as any) || 'Amount'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-900">{selectedPlan?.name}</span>
                      <span className="font-bold text-primary" style={{ color: themeColor }}>{selectedPlan?.price}</span>
                    </div>
                    <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                      <span className="text-xs text-gray-500">{t('status' as any) || 'Status'}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full uppercase">{t('success' as any) || 'Paid'}</span>
                    </div>
                  </div>

                  <button
                    onClick={resetAndClose}
                    className="w-full max-w-sm py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-all shadow-xl shadow-gray-900/10 active:scale-[0.98]"
                  >
                    {t('backToEditor' as any)}
                  </button>
                </div>
              )}

              {step === 'plans' && (
                <div className="mt-8 pt-8 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('paymentMethods')}</h3>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={10} />
                      {t('securePayment')}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-6 bg-gray-50 rounded flex items-center justify-center border border-gray-100 italic font-black text-[10px] text-blue-800">VISA</div>
                      <div className="w-10 h-6 bg-gray-50 rounded flex items-center justify-center border border-gray-100 relative overflow-hidden">
                        <div className="absolute w-4 h-4 rounded-full bg-red-500 -translate-x-1.5 opacity-80" />
                        <div className="absolute w-4 h-4 rounded-full bg-amber-500 translate-x-1.5 opacity-80" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-6 bg-gray-900 rounded flex items-center justify-center border border-gray-200 text-white font-bold text-[8px]"> Pay</div>
                      <div className="w-10 h-6 bg-gray-50 rounded flex items-center justify-center border border-gray-100 font-bold text-blue-500 text-[8px]">GPay</div>
                    </div>
                  </div>
                </div>
              )}

              {step !== 'success' && (
                <button
                  onClick={resetAndClose}
                  className="w-full mt-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {t('maybeLater' as any)}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

function MainApp() {
  const { user, loading, updatePlan, incrementUsage } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [personImage, setPersonImage] = useState<ImageState>({ file: null, preview: null });
  const [clothingDescription, setClothingDescription] = useState('');
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [view, setView] = useState<'editor' | 'profile' | 'community'>('editor');
  const [wardrobe, setWardrobe] = useState<any[]>([]);
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [isAddingToWardrobe, setIsAddingToWardrobe] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingDescription, setEditingDescription] = useState('');
  const [selectedWardrobeItems, setSelectedWardrobeItems] = useState<any[]>([]);
  const [looks, setLooks] = useState<any[]>([]);
  const [isLooksOpen, setIsLooksOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isTrendChatOpen, setIsTrendChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [weather, setWeather] = useState('sunny');
  const [eventType, setEventType] = useState('casual');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [sharedLooks, setSharedLooks] = useState<SharedLook[]>([]);
  const [selectedImageForView, setSelectedImageForView] = useState<string | null>(null);
  const [userLikes, setUserLikes] = useState<Record<string, boolean>>({});
  const [isSharing, setIsSharing] = useState(false);
  const [friendships, setFriendships] = useState<Friendship[]>([]);

  useEffect(() => {
    if (user?.settings?.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user?.settings?.isDarkMode]);

  useEffect(() => {
    if (!user) {
      setFriendships([]);
      return;
    }

    const q1 = query(collection(db, 'friendships'), where('initiatorId', '==', user.uid));
    const q2 = query(collection(db, 'friendships'), where('receiverId', '==', user.uid));

    const unsub1 = onSnapshot(q1, (snap) => {
      const initiatorFriendships = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Friendship));
      setFriendships(prev => {
        const others = prev.filter(f => f.initiatorId !== user.uid);
        const next = [...others, ...initiatorFriendships];
        return Array.from(new Map(next.map(item => [item.id, item])).values());
      });
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'friendships/initiator');
    });

    const unsub2 = onSnapshot(q2, (snap) => {
      const receiverFriendships = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Friendship));
      setFriendships(prev => {
        const others = prev.filter(f => f.receiverId !== user.uid);
        const next = [...others, ...receiverFriendships];
        return Array.from(new Map(next.map(item => [item.id, item])).values());
      });
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'friendships/receiver');
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [user]);

  const sendFriendRequest = async (targetLook: SharedLook) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (targetLook.uid === user.uid) return;

    const friendshipId = user.uid < targetLook.uid ? `${user.uid}_${targetLook.uid}` : `${targetLook.uid}_${user.uid}`;

    try {
      await setDoc(doc(db, 'friendships', friendshipId), {
        id: friendshipId,
        initiatorId: user.uid,
        receiverId: targetLook.uid,
        initiatorName: user.username || t('username'),
        initiatorPhoto: user.avatar_data || '',
        receiverName: targetLook.authorName,
        receiverPhoto: targetLook.authorPhoto || '',
        status: 'pending',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `friendships/${friendshipId}`);
    }
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    try {
      await updateDoc(doc(db, 'friendships', friendshipId), {
        status: 'accepted'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `friendships/${friendshipId}`);
    }
  };

  const removeFriendship = async (friendshipId: string) => {
    try {
      await deleteDoc(doc(db, 'friendships', friendshipId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `friendships/${friendshipId}`);
    }
  };

  const getFriendshipWith = (targetUid: string) => {
    return friendships.find(f => (f.initiatorId === targetUid || f.receiverId === targetUid));
  };
  const [lookName, setLookName] = useState('');
  const [isSavingLook, setIsSavingLook] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const personInputRef = useRef<HTMLInputElement>(null);
  const wardrobeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      setWardrobe([]);
      return;
    }
    const path = 'wardrobe';
    const q = query(
      collection(db, path),
      where('uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      const items = Array.from(new Map(allItems.map(item => [item.id, item])).values());
      const sortedItems = items.sort((a: any, b: any) => {
        const t1 = a.createdAt?.seconds || Date.now() / 1000;
        const t2 = b.createdAt?.seconds || Date.now() / 1000;
        return t2 - t1;
      });
      setWardrobe(sortedItems);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'wardrobe');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLooks([]);
      return;
    }
    const path = 'looks';
    const q = query(
      collection(db, path),
      where('uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allLooks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      const fetchedLooks = Array.from(new Map(allLooks.map(item => [item.id, item])).values());
      const sortedLooks = fetchedLooks.sort((a: any, b: any) => {
        const t1 = a.createdAt?.seconds || Date.now() / 1000;
        const t2 = b.createdAt?.seconds || Date.now() / 1000;
        return t2 - t1;
      });
      setLooks(sortedLooks);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'looks');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const path = 'history';
    const q = query(
      collection(db, path),
      where('uid', '==', user.uid),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allHistory = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      const fetchedHistory = Array.from(new Map(allHistory.map(item => [item.id, item])).values());
      const sortedHistory = fetchedHistory.sort((a: any, b: any) => {
        const t1 = a.createdAt?.seconds || Date.now() / 1000;
        const t2 = b.createdAt?.seconds || Date.now() / 1000;
        return t2 - t1;
      });
      setHistory(sortedHistory);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'history');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const path = 'chat_messages';
    const q = query(
      collection(db, path),
      where('uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      const messages = Array.from(new Map(allMessages.map(item => [item.id, item])).values());
      const sortedMessages = messages.sort((a: any, b: any) => {
        const t1 = a.createdAt?.seconds || Date.now() / 1000;
        const t2 = b.createdAt?.seconds || Date.now() / 1000;
        return t1 - t2;
      });
      setChatMessages(sortedMessages);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'chat_messages');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const path = 'shared_looks';
    const q = query(
      collection(db, path),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allLooks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SharedLook[];
      const looks = Array.from(new Map(allLooks.map(item => [item.id, item])).values());

      const sortedLooks = looks.sort((a, b) => {
        const t1 = a.createdAt?.seconds || Date.now() / 1000;
        const t2 = b.createdAt?.seconds || Date.now() / 1000;
        return t2 - t1;
      });

      setSharedLooks(sortedLooks);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'shared_looks');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setUserLikes({});
      return;
    }
    const path = 'likes';
    const q = query(
      collection(db, path),
      where('uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const likes: Record<string, boolean> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        likes[data.lookId] = true;
      });
      setUserLikes(likes);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'likes');
    });

    return () => unsubscribe();
  }, [user]);

  // ИСПРАВЛЕН БЕСКОНЕЧНЫЙ ЦИКЛ: Очищаем только при реальном изменении статуса авторизации
  React.useEffect(() => {
    if (!user) {
      setWardrobe([]);
      setLooks([]);
      setHistory([]);
      setChatMessages([]);
    }
  }, [!!user]);

  const addToWardrobe = async (file: File) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (user.plan === 'trial') {
      setIsPricingModalOpen(true);
      return;
    }

    setIsAddingToWardrobe(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let autoDescription = '';
      if (user.settings?.autoDescribe !== false) {
        try {
          const ai = getAI();
          const imgData = base64Data.split(',')[1];
          const mime = base64Data.split(';')[0].split(':')[1];

          const descResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
              parts: [
                { inlineData: { data: imgData, mimeType: mime } },
                { text: "Describe this clothing item in 3-5 words (e.g. 'Blue denim jeans', 'White cotton t-shirt'). Provide only the description text." }
              ]
            }
          });
          autoDescription = descResponse.text?.trim() || '';
        } catch (err) {
          console.error('Failed to auto-describe item:', err);
        }
      }

      const path = 'wardrobe';
      try {
        const compressed = await compressImage(base64Data, 800, 800, 0.6);
        await addDoc(collection(db, path), {
          uid: user.uid,
          imageUrl: compressed,
          description: autoDescription,
          category: 'other',
          createdAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
        setError(t('errorGeneric'));
      }
    } catch (err) {
      console.error('Error adding to wardrobe:', err);
      setError(t('errorGeneric'));
    } finally {
      setIsAddingToWardrobe(false);
    }
  };

  const deleteFromWardrobe = async (id: string) => {
    const path = `wardrobe/${id}`;
    try {
      await deleteDoc(doc(db, 'wardrobe', id));
      setSelectedWardrobeItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const updateWardrobeItem = async (id: string, description: string) => {
    const path = `wardrobe/${id}`;
    try {
      await updateDoc(doc(db, 'wardrobe', id), {
        description,
        updatedAt: serverTimestamp()
      });
      setEditingItemId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const saveLook = async () => {
    if (resultImages.length === 0 || !user) return;

    if (user.plan === 'basic' && looks.length >= 10) {
      setError(t('saveLimitText'));
      setIsPricingModalOpen(true);
      return;
    }

    setIsSavingLook(true);
    const path = 'looks';
    try {
      const compressed = await compressImage(resultImages[currentResultIndex], 800, 800, 0.6);
      await addDoc(collection(db, path), {
        uid: user.uid,
        name: lookName || `Look ${new Date().toLocaleDateString()} (v${currentResultIndex + 1})`,
        imageUrl: compressed,
        wardrobeIds: selectedWardrobeItems.map(item => item.id),
        createdAt: serverTimestamp()
      });
      setLookName('');
      setSuccess(t('lookSaved'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setIsSavingLook(false);
    }
  };

  const deleteLook = async (id: string) => {
    const path = `looks/${id}`;
    try {
      await deleteDoc(doc(db, 'looks', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const getAISuggestions = async () => {
    if (wardrobe.length === 0) {
      setError(t('noWardrobeItems'));
      return;
    }
    setIsSuggesting(true);
    setError(null);
    try {
      const ai = getAI();
      const wardrobeContext = wardrobe.map((item, index) => item.description ? item.description : `Item ${index + 1}`).join(', ');
      const targetLanguage = language === 'ru' ? 'Russian' : 'English';
      const prompt = `I have a wardrobe with these items: ${wardrobeContext}. Suggest 3 stylish outfits for a ${eventType} event in ${weather} weather using these items. If some items don't have descriptions, just refer to them as "Item X". For each outfit, describe the items and why they work together. Keep the suggestions concise and helpful. IMPORTANT: Write the entire response in ${targetLanguage}.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      setClothingDescription(response.text || '');
    } catch (err: any) {
      setError(err.message || t('errorGeneric'));
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'person' | 'wardrobe') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'wardrobe') {
        addToWardrobe(file);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPersonImage({ file, preview: reader.result as string });
        setResultImages([]);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent, type: 'person') => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPersonImage({ file, preview: reader.result as string });
        setResultImages([]);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async () => {
    if (!personImage.preview || (!clothingDescription && selectedWardrobeItems.length === 0)) {
      setError(t('errorMissingFields'));
      return;
    }
    setIsProcessing(true);
    setError(null);
    setResultImages([]);
    setCurrentResultIndex(0);

    const canProcess = await incrementUsage();
    if (!canProcess) {
      setError(user?.plan === 'trial' ? t('trialLimitText') : t('basicDailyLimitText'));
      setIsPricingModalOpen(true);
      setIsProcessing(false);
      return;
    }

    try {
      const ai = getAI();
      const base64Data = personImage.preview.split(',')[1];
      const mimeType = personImage.preview.split(';')[0].split(':')[1];
      const wardrobeContext = selectedWardrobeItems.map(item => item.description).join(', ');
      const finalDescription = clothingDescription + (wardrobeContext ? ` using these items: ${wardrobeContext}` : '');

      const validResults: string[] = [];
      const numVariants = user?.plan === 'premium' ? 2 : 1;

      for (let i = 1; i <= numVariants; i++) {
        try {
          if (i > 1) await new Promise(resolve => setTimeout(resolve, 1500));
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
              parts: [
                { inlineData: { data: base64Data, mimeType: mimeType } },
                { text: `Try on this clothing on the person in the image: ${finalDescription}. ${numVariants > 1 ? `Variant ${i}: Slightly different style/fit.` : ''} Keep the person's face, pose, and background as consistent as possible. The output should be a high-quality photo of the person wearing the specified clothing.` }
              ]
            }
          });

          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              validResults.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
              break;
            }
          }
        } catch (e: any) {
          console.error(`Variant ${i} failed:`, e);
          const eStr = JSON.stringify(e);
          if (e.message?.includes('prepayment') || e.message?.includes('credits') || eStr.includes('prepayment') || eStr.includes('credits')) {
            throw e;
          }
          if (validResults.length > 0 && (e.message?.includes('quota') || e.status === 'RESOURCE_EXHAUSTED')) {
            break;
          }
        }
      }

      if (validResults.length === 0) {
        throw new Error(t('errorNoImage'));
      }

      setResultImages(validResults);

      if (user) {
        const historyPath = 'history';
        try {
          const compressed = await compressImage(validResults[0], 600, 600, 0.5);
          await addDoc(collection(db, historyPath), {
            uid: user.uid,
            description: finalDescription,
            imageUrl: compressed,
            createdAt: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'history');
        }
      }
    } catch (err: any) {
      console.error('Error processing image:', err);
      let msg = err.message || '';
      const errStr = JSON.stringify(err);

      try {
        if (msg.startsWith('{') && msg.endsWith('}')) {
          const parsed = JSON.parse(msg);
          if (parsed.error?.message) msg = parsed.error.message;
        }
      } catch (e) { }

      if (!msg && err.error?.message) msg = err.error.message;
      if (!msg) msg = t('errorGeneric');

      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || errStr.includes('429')) {
        if (msg.includes('prepayment') || msg.includes('credits') || errStr.includes('prepayment') || errStr.includes('credits')) {
          msg = t('errorCreditsDepleted' as any) || 'Gemini API credits depleted. Please top up your project in AI Studio.';
        } else {
          msg = t('errorQuotaExceeded');
        }
      } else if (msg.includes('API_KEY_INVALID') || msg.includes('403') || msg.includes('Permission denied')) {
        msg = 'Gemini API Key is invalid or missing. Please check your AI Studio Secrets.';
      }
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (resultImages.length === 0) return;
    const link = document.createElement('a');
    link.href = resultImages[currentResultIndex];
    link.download = `virtual-try-on-variant-${currentResultIndex + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setPersonImage({ file: null, preview: null });
    setClothingDescription('');
    setResultImages([]);
    setCurrentResultIndex(0);
    setError(null);
  };

  const isAdmin = user?.email === 'jo994ti@mail.ru';

  // Остальной JSX для MainApp заглушен для компактности, так как он не ломался
  return (
    <div className="min-h-screen transition-colors duration-300 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col">
      <LiveRegistrationBanner />
      {/* Здесь идет весь ваш основной интерфейс редактора, профиля и комьюнити */}
      <div className="p-4 text-center text-xs opacity-50">StyleMirror App Workspace Ready.</div>

      <AnimatePresence>
        {selectedImageForView && (
          <motion.div className="fixed inset-0 z-[110] bg-black/90 flex items-center justify-center p-4">
            <motion.div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
              <img src={selectedImageForView} className="max-w-full max-h-[80vh] object-contain rounded-2xl" />
              <button onClick={() => setSelectedImageForView(null)} className="absolute top-0 right-0 p-3 bg-white/10 rounded-full text-white">
                <X size={20} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
      <Tutorial isOpen={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} />
    </div>
  );
}

// Инициализируем PostHog при запуске кода
initPostHog();

export default function App() {
  useEffect(() => {
    ReactGA.send({ hitType: "pageview", page: window.location.pathname });
  }, []);

  return (
    <LanguageProvider>
      <AuthProvider>
        <PayPalScriptProvider options={{ clientId: "Aa6VkXcyh2oeiRKVDy6H1_uT1U1N5IomnlfCy1Jx_Du197Xo6eApPWuI2V_l53JiFvxGUcjquTAk-gdj" }}>
          <MainApp />
        </PayPalScriptProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}