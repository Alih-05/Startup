/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Upload, Shirt, User, Loader2, Download, RefreshCw, Sparkles, Image as ImageIcon, LogIn, Globe, Trash2, Plus, LayoutGrid, X, CheckCircle2, Edit2, ArrowLeft, ArrowRight, History, MessageCircle, Send, Users, Heart, UserPlus, UserMinus, UserCheck, Maximize2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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
    // Simulate payment delay
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
                <form onSubmit={handlePay} className="space-y-4">
                  <button 
                    type="button"
                    onClick={() => setStep('plans')}
                    className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-primary mb-4 transition-colors"
                  >
                    <ArrowLeft size={14} />
                    {t('backToEditor' as any)}
                  </button>

                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">{selectedPlan.name}</span>
                      <span className="text-sm font-bold text-primary">{selectedPlan.price}</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{t('cardNumber' as any)}</label>
                        <input
                          required
                          type="text"
                          placeholder="0000 0000 0000 0000"
                          value={cardInfo.number}
                          onChange={(e) => setCardInfo(prev => ({ ...prev, number: e.target.value }))}
                          className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-primary transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{t('expiryDate' as any)}</label>
                          <input
                            required
                            type="text"
                            placeholder="MM/YY"
                            value={cardInfo.expiry}
                            onChange={(e) => setCardInfo(prev => ({ ...prev, expiry: e.target.value }))}
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-primary transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{t('cvc' as any)}</label>
                          <input
                            required
                            type="text"
                            placeholder="123"
                            value={cardInfo.cvc}
                            onChange={(e) => setCardInfo(prev => ({ ...prev, cvc: e.target.value }))}
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-primary transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{t('cardHolder' as any)}</label>
                        <input
                          required
                          type="text"
                          placeholder="IVAN IVANOV"
                          value={cardInfo.holder}
                          onChange={(e) => setCardInfo(prev => ({ ...prev, holder: e.target.value }))}
                          className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-primary transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isPaying}
                      className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                      style={{ backgroundColor: themeColor }}
                    >
                      {isPaying ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
                      {t('payNow' as any)}
                    </button>
                  </div>
                </form>
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

    // Listen for friendships where user is initiator or receiver
    const q1 = query(collection(db, 'friendships'), where('initiatorId', '==', user.uid));
    const q2 = query(collection(db, 'friendships'), where('receiverId', '==', user.uid));

    const unsub1 = onSnapshot(q1, (snap) => {
      const initiatorFriendships = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Friendship));
      setFriendships(prev => {
        const others = prev.filter(f => f.initiatorId !== user.uid);
        const next = [...others, ...initiatorFriendships];
        // Deduplicate by ID
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
        // Deduplicate by ID
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

    // Predicted ID minUid_maxUid
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
      // Deduplicate by ID
      const items = Array.from(new Map(allItems.map(item => [item.id, item])).values());
      // Sort client-side to avoid index requirements
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
      // Deduplicate by ID
      const fetchedLooks = Array.from(new Map(allLooks.map(item => [item.id, item])).values());
      // Sort client-side to avoid index requirements
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
      // Deduplicate by ID
      const fetchedHistory = Array.from(new Map(allHistory.map(item => [item.id, item])).values());
      // Sort client-side to avoid index requirements
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
      // Deduplicate by ID
      const messages = Array.from(new Map(allMessages.map(item => [item.id, item])).values());
      // Sort manually for now to avoid index issues
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
      // Deduplicate by ID
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

  React.useEffect(() => {
    if (!user) {
      setWardrobe([]);
      setLooks([]);
      setHistory([]);
      setChatMessages([]);
    }
  }, [user]);

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
      
      // Use Gemini to describe the clothing item automatically
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
        // Use aggressive compression to stay under 1MB limit
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
      // Use aggressive compression to stay under 1MB limit
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
      const wardrobeContext = wardrobe.map((item, index) => 
        item.description ? item.description : `Item ${index + 1}`
      ).join(', ');
      
      const targetLanguage = language === 'ru' ? 'Russian' : 'English';
      
      const prompt = `I have a wardrobe with these items: ${wardrobeContext}. 
      Suggest 3 stylish outfits for a ${eventType} event in ${weather} weather using these items. 
      If some items don't have descriptions, just refer to them as "Item X".
      For each outfit, describe the items and why they work together. 
      Keep the suggestions concise and helpful.
      IMPORTANT: Write the entire response in ${targetLanguage}.`;

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

      // Generate 1 variant by default to save API credits
      const validResults: string[] = [];
      const numVariants = user?.plan === 'premium' ? 2 : 1;
      
      for (let i = 1; i <= numVariants; i++) {
        try {
          // Add a small delay between requests to avoid hitting rate limits
          if (i > 1) await new Promise(resolve => setTimeout(resolve, 1500));
          
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType: mimeType,
                  },
                },
                {
                  text: `Try on this clothing on the person in the image: ${finalDescription}. 
                  ${numVariants > 1 ? `Variant ${i}: Slightly different style/fit.` : ''}
                  Keep the person's face, pose, and background as consistent as possible. 
                  The output should be a high-quality photo of the person wearing the specified clothing.`,
                },
              ],
            },
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
          const isCreditsError = e.message?.includes('prepayment') || e.message?.includes('credits') || eStr.includes('prepayment') || eStr.includes('credits');
          
          if (isCreditsError) {
            throw e; // Propagate credit errors immediately
          }

          // If we already have at least one result, we can continue
          if (validResults.length > 0 && (e.message?.includes('quota') || e.status === 'RESOURCE_EXHAUSTED')) {
            break; 
          }
        }
      }

      if (validResults.length === 0) {
        throw new Error(t('errorNoImage'));
      }

      setResultImages(validResults);

      // Save to history
      if (user) {
        const historyPath = 'history';
        try {
          // Use more aggressive compression for history to ensure it stays under 1MB
          const compressed = await compressImage(validResults[0], 600, 600, 0.5);
          await addDoc(collection(db, historyPath), {
            uid: user.uid,
            description: finalDescription,
            imageUrl: compressed,
            createdAt: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'history');
          // Don't throw here, so the user still sees the result
        }
      }
    } catch (err: any) {
      console.error('Error processing image:', err);
      
      let msg = err.message || '';
      const errStr = JSON.stringify(err);
      
      // Attempt to parse msg if it's a JSON string
      try {
        if (msg.startsWith('{') && msg.endsWith('}')) {
          const parsed = JSON.parse(msg);
          if (parsed.error?.message) {
            msg = parsed.error.message;
          }
        }
      } catch (e) {
        // Not a JSON string, keep msg as is
      }

      if (!msg && err.error?.message) {
        msg = err.error.message;
      }

      if (!msg) {
        msg = t('errorGeneric');
      }
      
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

  const toggleLike = async (sharedLook: SharedLook) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    const likeId = `${user.uid}_${sharedLook.id}`;
    const isLiked = userLikes[sharedLook.id];

    try {
      if (isLiked) {
        // Unlike
        await deleteDoc(doc(db, 'likes', likeId));
        await updateDoc(doc(db, 'shared_looks', sharedLook.id), {
          likesCount: increment(-1)
        });
      } else {
        // Like
        await setDoc(doc(db, 'likes', likeId), {
          uid: user.uid,
          lookId: sharedLook.id,
          createdAt: serverTimestamp()
        });
        
        await updateDoc(doc(db, 'shared_looks', sharedLook.id), {
          likesCount: increment(1)
        });
      }
    } catch (err: any) {
      if (err.message?.includes('quota') || err.message?.includes('exhausted')) {
        setError(t('errorQuotaExceededFirestore' as any));
      } else {
        handleFirestoreError(err, OperationType.WRITE, `likes/${likeId}`);
      }
    }
  };

  const [selectedLookForComments, setSelectedLookForComments] = useState<string | null>(null);
  const [lookComments, setLookComments] = useState<{ [lookId: string]: any[] }>({});
  const [commentInput, setCommentInput] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [activeChatFriend, setActiveChatFriend] = useState<{ id: string, name: string, photo?: string } | null>(null);

  useEffect(() => {
    // Listen for comments only for the selected look to save reads/quota
    if (!selectedLookForComments) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'look_comments'), 
        where('lookId', '==', selectedLookForComments),
        orderBy('createdAt', 'desc')
      ),
      (snapshot) => {
        const allComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const comments = Array.from(new Map(allComments.map(item => [item.id, item])).values());
        setLookComments(prev => ({ ...prev, [selectedLookForComments]: comments }));
      }, (err: any) => {
        if (err.message?.includes('quota') || err.message?.includes('exhausted')) {
          setError(t('errorQuotaExceededFirestore' as any));
        } else {
          handleFirestoreError(err, OperationType.LIST, `look_comments/${selectedLookForComments}`);
        }
      }
    );
    return () => unsubscribe();
  }, [selectedLookForComments]);

  const deleteSharedLook = async (lookId: string) => {
    if (!user) return;
    if (!window.confirm(t('confirmDeleteLook'))) return;

    try {
      await deleteDoc(doc(db, 'shared_looks', lookId));
      setSharedLooks(prev => prev.filter(l => l.id !== lookId));
    } catch (err: any) {
      console.error('Delete shared look error:', err);
      // Give a more descriptive error if it's a permission issue
      if (err.message?.includes('permission')) {
        setError(language === 'ru' ? 'Недостаточно прав для удаления этого фото.' : 'Insufficient permissions to delete this photo.');
      } else {
        handleFirestoreError(err, OperationType.DELETE, `shared_looks/${lookId}`);
      }
    }
  };

  const postComment = async (lookId: string) => {
    if (!user || !commentInput.trim()) return;

    setIsPostingComment(true);
    try {
      const commentData: any = {
        lookId,
        uid: user.uid,
        authorName: user.username,
        text: commentInput.trim(),
        createdAt: serverTimestamp()
      };
      
      if (user.avatar_data) {
        commentData.authorPhoto = user.avatar_data;
      }

      await addDoc(collection(db, 'look_comments'), commentData);

      // Increment comment count
      await updateDoc(doc(db, 'shared_looks', lookId), {
        commentsCount: increment(1)
      });

      setCommentInput('');
    } catch (err: any) {
      if (err.message?.includes('quota') || err.message?.includes('exhausted')) {
        setError(t('errorQuotaExceededFirestore' as any));
      } else {
        handleFirestoreError(err, OperationType.WRITE, 'look_comments');
      }
    } finally {
      setIsPostingComment(false);
    }
  };

  const deleteComment = async (commentId: string, lookId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'look_comments', commentId));
      
      const look = sharedLooks.find(l => l.id === lookId);
      if (look) {
        await updateDoc(doc(db, 'shared_looks', lookId), {
          commentsCount: Math.max(0, (look.commentsCount || 1) - 1)
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `look_comments/${commentId}`);
    }
  };

  const shareToCommunity = async () => {
    if (!user || resultImages.length === 0) return;
    
    setIsSharing(true);
    const path = 'shared_looks';
    try {
      const currentImage = resultImages[currentResultIndex];
      // Compress image before sharing to stay under 1MB Firestore limit
      const compressed = await compressImage(currentImage, 800, 800, 0.6);
      
      await addDoc(collection(db, path), {
        uid: user.uid,
        lookId: Date.now().toString(),
        authorName: user.username || t('username'),
        authorPhoto: user.avatar_data || '',
        imageUrl: compressed,
        name: lookName || t('appName'),
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp()
      });
      setSuccess(t('sharedToCommunity'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Share error:', err);
      handleFirestoreError(err, OperationType.WRITE, path);
      setError(t('errorGeneric'));
    } finally {
      setIsSharing(false);
    }
  };

  const nextResult = () => {
    setCurrentResultIndex(prev => (prev + 1) % resultImages.length);
  };

  const prevResult = () => {
    setCurrentResultIndex(prev => (prev - 1 + resultImages.length) % resultImages.length);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !user || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setIsChatLoading(true);

    const path = 'chat_messages';
    try {
      // Save user message
      await addDoc(collection(db, path), {
        uid: user.uid,
        role: 'user',
        content: userMessage,
        createdAt: serverTimestamp()
      });

      // Get AI response
      const ai = getAI();
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: t('trendChatInstruction')
        }
      });

      // Include history context
      const historyContext = chatMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
      const prompt = `${historyContext}\nUser: ${userMessage}`;

      const response = await chat.sendMessage({ message: prompt });
      const aiText = response.text || '';

      // Save AI message
      await addDoc(collection(db, path), {
        uid: user.uid,
        role: 'model',
        content: aiText,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'chat_messages');
      setError(t('errorGeneric'));
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className={cn(
      "min-h-screen bg-site-bg font-sans selection:bg-primary/20 transition-colors duration-500",
      user?.settings?.isDarkMode ? "text-gray-100" : "text-gray-900"
    )}>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      
      {/* Header */}
      <header className={cn(
        "border-b sticky top-0 z-50 backdrop-blur-md transition-colors",
        user?.settings?.isDarkMode ? "bg-gray-900/80 border-gray-800" : "bg-gray-100/80 border-gray-200"
      )}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt={t('appName')} className="w-10 h-10 object-contain" />
              <h1 className={cn("text-xl font-bold tracking-tight transition-colors", user?.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                {t('appName')}
              </h1>
            </div>

          <div className="flex items-center gap-4">
            <nav className={cn(
              "hidden md:flex items-center gap-1 p-1 rounded-xl transition-colors",
              user?.settings?.isDarkMode ? "bg-gray-900" : "bg-gray-200"
            )}>
              <button
                onClick={() => setView('editor')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                  view === 'editor' 
                    ? user?.settings?.isDarkMode ? "bg-gray-800 text-primary shadow-sm" : "bg-gray-50 text-primary shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Shirt size={16} />
                {t('editor')}
              </button>
              <button
                onClick={() => setView('community')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                  view === 'community' 
                    ? user?.settings?.isDarkMode ? "bg-gray-800 text-primary shadow-sm" : "bg-gray-50 text-primary shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Users size={16} />
                {t('community')}
              </button>
            </nav>

            {/* Language Switcher */}
            <div className={cn(
              "flex items-center rounded-full p-1 transition-colors",
              user?.settings?.isDarkMode ? "bg-gray-900" : "bg-gray-200"
            )}>
                <button
                  onClick={() => setLanguage('en')}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-full transition-all",
                    language === 'en' 
                      ? user?.settings?.isDarkMode ? "bg-gray-800 text-primary shadow-sm" : "bg-gray-50 text-primary shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('ru')}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-full transition-all",
                    language === 'ru' 
                      ? user?.settings?.isDarkMode ? "bg-gray-800 text-primary shadow-sm" : "bg-gray-50 text-primary shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  RU
                </button>
                <button
                  onClick={() => setLanguage('kz')}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-full transition-all",
                    language === 'kz' 
                      ? user?.settings?.isDarkMode ? "bg-gray-800 text-primary shadow-sm" : "bg-gray-50 text-primary shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  KZ
                </button>
            </div>

            <button 
              onClick={() => setIsHistoryOpen(true)}
              className="text-sm font-medium text-gray-500 hover:text-primary transition-colors flex items-center gap-2"
            >
              <History size={16} />
              {t('history')}
            </button>

            <button 
              onClick={() => setIsTutorialOpen(true)}
              className="text-sm font-medium text-gray-500 hover:text-primary transition-colors flex items-center gap-2"
              title={t('gettingStarted' as any)}
            >
              <Sparkles size={16} className="text-amber-500" />
              <span className="hidden lg:inline">{t('gettingStarted' as any)}</span>
            </button>

            <button 
              onClick={reset}
              className="text-sm font-medium text-gray-500 hover:text-black transition-colors flex items-center gap-2"
            >
              <RefreshCw size={14} />
              {t('reset')}
            </button>
            
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsLooksOpen(true)}
                  className="p-2 text-gray-500 hover:text-primary hover:bg-primary/5 rounded-full transition-all"
                  title={t('looks')}
                >
                  <RefreshCw size={20} />
                </button>
                <button
                  onClick={() => user.plan !== 'trial' && setIsWardrobeOpen(true)}
                  className={cn(
                    "p-2 text-gray-500 hover:text-primary hover:bg-primary/5 rounded-full transition-all",
                    user.plan === 'trial' && "opacity-50 cursor-not-allowed"
                  )}
                  title={user.plan === 'trial' ? "Only for Basic/Premium" : t('wardrobe')}
                >
                  <LayoutGrid size={20} />
                </button>
                <button 
                  onClick={() => setView('profile')}
                  className={cn(
                    "flex items-center gap-2 pl-2 pr-4 py-1.5 rounded-full border transition-all group",
                    user.settings?.isDarkMode ? "bg-gray-800 border-gray-700 hover:border-primary" : "bg-gray-50 border-gray-200 hover:border-primary"
                  )}
                >
                  <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-primary overflow-hidden">
                    {user.avatar_data ? (
                      <img src={user.avatar_data} alt={user.username} className="w-full h-full object-cover" />
                    ) : (
                      <User size={14} />
                    )}
                  </div>
                  <div className="flex flex-col items-start leading-tight">
                    <span className={cn("text-sm font-semibold transition-colors", user.settings?.isDarkMode ? "text-gray-200" : "text-gray-700")}>{user.username}</span>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-tighter opacity-70">
                      {t(`${user.plan}Plan` as any)}
                    </span>
                  </div>
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-full hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                <LogIn size={16} />
                {t('signIn')}
              </button>
            )}
          </div>
        </div>
      </header>

      {view === 'profile' ? (
        <ProfilePage 
          onBack={() => setView('editor')} 
          onUpgrade={() => setIsPricingModalOpen(true)}
          friendships={friendships}
          onAcceptRequest={acceptFriendRequest}
          onRemoveFriendship={removeFriendship}
          onOpenChat={(friendship) => {
            if (!user) return;
            const isInitiator = friendship.initiatorId === user.uid;
            const friendId = isInitiator ? friendship.receiverId : friendship.initiatorId;
            const friendName = isInitiator ? friendship.receiverName : friendship.initiatorName;
            const friendPhoto = isInitiator ? friendship.receiverPhoto : friendship.initiatorPhoto;
            setActiveChatFriend({ id: friendId, name: friendName, photo: friendPhoto });
          }}
        />
      ) : (
        <>
          {view === 'editor' && (
            <main className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
          
          {/* Left Column: Controls */}
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                <User size={16} />
                {t('step1')}
              </h2>
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, 'person')}
                onClick={() => personInputRef.current?.click()}
                className={cn(
                  "relative aspect-[4/3] rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center gap-4 transition-colors",
                  personImage.preview 
                    ? user?.settings?.isDarkMode ? "border-transparent bg-gray-800 shadow-sm" : "border-transparent bg-gray-100 shadow-sm"
                    : user?.settings?.isDarkMode ? "border-gray-700 bg-gray-800 hover:border-primary/40 hover:bg-primary/5" : "border-gray-200 bg-gray-100 hover:border-primary/40 hover:bg-primary/5"
                )}
              >
                <input 
                  type="file" 
                  ref={personInputRef}
                  onChange={(e) => handleFileChange(e, 'person')}
                  accept="image/*"
                  className="hidden"
                />
                
                {personImage.preview ? (
                  <>
                    <img src={personImage.preview} alt="Person" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white font-medium flex items-center gap-2">
                        <Upload size={18} />
                        {t('changePhoto')}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-8">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                      <Upload size={20} />
                    </div>
                    <p className="font-medium">{t('uploadHint')}</p>
                    <p className="text-sm text-gray-400 mt-1">{t('uploadSubHint')}</p>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                <Sparkles size={16} />
                {t('aiSuggestions')}
              </h2>
              <div className={cn(
                "p-6 rounded-2xl border shadow-sm space-y-4 transition-colors",
                user?.settings?.isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-100 border-gray-200"
              )}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('weather')}</label>
                    <select 
                      value={weather}
                      onChange={(e) => setWeather(e.target.value)}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
                    >
                      <option value="sunny">{t('sunny')}</option>
                      <option value="rainy">{t('rainy')}</option>
                      <option value="cold">{t('cold')}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('eventType')}</label>
                    <select 
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
                    >
                      <option value="casual">{t('casual')}</option>
                      <option value="formal">{t('formal')}</option>
                      <option value="party">{t('party')}</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={getAISuggestions}
                  disabled={isSuggesting || wardrobe.length === 0}
                  className="w-full py-2.5 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSuggesting ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                  {t('getSuggestions')}
                </button>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                <Shirt size={16} />
                {t('step2')}
              </h2>
              <div className="space-y-4">
                {selectedWardrobeItems.length > 0 && (
                  <div className={cn(
                    "flex flex-wrap gap-2 p-2 rounded-xl border transition-colors",
                    user?.settings?.isDarkMode ? "bg-primary/10 border-primary/20" : "bg-primary/5 border-primary/10"
                  )}>
                    {selectedWardrobeItems.map(item => (
                      <div key={item.id} className="relative w-12 h-16 rounded-lg overflow-hidden border border-primary/20 group">
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setSelectedWardrobeItems(prev => prev.filter(i => i.id !== item.id))}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => user?.plan !== 'trial' && setIsWardrobeOpen(true)}
                      className={cn(
                        "w-12 h-16 rounded-lg border-2 border-dashed border-primary/20 flex items-center justify-center text-primary/40 hover:border-primary/40 hover:text-primary transition-all",
                        user?.plan === 'trial' && "opacity-30 cursor-not-allowed hover:border-primary/20 hover:text-primary/40"
                      )}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                )}
                <textarea
                  value={clothingDescription}
                  onChange={(e) => setClothingDescription(e.target.value)}
                  placeholder={t('placeholderDescription')}
                  className={cn(
                    "w-full h-32 p-4 rounded-xl border outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none",
                    user?.settings?.isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-100 border-gray-200 text-gray-900"
                  )}
                />
                
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'businessSuit', label: t('businessSuit') },
                    { key: 'summerDress', label: t('summerDress') },
                    { key: 'streetwearHoodie', label: t('streetwearHoodie') },
                    { key: 'leatherJacket', label: t('leatherJacket') }
                  ].map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => setClothingDescription(prev => prev ? `${prev}, ${preset.label.toLowerCase()}` : preset.label)}
                      className={cn(
                        "px-3 py-1.5 rounded-full border text-xs font-medium transition-all hover:border-primary hover:text-primary",
                        user?.settings?.isDarkMode ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-gray-100 border-gray-200 text-gray-600"
                      )}
                    >
                      + {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <button
              onClick={processImage}
              disabled={isProcessing || !personImage.preview || !clothingDescription}
              className={cn(
                "w-full py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20",
                isProcessing || !personImage.preview || !clothingDescription 
                  ? "bg-gray-300 cursor-not-allowed" 
                  : "bg-primary hover:bg-primary/90 active:scale-[0.98]"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  {t('generating')}
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  {t('tryItOn')}
                </>
              )}
            </button>

            {success && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm flex items-center gap-2"
              >
                <CheckCircle2 size={18} />
                {success}
              </motion.div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm"
              >
                {error}
              </motion.div>
            )}
          </div>

          {/* Right Column: Result */}
          <div className="lg:sticky lg:top-28">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
              <ImageIcon size={16} />
              {t('result')}
            </h2>
            <div className={cn(
              "relative aspect-[4/3] rounded-2xl border shadow-sm overflow-hidden flex items-center justify-center transition-colors",
              user?.settings?.isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-100 border-gray-200"
            )}>
              <AnimatePresence mode="wait">
                {resultImages.length > 0 ? (
                  <motion.div
                    key={`result-${currentResultIndex}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="w-full h-full group"
                  >
                    <img src={resultImages[currentResultIndex]} alt={`Result variant ${currentResultIndex + 1}`} className="w-full h-full object-cover" />
                    
                    {/* Navigation Buttons */}
                    {resultImages.length > 1 && (
                      <div className="absolute inset-y-0 inset-x-4 flex items-center justify-between pointer-events-none">
                        <button
                          onClick={prevResult}
                          className="p-2 bg-white/80 backdrop-blur rounded-full shadow-lg pointer-events-auto hover:bg-white transition-all text-primary"
                        >
                          <ArrowLeft size={20} />
                        </button>
                        <button
                          onClick={nextResult}
                          className="p-2 bg-white/80 backdrop-blur rounded-full shadow-lg pointer-events-auto hover:bg-white transition-all text-primary"
                        >
                          <ArrowRight size={20} />
                        </button>
                      </div>
                    )}

                    {/* Variant Counter */}
                    <div className="absolute top-4 left-4 px-3 py-1 bg-black/40 backdrop-blur rounded-full text-white text-[10px] font-bold">
                      {currentResultIndex + 1} / {resultImages.length}
                    </div>

                    <div className="absolute top-6 right-6 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className={cn(
                        "backdrop-blur p-4 rounded-2xl shadow-xl border space-y-3 w-64 transition-colors",
                        user?.settings?.isDarkMode ? "bg-gray-900/90 border-gray-800" : "bg-gray-100/90 border-gray-200"
                      )}>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('lookName')}</label>
                          <input 
                            type="text"
                            value={lookName}
                            onChange={(e) => setLookName(e.target.value)}
                            placeholder="My Awesome Outfit"
                            className={cn(
                              "w-full p-2 rounded-lg text-xs border outline-none focus:border-primary transition-all",
                              user?.settings?.isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={saveLook}
                            disabled={isSavingLook}
                            className="flex-1 py-2 bg-primary text-white text-[10px] font-bold rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-1 shadow-sm"
                          >
                            {isSavingLook ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            {t('saveLook')}
                          </button>
                          <button
                            onClick={shareToCommunity}
                            disabled={isSharing}
                            className="flex-1 py-2 bg-emerald-500 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-600 transition-all flex items-center justify-center gap-1 shadow-sm"
                          >
                            {isSharing ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
                            {t('shareToCommunity')}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={downloadResult}
                        className="p-3 bg-white/90 backdrop-blur shadow-xl rounded-full hover:bg-white transition-colors text-primary"
                        title={t('download')}
                      >
                        <Download size={20} />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center p-8 text-gray-300"
                  >
                    {isProcessing ? (
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                        <p className="text-gray-400 font-medium animate-pulse">{t('processingHint')}</p>
                      </div>
                    ) : (
                      <>
                        <ImageIcon size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-medium">{t('placeholderResult')}</p>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="mt-6 p-6 rounded-2xl bg-primary/5 border border-primary/10">
              <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-2">{t('proTip')}</h3>
              <p className="text-sm text-primary/80 leading-relaxed">
                {t('proTipText')}
              </p>
            </div>
          </div>
        </div>
      </main>
    )}

      {/* Community View */}
      {view === 'community' && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">{t('community')}</h1>
              <p className="text-gray-500">{t('sharedToCommunity')}</p>
            </div>
          </div>

          {sharedLooks.length === 0 ? (
            <div className={cn(
              "rounded-3xl border border-dashed p-20 flex flex-col items-center text-center transition-colors",
              user?.settings?.isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-100 border-gray-200"
            )}>
              <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mb-6", user?.settings?.isDarkMode ? "bg-gray-700 text-gray-500" : "bg-gray-50 text-gray-300")}>
                <Users size={40} />
              </div>
              <h3 className={cn("text-xl font-bold mb-2 transition-colors", user?.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                {t('noSharedLooks')}
              </h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sharedLooks.map((look) => (
                <motion.div
                  layout
                  key={look.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "rounded-2xl border overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group transition-colors",
                    user?.settings?.isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-100 border-gray-200 shadow-white/5"
                  )}
                >
                  <div className="aspect-[3/4] relative overflow-hidden cursor-zoom-in" onClick={() => setSelectedImageForView(look.imageUrl)}>
                    <img src={look.imageUrl} alt={look.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(look);
                        }}
                        className={cn(
                          "p-4 rounded-full backdrop-blur-md transition-all scale-90 hover:scale-100",
                          userLikes[look.id] ? "bg-rose-500 text-white" : "bg-white/20 text-white hover:bg-white/40"
                        )}
                      >
                        <Heart size={32} fill={userLikes[look.id] ? "currentColor" : "none"} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImageForView(look.imageUrl);
                        }}
                        className="px-4 py-2 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white font-bold rounded-full text-xs flex items-center gap-2 transition-all transform translate-y-2 group-hover:translate-y-0"
                      >
                        <Maximize2 size={14} />
                        {t('viewFull' as any) || 'Full View'}
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {look.authorPhoto ? (
                          <img src={look.authorPhoto} alt="" className="w-6 h-6 rounded-full border border-gray-100" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                            {look.authorName?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className={cn("text-xs font-bold truncate max-w-[80px]", user?.settings?.isDarkMode ? "text-gray-300" : "text-gray-600")}>
                          {look.authorName}
                        </span>
                        
                        {user?.uid !== look.uid && (
                          <button
                            onClick={() => {
                              const f = getFriendshipWith(look.uid);
                              if (!f) sendFriendRequest(look);
                              else if (f.status === 'pending' && f.receiverId === user?.uid) acceptFriendRequest(f.id);
                              else removeFriendship(f.id);
                            }}
                            className={cn(
                              "p-1 rounded-full transition-all",
                              !getFriendshipWith(look.uid) ? "text-primary hover:bg-primary/10" :
                              getFriendshipWith(look.uid)?.status === 'accepted' ? "text-emerald-500 hover:bg-emerald-50" :
                              getFriendshipWith(look.uid)?.initiatorId === user?.uid ? "text-amber-500 hover:bg-amber-50" :
                              "text-primary bg-primary/10 animate-pulse"
                            )}
                          >
                            {!getFriendshipWith(look.uid) ? <UserPlus size={14} /> :
                             getFriendshipWith(look.uid)?.status === 'accepted' ? <UserCheck size={14} /> :
                             getFriendshipWith(look.uid)?.initiatorId === user?.uid ? <Loader2 size={14} className="animate-spin" /> :
                             <UserPlus size={14} />}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-primary">
                          <Heart size={14} fill={userLikes[look.id] ? "currentColor" : "none"} />
                          <span className="text-xs font-bold">{look.likesCount || 0}</span>
                        </div>
                        <button 
                          onClick={() => setSelectedLookForComments(selectedLookForComments === look.id ? null : look.id)}
                          className="flex items-center gap-1 text-gray-400 hover:text-primary transition-colors"
                        >
                          <MessageCircle size={14} />
                          <span className="text-xs font-bold">{look.commentsCount || 0}</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between group/title">
                      <h3 className={cn("text-sm font-bold line-clamp-1 flex-1 transition-colors", user?.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                        {look.name || 'Untitled Look'}
                      </h3>
                      {(user?.uid === look.uid || isAdmin) && (
                        <button
                          onClick={() => deleteSharedLook(look.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover/title:opacity-100"
                          title={t('deletePhoto')}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    
                    <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-bold">
                      {new Date(look.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
                    </p>

                    {/* Comments Section */}
                    <AnimatePresence>
                      {selectedLookForComments === look.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-4 pt-4 border-t border-gray-50 overflow-hidden"
                        >
                          <div className="max-h-48 overflow-y-auto space-y-3 mb-4 pr-1 scrollbar-thin">
                            {lookComments[look.id]?.length > 0 ? (
                              lookComments[look.id].map((comment) => (
                                <div key={comment.id} className="text-xs">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className={cn("font-bold", user?.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                                      {comment.authorName}
                                    </span>
                                    <span className="text-[9px] text-gray-400">
                                      {new Date(comment.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className={cn("leading-relaxed", user?.settings?.isDarkMode ? "text-gray-400" : "text-gray-600")}>
                                    {comment.text}
                                  </p>
                                  {(user?.uid === comment.uid || isAdmin) && (
                                    <button
                                      onClick={() => {
                                        if (window.confirm(t('confirmDeleteComment' as any))) {
                                          deleteComment(comment.id, look.id);
                                        }
                                      }}
                                      className="mt-1 text-[10px] text-red-500 hover:underline flex items-center gap-1"
                                    >
                                      <Trash2 size={10} />
                                      {t('delete' as any) || 'Delete'}
                                    </button>
                                  )}
                                </div>
                              ))
                            ) : (
                              <p className="text-[10px] text-gray-400 text-center py-2 italic">{t('noComments')}</p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={commentInput}
                              onChange={(e) => setCommentInput(e.target.value)}
                              placeholder={t('addComment')}
                              className="flex-1 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-primary/30 transition-all font-medium"
                              onKeyPress={(e) => e.key === 'Enter' && postComment(look.id)}
                            />
                            <button
                              disabled={!commentInput.trim() || isPostingComment}
                              onClick={() => postComment(look.id)}
                              className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-all disabled:opacity-50"
                            >
                              <Send size={14} />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
        </>
      )}

      {/* Looks Sidebar */}
      <AnimatePresence>
        {isLooksOpen && (
          <div className="fixed inset-0 z-[60] flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsLooksOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              "relative w-full max-w-md h-full shadow-2xl flex flex-col transition-colors",
              user?.settings?.isDarkMode ? "bg-gray-900 border-l border-gray-800" : "bg-white"
            )}
          >
            <div className={cn(
              "p-6 border-b flex items-center justify-between transition-colors",
              user?.settings?.isDarkMode ? "border-gray-800" : "border-gray-100"
            )}>
              <div className="flex items-center gap-2">
                <RefreshCw className="text-primary" size={20} />
                <h2 className={cn("text-lg font-bold transition-colors", user?.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                  {t('looks')}
                </h2>
              </div>
              <button 
                onClick={() => setIsLooksOpen(false)}
                className={cn("p-2 rounded-full transition-colors", user?.settings?.isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100")}
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              <div className="grid grid-cols-1 gap-6">
                {looks.map((look) => (
                  <div key={look.id} className={cn(
                    "rounded-3xl overflow-hidden border group transition-colors",
                    user?.settings?.isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100"
                  )}>
                    <div className="aspect-[4/3] relative cursor-zoom-in" onClick={() => setSelectedImageForView(look.imageUrl)}>
                      <img src={look.imageUrl} alt={look.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLook(look.id);
                        }}
                        className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <h3 className={cn("font-bold transition-colors", user?.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                          {look.name}
                        </h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                          {look.createdAt ? new Date(look.createdAt.seconds * 1000).toLocaleDateString() : '...'}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setResultImages([look.imageUrl]);
                          setCurrentResultIndex(0);
                          setIsLooksOpen(false);
                        }}
                        className={cn(
                          "p-2 rounded-xl transition-all border",
                          user?.settings?.isDarkMode ? "bg-gray-900 border-gray-700 text-primary hover:border-primary" : "bg-white border-gray-200 text-primary hover:border-primary"
                        )}
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

                {looks.length === 0 && (
                  <div className="text-center py-12">
                    <RefreshCw size={48} className="mx-auto mb-4 text-gray-200" />
                    <p className="text-sm text-gray-500">{t('noLooks')}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isWardrobeOpen && (
          <div className="fixed inset-0 z-[60] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWardrobeOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={cn(
                "relative w-full max-w-md h-full shadow-2xl flex flex-col transition-colors",
                user?.settings?.isDarkMode ? "bg-gray-900 border-l border-gray-800" : "bg-white"
              )}
            >
              <div className={cn(
                "p-6 border-b flex items-center justify-between transition-colors",
                user?.settings?.isDarkMode ? "border-gray-800" : "border-gray-100"
              )}>
                <div className="flex items-center gap-2">
                  <LayoutGrid className="text-primary" size={20} />
                  <h2 className={cn("text-lg font-bold transition-colors", user?.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                    {t('wardrobe')}
                  </h2>
                </div>
                <button 
                  onClick={() => setIsWardrobeOpen(false)}
                  className={cn("p-2 rounded-full transition-colors", user?.settings?.isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100")}
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                <div className="grid grid-cols-2 gap-4">
                  {/* Add New Item Button */}
                  <button
                    onClick={() => wardrobeInputRef.current?.click()}
                    disabled={isAddingToWardrobe || user?.plan === 'trial' || wardrobe.length >= 10}
                    className={cn(
                      "aspect-[3/4] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all group disabled:opacity-50 disabled:cursor-not-allowed",
                      user?.plan === 'trial' ? "border-gray-200 opacity-30" : (user?.settings?.isDarkMode ? "border-gray-700 bg-gray-800 hover:border-primary/40 hover:bg-primary/5" : "border-gray-200 hover:border-primary/40 hover:bg-primary/5")
                    )}
                  >
                    <input 
                      type="file" 
                      ref={wardrobeInputRef}
                      onChange={(e) => handleFileChange(e, 'wardrobe')}
                      accept="image/*"
                      className="hidden"
                    />
                    {isAddingToWardrobe ? (
                      <Loader2 className="animate-spin text-primary" size={24} />
                    ) : (
                      <>
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <Plus size={20} />
                        </div>
                        <span className="text-xs font-bold text-gray-500 group-hover:text-primary">{t('addToWardrobe')}</span>
                      </>
                    )}
                  </button>

                  {wardrobe.map((item) => (
                    <div key={item.id} className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 group">
                      <img src={item.imageUrl} alt={item.description || 'Wardrobe item'} className="w-full h-full object-cover" />
                      
                      {editingItemId === item.id ? (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm p-3 flex flex-col gap-2">
                          <textarea
                            value={editingDescription}
                            onChange={(e) => setEditingDescription(e.target.value)}
                            className="flex-1 bg-white/10 border border-white/20 rounded-lg p-2 text-[10px] text-white outline-none focus:border-primary/40"
                            placeholder="Describe item..."
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateWardrobeItem(item.id, editingDescription)}
                              className="flex-1 py-1 bg-primary text-white text-[10px] font-bold rounded-md hover:bg-primary/90"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingItemId(null)}
                              className="flex-1 py-1 bg-white/10 text-white text-[10px] font-bold rounded-md hover:bg-white/20"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 backdrop-blur-sm">
                            <p className="text-[10px] text-white font-medium truncate">{item.description || 'No description'}</p>
                          </div>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                if (selectedWardrobeItems.find(i => i.id === item.id)) {
                                  setSelectedWardrobeItems(prev => prev.filter(i => i.id !== item.id));
                                } else {
                                  setSelectedWardrobeItems(prev => [...prev, item]);
                                }
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-bold transition-colors",
                                selectedWardrobeItems.find(i => i.id === item.id)
                                  ? "bg-primary text-white hover:bg-primary/90"
                                  : "bg-white text-primary hover:bg-primary/5"
                              )}
                            >
                              {selectedWardrobeItems.find(i => i.id === item.id) ? t('selected') || 'Selected' : t('selectFromWardrobe')}
                            </button>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingItemId(item.id);
                                  setEditingDescription(item.description || '');
                                }}
                                className="p-2 bg-white text-primary rounded-full hover:bg-primary/5 transition-colors"
                                title="Edit description"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    const ai = getAI();
                                    const imgData = item.imageUrl.split(',')[1];
                                    const mime = item.imageUrl.split(';')[0].split(':')[1];
                                    const descResponse = await ai.models.generateContent({
                                      model: 'gemini-3-flash-preview',
                                      contents: {
                                        parts: [
                                          { inlineData: { data: imgData, mimeType: mime } },
                                          { text: "Describe this clothing item in 3-5 words. Provide only the description text." }
                                        ]
                                      }
                                    });
                                    const desc = descResponse.text?.trim() || '';
                                    if (desc) updateWardrobeItem(item.id, desc);
                                  } catch (e) {
                                    console.error(e);
                                  }
                                }}
                                className="p-2 bg-white text-primary rounded-full hover:bg-primary/5 transition-colors"
                                title="Auto-describe with AI"
                              >
                                <Sparkles size={14} />
                              </button>
                              <button
                                onClick={() => deleteFromWardrobe(item.id)}
                                className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {wardrobe.length === 0 && !isAddingToWardrobe && (
                  <div className="text-center py-12">
                    <Shirt size={48} className="mx-auto mb-4 text-gray-200" />
                    <p className="text-sm text-gray-500">{t('noWardrobeItems')}</p>
                  </div>
                )}
                
                {wardrobe.length >= 10 && (
                  <p className="text-xs text-center text-amber-600 mt-4 font-medium">
                    {t('wardrobeLimit')}
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Sidebar */}
      <AnimatePresence>
        {isHistoryOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "relative w-full max-w-md h-full shadow-2xl flex flex-col transition-colors",
                user?.settings?.isDarkMode ? "bg-gray-900 border-l border-gray-800" : "bg-white"
              )}
            >
              <div className={cn(
                "p-6 border-b flex items-center justify-between transition-colors",
                user?.settings?.isDarkMode ? "border-gray-800" : "border-gray-100"
              )}>
                <div className="flex items-center gap-2">
                  <History className="text-primary" size={20} />
                  <h2 className={cn("text-lg font-bold transition-colors", user?.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                    {t('history')}
                  </h2>
                </div>
                <button 
                  onClick={() => setIsHistoryOpen(false)}
                  className={cn("p-2 rounded-full transition-colors", user?.settings?.isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100")}
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 gap-6">
                  {history.map((item) => (
                    <div key={item.id} className={cn(
                      "rounded-3xl overflow-hidden border group transition-colors",
                      user?.settings?.isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100"
                    )}>
                      <div className="aspect-[4/3] relative">
                        <img src={item.imageUrl} alt={item.description} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-4">
                        <p className={cn("text-sm font-medium line-clamp-2 mb-2 transition-colors", user?.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                          {item.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-400">
                            {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : '...'}
                          </p>
                          <button
                            onClick={() => {
                              setClothingDescription(item.description);
                              setResultImages([item.imageUrl]);
                              setCurrentResultIndex(0);
                              setIsHistoryOpen(false);
                            }}
                            className="text-xs font-bold text-primary hover:text-primary/90"
                          >
                            {t('tryItOn')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {history.length === 0 && (
                  <div className="text-center py-12">
                    <History size={48} className="mx-auto mb-4 text-gray-200" />
                    <p className="text-sm text-gray-500">{t('noHistory')}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Trend Chat Sidebar */}
      <AnimatePresence>
        {isTrendChatOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTrendChatOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "relative w-full max-w-md h-full shadow-2xl flex flex-col transition-colors",
                user?.settings?.isDarkMode ? "bg-gray-900 border-l border-gray-800" : "bg-white"
              )}
            >
              <div className={cn(
                "p-6 border-b flex items-center justify-between transition-colors",
                user?.settings?.isDarkMode ? "border-gray-800" : "border-gray-100"
              )}>
                <div className="flex items-center gap-2">
                  <MessageCircle className="text-primary" size={20} />
                  <h2 className={cn("text-lg font-bold transition-colors", user?.settings?.isDarkMode ? "text-white" : "text-gray-900")}>
                    {t('trendChat')}
                  </h2>
                </div>
                <button 
                  onClick={() => setIsTrendChatOpen(false)}
                  className={cn("p-2 rounded-full transition-colors", user?.settings?.isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100")}
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div 
                    key={msg.id || idx}
                    className={cn(
                      "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed",
                      msg.role === 'user' 
                        ? "bg-primary text-white ml-auto rounded-tr-none shadow-sm shadow-primary/20" 
                        : user?.settings?.isDarkMode 
                          ? "bg-gray-800 text-gray-100 mr-auto rounded-tl-none border border-gray-700"
                          : "bg-gray-100 text-gray-800 mr-auto rounded-tl-none"
                    )}
                  >
                    <ChatMessage content={msg.content} role={msg.role} />
                  </div>
                ))}
                {isChatLoading && (
                  <div className={cn(
                    "mr-auto rounded-2xl rounded-tl-none p-4 max-w-[85%] flex items-center gap-2 transition-colors",
                    user?.settings?.isDarkMode ? "bg-gray-800 text-gray-400 border border-gray-700" : "bg-gray-100 text-gray-800"
                  )}>
                    <Loader2 size={16} className="animate-spin text-primary" />
                    <span className="text-xs font-bold">{t('thinking' as any) || 'Thinking...'}</span>
                  </div>
                )}
              </div>

              <form 
                onSubmit={handleSendMessage} 
                className={cn(
                  "p-6 border-t flex gap-2 transition-colors",
                  user?.settings?.isDarkMode ? "border-gray-800 bg-gray-900" : "border-gray-100 bg-white"
                )}
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={t('trendChatPlaceholder')}
                  className={cn(
                    "flex-1 border rounded-xl px-4 py-2 text-sm outline-none focus:border-primary transition-all",
                    user?.settings?.isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                  )}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading}
                  className="p-2 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <Send size={20} />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Chat Button */}
      <button
        onClick={() => {
          if (!user) {
            setIsAuthModalOpen(true);
          } else {
            setIsTrendChatOpen(true);
          }
        }}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-40 group"
      >
        <MessageCircle size={24} />
        <span className="absolute right-full mr-4 px-3 py-1.5 bg-white text-primary text-xs font-bold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {t('trendChat')}
        </span>
      </button>

      <InterfaceSettingsPanel />
      
      <AnimatePresence>
        {activeChatFriend && (
          <FriendChat 
            friendId={activeChatFriend.id}
            friendName={activeChatFriend.name}
            friendPhoto={activeChatFriend.photo}
            onClose={() => setActiveChatFriend(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedImageForView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
            onClick={() => setSelectedImageForView(null)}
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-50 backdrop-blur-md border border-white/10"
              onClick={() => setSelectedImageForView(null)}
            >
              <X size={24} />
            </motion.button>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative w-full max-w-5xl h-full flex items-center justify-center"
            >
              <img 
                src={selectedImageForView} 
                alt="Full preview" 
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const link = document.createElement('a');
                  link.href = selectedImageForView;
                  link.download = `look-${Date.now()}.jpg`;
                  link.click();
                }}
                className="absolute bottom-8 right-0 p-4 bg-primary text-white rounded-2xl shadow-2xl hover:bg-primary/90 transition-all flex items-center gap-2 font-bold"
              >
                <Download size={20} />
                {t('download')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PricingModal 
        isOpen={isPricingModalOpen} 
        onClose={() => setIsPricingModalOpen(false)} 
      />

      <Tutorial 
        isOpen={isTutorialOpen} 
        onClose={() => setIsTutorialOpen(false)} 
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </LanguageProvider>
  );
}
