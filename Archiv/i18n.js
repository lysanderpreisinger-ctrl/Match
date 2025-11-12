// i18n.js
import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';   // <- WICHTIG: geschweifte Klammern!

import de from './locales/de.json';
import en from './locales/en.json';

// Instanz anlegen
const i18n = new I18n({
  de,
  en,
});

// Sprache aus dem Gerät holen (z.B. "de-DE" -> "de")
const deviceLang = Localization.locale?.split('-')[0] || 'de';

// Fallbacks erlauben (wenn key in Sprache fehlt -> andere Sprache)
i18n.enableFallback = true;
i18n.locale = deviceLang;

export default i18n;
