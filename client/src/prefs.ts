// Per-device preferences: interface language and the dyslexia-friendlier
// reading font (Lexend). Stored locally; applied via a class on <body>.

export type Lang = 'en' | 'fr' | 'es';

const LANG_KEY = 'hc_lang';
const FONT_KEY = 'hc_reading_font';

export function getStoredLang(): Lang {
  try {
    const value = localStorage.getItem(LANG_KEY);
    if (value === 'en' || value === 'fr' || value === 'es') return value;
  } catch {
    // localStorage unavailable
  }
  return 'en';
}

export function storeLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // ignore
  }
}

export function getReadingFont(): boolean {
  try {
    return localStorage.getItem(FONT_KEY) === '1';
  } catch {
    return false;
  }
}

export function applyReadingFont(enabled: boolean): void {
  document.body.classList.toggle('reading-font', enabled);
}

export function storeReadingFont(enabled: boolean): void {
  try {
    localStorage.setItem(FONT_KEY, enabled ? '1' : '0');
  } catch {
    // ignore
  }
  applyReadingFont(enabled);
}
