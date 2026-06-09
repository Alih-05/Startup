import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Palette, Type, Check, X, Moon, Sun, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';

const COLORS = [
  { name: 'themeGray', value: '#64748b', bg: '#f1f5f9', darkBg: '#0f172a' },
  { name: 'themeIndigo', value: '#4f46e5', bg: '#f8fafc', darkBg: '#0f172a' }, 
  { name: 'themeRose', value: '#e11d48', bg: '#f8fafc', darkBg: '#0f172a' },   
  { name: 'themeEmerald', value: '#059669', bg: '#f8fafc', darkBg: '#0f172a' }, 
  { name: 'themeAmber', value: '#d97706', bg: '#f8fafc', darkBg: '#0f172a' }    
];

const FONTS = [
  { name: 'fontInter', value: 'Inter' },
  { name: 'fontOutfit', value: 'Outfit' },
  { name: 'fontSpaceGrotesk', value: 'Space Grotesk' }
];

export default function InterfaceSettingsPanel() {
  const { user, updateSettings } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const currentSettings = user?.settings || {
    themeColor: '#4f46e5',
    fontFamily: 'Inter',
    isDarkMode: false
  };

  const handleColorChange = (color: string) => {
    if (!user) return;
    const theme = COLORS.find(c => c.value === color);
    updateSettings({ ...currentSettings, themeColor: color });
    
    document.documentElement.style.setProperty('--theme-color', color);
    if (theme) {
      const bgColor = currentSettings.isDarkMode ? theme.darkBg : theme.bg;
      document.documentElement.style.setProperty('--bg-color', bgColor);
      document.body.style.backgroundColor = bgColor;
    }
  };

  const toggleDarkMode = () => {
    if (!user) return;
    const newDarkMode = !currentSettings.isDarkMode;
    updateSettings({ ...currentSettings, isDarkMode: newDarkMode });
    
    const theme = COLORS.find(c => c.value === currentSettings.themeColor);
    if (theme) {
      const bgColor = newDarkMode ? theme.darkBg : theme.bg;
      document.documentElement.style.setProperty('--bg-color', bgColor);
      document.body.style.backgroundColor = bgColor;
    }
  };

  const handleFontChange = (font: string) => {
    if (!user) return;
    updateSettings({ ...currentSettings, fontFamily: font });
    const fontValue = font.includes(' ') ? `"${font}"` : font;
    document.documentElement.style.setProperty('--font-family', fontValue);
    document.body.style.fontFamily = `${fontValue}, sans-serif`;
    document.querySelectorAll('*').forEach((el) => {
      (el as HTMLElement).style.fontFamily = 'inherit';
    });
  };

  React.useEffect(() => {
    const theme = COLORS.find(c => c.value === currentSettings.themeColor);
    const font = currentSettings.fontFamily;
    const fontValue = font.includes(' ') ? `"${font}"` : font;
    
    document.documentElement.style.setProperty('--theme-color', currentSettings.themeColor);
    document.documentElement.style.setProperty('--font-family', fontValue);
    
    if (theme) {
      const bgColor = currentSettings.isDarkMode ? theme.darkBg : theme.bg;
      document.documentElement.style.setProperty('--bg-color', bgColor);
      document.body.style.backgroundColor = bgColor;
    }
    document.body.style.fontFamily = `${fontValue}, sans-serif`;
  }, [currentSettings.themeColor, currentSettings.fontFamily, currentSettings.isDarkMode]);

  if (!user) return null;

  return (
    <div className="fixed bottom-24 right-8 z-40">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={cn(
              "absolute bottom-full right-0 mb-4 w-64 rounded-2xl shadow-2xl border overflow-hidden transition-colors",
              currentSettings.isDarkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-gray-100 border-gray-200 text-gray-900"
            )}
          >
            <div className={cn("p-4 border-b flex items-center justify-between", currentSettings.isDarkMode ? "border-gray-800" : "border-gray-200")}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Settings size={16} className="text-primary" />
                {t('interfaceSettings')}
              </h3>
              <button 
                onClick={() => setIsOpen(false)}
                className={cn("p-1 rounded-full transition-colors", currentSettings.isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100")}
              >
                <X size={14} className="text-gray-400" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Dark Mode Toggle */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {currentSettings.isDarkMode ? <Moon size={12} /> : <Sun size={12} />}
                  {t('theme')}
                </div>
                <button
                  onClick={toggleDarkMode}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-xl border transition-all",
                    currentSettings.isDarkMode 
                      ? "bg-gray-800 border-gray-700 text-white" 
                      : "bg-gray-50 border-gray-200 text-gray-600"
                  )}
                >
                  <span className="text-xs font-bold">{currentSettings.isDarkMode ? t('darkMode') : t('lightMode')}</span>
                  <div className={cn(
                    "w-10 h-5 rounded-full relative transition-colors",
                    currentSettings.isDarkMode ? "bg-primary" : "bg-gray-300"
                  )}>
                    <div className={cn(
                      "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                      currentSettings.isDarkMode ? "right-1" : "left-1"
                    )} />
                  </div>
                </button>
              </div>

              {/* Color Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <Palette size={12} />
                  {t('themeColor')}
                </div>
                <div className="flex gap-3">
                  {COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => handleColorChange(color.value)}
                      title={t(color.name as any)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all hover:scale-110 flex items-center justify-center",
                        currentSettings.themeColor === color.value ? "ring-2 ring-offset-2 ring-gray-200" : ""
                      )}
                      style={{ backgroundColor: color.value }}
                    >
                      {currentSettings.themeColor === color.value && (
                        <Check size={14} className="text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Settings */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <Sparkles size={12} className="text-primary" />
                  {t('aiSettings' as any)}
                </div>
                <button
                  onClick={() => {
                    if (!user) return;
                    updateSettings({ 
                      ...currentSettings, 
                      autoDescribe: !currentSettings.autoDescribe 
                    });
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-xl border transition-all",
                    currentSettings.isDarkMode 
                      ? "bg-gray-800 border-gray-700 text-white" 
                      : "bg-gray-50 border-gray-200 text-gray-600"
                  )}
                >
                  <div className="flex flex-col items-start gap-0.5 text-left">
                    <span className="text-xs font-bold">{t('autoDescribeWardrobe' as any)}</span>
                    <span className="text-[10px] text-gray-400 leading-tight">{t('autoDescribeWardrobeDesc' as any)}</span>
                  </div>
                  <div className={cn(
                    "w-10 h-5 rounded-full relative transition-colors shrink-0",
                    currentSettings.autoDescribe !== false ? "bg-primary" : "bg-gray-300"
                  )}>
                    <div className={cn(
                      "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                      currentSettings.autoDescribe !== false ? "right-1" : "left-1"
                    )} />
                  </div>
                </button>
              </div>

              {/* Font Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <Type size={12} />
                  {t('fontFamily')}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {FONTS.map((font) => (
                    <button
                      key={font.value}
                      onClick={() => handleFontChange(font.value)}
                      className={cn(
                        "px-3 py-2 rounded-xl text-sm text-left transition-all border",
                        currentSettings.fontFamily === font.value
                          ? "bg-primary/5 border-primary text-primary font-bold"
                          : currentSettings.isDarkMode 
                            ? "bg-gray-800 border-transparent text-gray-300 hover:bg-gray-700" 
                            : "bg-gray-50 border-transparent text-gray-600 hover:bg-gray-100"
                      )}
                      style={{ fontFamily: font.value }}
                    >
                      {t(font.name as any)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ y: -8 }}
        transition={{ 
          type: "spring", 
          stiffness: 400, 
          damping: 15,
        }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-colors border group",
          currentSettings.isDarkMode 
            ? "bg-gray-900 text-gray-400 border-gray-800 hover:text-white" 
            : "bg-white text-gray-600 border-gray-100 hover:text-primary"
        )}
      >
        <Settings size={24} className={cn("transition-transform duration-500", isOpen ? "rotate-90" : "")} />
        <span className={cn(
          "absolute right-full mr-4 px-3 py-1.5 text-xs font-bold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border",
          currentSettings.isDarkMode 
            ? "bg-gray-900 text-white border-gray-800" 
            : "bg-white text-gray-600 border-gray-100"
        )}>
          {t('interfaceSettings')}
        </span>
      </motion.button>
    </div>
  );
}
