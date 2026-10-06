import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import translations from './translations';
import { phrases } from './phrases';

export type Lang = 'en' | 'si' | 'ta';

interface LanguageValue {
  lang: Lang;
  setLanguage: (lang: Lang) => void;
  t: (section: string, key: string) => string;
  /** Translate a whole English sentence (marketing pages); unknown sentences stay English. */
  p: (text: string) => string;
}

type Dictionary = Record<string, Record<string, Record<string, string>>>;
const dictionary = translations as unknown as Dictionary;

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('se-lang');
    return saved === 'si' || saved === 'ta' ? saved : 'en';
  });

  const setLanguage = useCallback((newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem('se-lang', newLang);
  }, []);

  const t = useCallback(
    (section: string, key: string) =>
      dictionary[lang]?.[section]?.[key] ?? dictionary['en']?.[section]?.[key] ?? key,
    [lang],
  );

  const p = useCallback(
    (text: string) => (lang === 'en' ? text : (phrases as Record<string, Record<string, string>>)[lang]?.[text] ?? text),
    [lang],
  );

  return <LanguageContext.Provider value={{ lang, setLanguage, t, p }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
