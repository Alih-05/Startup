import React from 'react';
import { motion } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowLeft, ExternalLink, Github, Linkedin, MessageSquare, User } from 'lucide-react';

interface TeacherPageProps {
  onBack: () => void;
}

export const TeacherPage: React.FC<TeacherPageProps> = ({ onBack }) => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-6">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors mb-8 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">{t('backToEditor')}</span>
        </button>

        <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
          <div className="h-48 bg-gradient-to-r from-indigo-600 to-violet-600 relative">
            <div className="absolute -bottom-16 left-12">
              <div className="w-32 h-32 rounded-full border-4 border-white overflow-hidden bg-gray-100 shadow-xl flex items-center justify-center text-gray-400">
                <User size={64} />
              </div>
            </div>
          </div>

          <div className="pt-20 pb-12 px-12">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold text-gray-900">{t('teacherName')}</h1>
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded-md">
                    {t('mentorBadge')}
                  </span>
                </div>
                <p className="text-indigo-600 font-medium">{t('teacherBio')}</p>
              </div>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-8">
                <section>
                  <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                    {t('teacherAboutTitle')}
                  </h2>
                  <p className="text-gray-600 leading-relaxed">
                    {t('teacherAboutText')}
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                    {t('teacherExpertiseTitle')}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {(t('teacherSkills') as string[]).map(skill => (
                      <span key={skill} className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-700">
                        {skill}
                      </span>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <h3 className="font-bold text-indigo-900 mb-2">{t('teacherStatsTitle')}</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-indigo-700">{t('teacherStatsProjects')}</span>
                      <span className="font-bold text-indigo-900">25+</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-indigo-700">{t('teacherStatsStudents')}</span>
                      <span className="font-bold text-indigo-900">100+</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-indigo-700">{t('teacherStatsExperience')}</span>
                      <span className="font-bold text-indigo-900">{t('teacherStatsExpValue')}</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-4">{t('teacherSocialTitle')}</h3>
                  <div className="space-y-3">
                    <a href="https://t.me/alphasolutionskz" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                          <MessageSquare size={16} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Telegram</span>
                      </div>
                      <ExternalLink size={14} className="text-gray-400 group-hover:text-indigo-600" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
