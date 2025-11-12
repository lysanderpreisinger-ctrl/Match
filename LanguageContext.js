// LanguageContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import i18n from './i18n';

const LanguageContext = createContext({
  lang: 'de',
  t: (key, opts) => key,
  setLang: () => {},
  refreshFromSupabase: async () => {},
});

export function LanguageProvider({ children, initialLang = 'de', session }) {
  const [lang, setLang] = useState(initialLang);

  // 🔄 Sprache beim Start aus Supabase laden (falls eingeloggt)
  useEffect(() => {
    (async () => {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('app_language')
        .eq('id', session.user.id)
        .maybeSingle();
      if (data?.app_language) {
        setLang(data.app_language);
        i18n.locale = data.app_language;
      }
    })();
  }, [session?.user?.id]);

  // 💡 Wenn sich Sprache ändert → i18n updaten
  useEffect(() => {
    i18n.locale = lang;
  }, [lang]);

  const refreshFromSupabase = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('app_language')
      .eq('id', session.user.id)
      .maybeSingle();
    if (data?.app_language) {
      setLang(data.app_language);
      i18n.locale = data.app_language;
    }
  };

  const value = {
    lang,
    t: (key, opts) => i18n.t(key, opts),
    setLang: (nextLang) => {
      setLang(nextLang);
      i18n.locale = nextLang;
    },
    refreshFromSupabase,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
