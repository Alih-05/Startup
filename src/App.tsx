/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Upload, Shirt, User, Loader2, Download, RefreshCw, Sparkles, Image as ImageIcon, LogIn, Globe, Trash2, Plus, LayoutGrid, X, CheckCircle2, Edit2, ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import AuthModal from './components/AuthModal';
import ProfilePage from './components/ProfilePage';
import { TeacherPage } from './components/TeacherPage';

// Initialize Gemini API
const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface ImageState {
  file: File | null;
  preview: string | null;
}

function MainApp() {
  const { user, token, loading } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [personImage, setPersonImage] = useState<ImageState>({ file: null, preview: null });
  const [clothingDescription, setClothingDescription] = useState('');
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [view, setView] = useState<'editor' | 'profile' | 'teacher'>('editor');
  const [wardrobe, setWardrobe] = useState<any[]>([]);
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [isAddingToWardrobe, setIsAddingToWardrobe] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingDescription, setEditingDescription] = useState('');
  const [selectedWardrobeItems, setSelectedWardrobeItems] = useState<any[]>([]);
  const [looks, setLooks] = useState<any[]>([]);
  const [isLooksOpen, setIsLooksOpen] = useState(false);
  const [weather, setWeather] = useState('sunny');
  const [eventType, setEventType] = useState('casual');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [lookName, setLookName] = useState('');
  const [isSavingLook, setIsSavingLook] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const personInputRef = useRef<HTMLInputElement>(null);
  const wardrobeInputRef = useRef<HTMLInputElement>(null);

  const fetchWardrobe = useCallback(async () => {
    if (!user) return;
    try {
      const headers: any = { credentials: 'include' };
      if (token) {
        headers.headers = { 'Authorization': `Bearer ${token}` };
      }
      const res = await fetch('/api/wardrobe', headers);
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setWardrobe(data.items);
      } else if (!res.ok) {
        const text = await res.text();
        console.error('Wardrobe fetch failed:', text);
      }
    } catch (err) {
      console.error('Failed to fetch wardrobe:', err);
    }
  }, [user, token]);

  const fetchLooks = useCallback(async () => {
    if (!user) return;
    try {
      const headers: any = { credentials: 'include' };
      if (token) {
        headers.headers = { 'Authorization': `Bearer ${token}` };
      }
      const res = await fetch('/api/looks', headers);
      if (res.ok) {
        const data = await res.json();
        setLooks(data.looks);
      }
    } catch (err) {
      console.error('Failed to fetch looks:', err);
    }
  }, [user, token]);

  React.useEffect(() => {
    if (user) {
      fetchWardrobe();
      fetchLooks();
    } else {
      setWardrobe([]);
      setLooks([]);
    }
  }, [user, fetchWardrobe, fetchLooks]);

  const addToWardrobe = async (file: File) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    setIsAddingToWardrobe(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        
        // Use Gemini to describe the clothing item automatically
        let autoDescription = '';
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

        const headers: any = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_data: base64Data,
            description: autoDescription,
            category: 'other'
          }),
          credentials: 'include'
        };

        if (token) {
          headers.headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch('/api/wardrobe', headers);

        if (res.ok) {
          fetchWardrobe();
        } else {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            setError(data.error || t('errorGeneric'));
          } else {
            const text = await res.text();
            setError(`Upload failed: ${text.substring(0, 50)}`);
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(t('errorGeneric'));
    } finally {
      setIsAddingToWardrobe(false);
    }
  };

  const deleteFromWardrobe = async (id: number) => {
    try {
      const headers: any = { 
        method: 'DELETE',
        credentials: 'include'
      };
      if (token) {
        headers.headers = { 'Authorization': `Bearer ${token}` };
      }
      const res = await fetch(`/api/wardrobe/${id}`, headers);
      if (res.ok) {
        fetchWardrobe();
        setSelectedWardrobeItems(prev => prev.filter(item => item.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const updateWardrobeItem = async (id: number, description: string) => {
    try {
      const headers: any = { 
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
        credentials: 'include'
      };
      if (token) {
        headers.headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/wardrobe/${id}`, headers);
      if (res.ok) {
        fetchWardrobe();
        setEditingItemId(null);
      }
    } catch (err) {
      console.error('Failed to update item:', err);
    }
  };

  const saveLook = async () => {
    if (resultImages.length === 0 || !user) return;
    setIsSavingLook(true);
    try {
      const headers: any = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lookName || `Look ${new Date().toLocaleDateString()} (v${currentResultIndex + 1})`,
          image_data: resultImages[currentResultIndex],
          wardrobe_ids: selectedWardrobeItems.map(item => item.id)
        }),
        credentials: 'include'
      };
      if (token) {
        headers.headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/looks', headers);
      if (res.ok) {
        fetchLooks();
        setLookName('');
        setSuccess(t('lookSaved'));
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Failed to save look:', err);
    } finally {
      setIsSavingLook(false);
    }
  };

  const deleteLook = async (id: number) => {
    try {
      const headers: any = { 
        method: 'DELETE',
        credentials: 'include'
      };
      if (token) {
        headers.headers = { 'Authorization': `Bearer ${token}` };
      }
      const res = await fetch(`/api/looks/${id}`, headers);
      if (res.ok) {
        fetchLooks();
      }
    } catch (err) {
      console.error('Failed to delete look:', err);
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

    try {
      const ai = getAI();
      const base64Data = personImage.preview.split(',')[1];
      const mimeType = personImage.preview.split(';')[0].split(':')[1];

      const wardrobeContext = selectedWardrobeItems.map(item => item.description).join(', ');
      const finalDescription = clothingDescription + (wardrobeContext ? ` using these items: ${wardrobeContext}` : '');

      // Generate 3 variants in parallel
      const generationPromises = [1, 2, 3].map(async (i) => {
        try {
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
                  Variant ${i}: Slightly different style/fit.
                  Keep the person's face, pose, and background as consistent as possible. 
                  The output should be a high-quality photo of the person wearing the specified clothing.`,
                },
              ],
            },
          });

          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
          }
        } catch (e) {
          console.error(`Variant ${i} failed:`, e);
          return null;
        }
        return null;
      });

      const results = await Promise.all(generationPromises);
      const validResults = results.filter((img): img is string => img !== null);

      if (validResults.length === 0) {
        throw new Error(t('errorNoImage'));
      }

      setResultImages(validResults);
    } catch (err: any) {
      console.error('Error processing image:', err);
      let msg = err.message || t('errorGeneric');
      
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
        msg = t('errorQuotaExceeded');
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

  if (view === 'profile') {
    return <ProfilePage onBack={() => setView('editor')} />;
  }

  if (view === 'teacher') {
    return <TeacherPage onBack={() => setView('editor')} />;
  }

  const nextResult = () => {
    setCurrentResultIndex(prev => (prev + 1) % resultImages.length);
  };

  const prevResult = () => {
    setCurrentResultIndex(prev => (prev - 1 + resultImages.length) % resultImages.length);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1a1a1a] font-sans selection:bg-indigo-100">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      
      {/* Header */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Sparkles size={18} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">{t('appName')}</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Language Switcher */}
            <div className="flex items-center bg-gray-100 rounded-full p-1">
              <button
                onClick={() => setLanguage('en')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full transition-all",
                  language === 'en' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('ru')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full transition-all",
                  language === 'ru' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                RU
              </button>
            </div>

            <button 
              onClick={() => setView('teacher')}
              className="text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-2"
            >
              <User size={16} />
              {t('teacher')}
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
                  className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                  title={t('looks')}
                >
                  <RefreshCw size={20} />
                </button>
                <button
                  onClick={() => setIsWardrobeOpen(true)}
                  className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                  title={t('wardrobe')}
                >
                  <LayoutGrid size={20} />
                </button>
                <button 
                  onClick={() => setView('profile')}
                  className="flex items-center gap-2 pl-2 pr-4 py-1.5 bg-white border border-gray-200 rounded-full hover:border-indigo-500 transition-all group"
                >
                  <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 overflow-hidden">
                    {user.avatar_data ? (
                      <img src={user.avatar_data} alt={user.username} className="w-full h-full object-cover" />
                    ) : (
                      <User size={14} />
                    )}
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{user.username}</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-full hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
              >
                <LogIn size={16} />
                {t('signIn')}
              </button>
            )}
          </div>
        </div>
      </header>

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
                  "relative aspect-[4/3] rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center gap-4",
                  personImage.preview ? "border-transparent bg-white shadow-sm" : "border-gray-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/30"
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
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('weather')}</label>
                    <select 
                      value={weather}
                      onChange={(e) => setWeather(e.target.value)}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500"
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
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500"
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
                  className="w-full py-2.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
                  <div className="flex flex-wrap gap-2 p-2 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    {selectedWardrobeItems.map(item => (
                      <div key={item.id} className="relative w-12 h-16 rounded-lg overflow-hidden border border-indigo-200 group">
                        <img src={item.image_data} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setSelectedWardrobeItems(prev => prev.filter(i => i.id !== item.id))}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setIsWardrobeOpen(true)}
                      className="w-12 h-16 rounded-lg border-2 border-dashed border-indigo-200 flex items-center justify-center text-indigo-400 hover:border-indigo-400 hover:text-indigo-600 transition-all"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                )}
                <textarea
                  value={clothingDescription}
                  onChange={(e) => setClothingDescription(e.target.value)}
                  placeholder={t('placeholderDescription')}
                  className="w-full h-32 p-4 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
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
                      className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-xs font-medium hover:border-indigo-500 hover:text-indigo-600 transition-all"
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
                "w-full py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20",
                isProcessing || !personImage.preview || !clothingDescription 
                  ? "bg-gray-300 cursor-not-allowed" 
                  : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]"
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
            <div className="relative aspect-[4/3] rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden flex items-center justify-center">
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
                          className="p-2 bg-white/80 backdrop-blur rounded-full shadow-lg pointer-events-auto hover:bg-white transition-all text-indigo-600"
                        >
                          <ArrowLeft size={20} />
                        </button>
                        <button
                          onClick={nextResult}
                          className="p-2 bg-white/80 backdrop-blur rounded-full shadow-lg pointer-events-auto hover:bg-white transition-all text-indigo-600"
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
                      <div className="bg-white/90 backdrop-blur p-4 rounded-2xl shadow-xl border border-gray-100 space-y-3 w-64">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('lookName')}</label>
                          <input 
                            type="text"
                            value={lookName}
                            onChange={(e) => setLookName(e.target.value)}
                            placeholder="My Awesome Outfit"
                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-indigo-500"
                          />
                        </div>
                        <button
                          onClick={saveLook}
                          disabled={isSavingLook}
                          className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                        >
                          {isSavingLook ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                          {t('saveLook')}
                        </button>
                      </div>
                    </div>
                    <div className="absolute bottom-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={downloadResult}
                        className="p-3 bg-white/90 backdrop-blur shadow-xl rounded-full hover:bg-white transition-colors text-indigo-600"
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
                        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
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
            
            <div className="mt-6 p-6 rounded-2xl bg-indigo-50/50 border border-indigo-100/50">
              <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-widest mb-2">{t('proTip')}</h3>
              <p className="text-sm text-indigo-700 leading-relaxed">
                {t('proTipText')}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Looks Sidebar */}
      <AnimatePresence>
        {isLooksOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLooksOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="text-indigo-600" size={20} />
                  <h2 className="text-lg font-bold">{t('looks')}</h2>
                </div>
                <button 
                  onClick={() => setIsLooksOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 gap-6">
                  {looks.map((look) => (
                    <div key={look.id} className="bg-gray-50 rounded-3xl overflow-hidden border border-gray-100 group">
                      <div className="aspect-[4/3] relative">
                        <img src={look.image_data} alt={look.name} className="w-full h-full object-cover" />
                        <button
                          onClick={() => deleteLook(look.id)}
                          className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="p-4 flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-gray-900">{look.name}</h3>
                          <p className="text-xs text-gray-400">{new Date(look.created_at).toLocaleDateString()}</p>
                        </div>
                        <button
                          onClick={() => {
                            setResultImages([look.image_data]);
                            setCurrentResultIndex(0);
                            setIsLooksOpen(false);
                          }}
                          className="p-2 bg-white border border-gray-200 rounded-xl text-indigo-600 hover:border-indigo-500 transition-all"
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
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWardrobeOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="text-indigo-600" size={20} />
                  <h2 className="text-lg font-bold">{t('wardrobe')}</h2>
                </div>
                <button 
                  onClick={() => setIsWardrobeOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-4">
                  {/* Add New Item Button */}
                  <button
                    onClick={() => wardrobeInputRef.current?.click()}
                    disabled={isAddingToWardrobe || wardrobe.length >= 10}
                    className="aspect-[3/4] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <input 
                      type="file" 
                      ref={wardrobeInputRef}
                      onChange={(e) => handleFileChange(e, 'wardrobe')}
                      accept="image/*"
                      className="hidden"
                    />
                    {isAddingToWardrobe ? (
                      <Loader2 className="animate-spin text-indigo-600" size={24} />
                    ) : (
                      <>
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                          <Plus size={20} />
                        </div>
                        <span className="text-xs font-bold text-gray-500 group-hover:text-indigo-600">{t('addToWardrobe')}</span>
                      </>
                    )}
                  </button>

                  {wardrobe.map((item) => (
                    <div key={item.id} className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 group">
                      <img src={item.image_data} alt={item.description || 'Wardrobe item'} className="w-full h-full object-cover" />
                      
                      {editingItemId === item.id ? (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm p-3 flex flex-col gap-2">
                          <textarea
                            value={editingDescription}
                            onChange={(e) => setEditingDescription(e.target.value)}
                            className="flex-1 bg-white/10 border border-white/20 rounded-lg p-2 text-[10px] text-white outline-none focus:border-indigo-400"
                            placeholder="Describe item..."
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateWardrobeItem(item.id, editingDescription)}
                              className="flex-1 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-md hover:bg-indigo-700"
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
                                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                  : "bg-white text-indigo-600 hover:bg-indigo-50"
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
                                className="p-2 bg-white text-indigo-600 rounded-full hover:bg-indigo-50 transition-colors"
                                title="Edit description"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    const ai = getAI();
                                    const imgData = item.image_data.split(',')[1];
                                    const mime = item.image_data.split(';')[0].split(':')[1];
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
                                className="p-2 bg-white text-indigo-600 rounded-full hover:bg-indigo-50 transition-colors"
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
