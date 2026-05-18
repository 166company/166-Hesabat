import React, { createContext, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Language } from '../types';

interface LanguageContextValue {
  lang: Language;
  setLang: (l: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [lang, setLangState] = useState<Language>((localStorage.getItem('lang') as Language) || 'az');

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem('lang', l);
    i18n.changeLanguage(l);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
