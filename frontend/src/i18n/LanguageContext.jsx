import { createContext, useContext, useState, useCallback } from 'react';
import translations from './translations.js';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('se-lang') || 'en';
  });

  const setLanguage = useCallback((newLang) => {
    setLang(newLang);
    localStorage.setItem('se-lang', newLang);
  }, []);

  const t = useCallback((section, key) => {
    return translations[lang]?.[section]?.[key]
      ?? translations['en']?.[section]?.[key]
      ?? key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
