// i18n.js
const translations = {
  de: {
    app: {
      name: 'jatch',
    },
    settings: {
      title: 'Einstellungen',
      feedback: 'Feedback',
      share: 'App teilen',
      rate: 'App bewerten',
      imprint: 'Impressum',
      privacy: 'Datenschutzerklärung',
      terms: 'AGB',
      notifications: 'Benachrichtigungen',
      language: 'Sprache',
      payment: 'Bezahlmethode',
      signout: 'Abmelden',
      delete: 'Account löschen',
    },
    notifications: {
      title: 'Benachrichtigungen',
      newMessages: 'Neue Nachrichten',
      newMatches: 'Neue Matches',
      newFlex: 'Neue FlexJobs',
      newJobs: 'Neue Stellenanzeigen',
    },
    feedback: {
      title: 'Feedback',
      placeholder: 'Schreib uns hier dein Feedback…',
      send: 'Absenden',
    },
  },
  en: {
    app: {
      name: 'jatch',
    },
    settings: {
      title: 'Settings',
      feedback: 'Give feedback',
      share: 'Share app',
      rate: 'Rate app',
      imprint: 'Imprint',
      privacy: 'Privacy policy',
      terms: 'Terms & Conditions',
      notifications: 'Notifications',
      language: 'Language',
      payment: 'Payment method',
      signout: 'Sign out',
      delete: 'Delete account',
    },
    notifications: {
      title: 'Notifications',
      newMessages: 'New messages',
      newMatches: 'New matches',
      newFlex: 'New flex jobs',
      newJobs: 'New job posts',
    },
    feedback: {
      title: 'Feedback',
      placeholder: 'Write your feedback here…',
      send: 'Send',
    },
  },
};

export function translate(lang = 'de', key = '') {
  // key z.B. 'settings.title'
  const parts = key.split('.');
  let current = translations[lang] || translations.de;
  for (const p of parts) {
    if (!current[p]) return key; // fallback
    current = current[p];
  }
  return current;
}

// falls du später was exportieren willst
export const SUPPORTED_LANGS = ['de', 'en'];
