import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, Sparkles, Upload, Shirt, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Tutorial({ isOpen, onClose }: TutorialProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('tutorialStep1Title' as any),
      description: t('tutorialStep1Desc' as any),
      icon: <Upload size={48} className="text-primary" />,
      color: 'bg-indigo-500/10'
    },
    {
      title: t('tutorialStep2Title' as any),
      description: t('tutorialStep2Desc' as any),
      icon: <Shirt size={48} className="text-primary" />,
      color: 'bg-rose-500/10'
    },
    {
      title: t('tutorialStep3Title' as any),
      description: t('tutorialStep3Desc' as any),
      icon: <Sparkles size={48} className="text-primary" />,
      color: 'bg-emerald-500/10'
    }
  ];

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
      setStep(0);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors z-10"
            >
              <X size={20} className="text-gray-500" />
            </button>

            <div className="p-8">
              <div className="flex justify-center mb-8">
                <motion.div
                  key={step}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={cn("w-24 h-24 rounded-3xl flex items-center justify-center", steps[step].color)}
                >
                  {steps[step].icon}
                </motion.div>
              </div>

              <div className="text-center space-y-4 mb-8">
                <h2 className="text-2xl font-bold dark:text-white">
                  {steps[step].title}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  {steps[step].description}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  {steps.map((_, i) => (
                    <div 
                      key={i}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        i === step ? "w-8 bg-primary" : "w-1.5 bg-gray-200 dark:bg-gray-800"
                      )}
                    />
                  ))}
                </div>

                <button
                  onClick={nextStep}
                  className="px-6 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center gap-2 group"
                >
                  {step === steps.length - 1 ? t('finish' as any) : t('next' as any)}
                  {step === steps.length - 1 ? <CheckCircle2 size={18} /> : <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
