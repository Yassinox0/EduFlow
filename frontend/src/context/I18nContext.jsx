import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import ar from "../i18n/ar";
import fr from "../i18n/fr";

const dictionaries = { fr, ar };
const STORAGE_KEY = "app_language";

export const I18nContext = createContext(null);

const readTranslation = (dictionary, key) =>
  key.split(".").reduce((value, part) => value?.[part], dictionary);

const interpolate = (value, variables) =>
  Object.entries(variables).reduce(
    (text, [key, replacement]) => text.replaceAll(`{{${key}}}`, String(replacement)),
    value
  );

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "ar" ? "ar" : "fr";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.language = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage) => {
    setLanguageState(nextLanguage === "ar" ? "ar" : "fr");
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((current) => (current === "fr" ? "ar" : "fr"));
  }, []);

  const t = useCallback(
    (key, variables = {}) => {
      const translated = readTranslation(dictionaries[language], key);
      const fallback = readTranslation(fr, key);
      const value = typeof translated === "string" ? translated : fallback;
      return typeof value === "string" ? interpolate(value, variables) : key;
    },
    [language]
  );

  const value = useMemo(
    () => ({ language, direction: language === "ar" ? "rtl" : "ltr", setLanguage, toggleLanguage, t }),
    [language, setLanguage, toggleLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
