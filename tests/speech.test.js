import { describe, it, expect } from 'vitest';
import {
  SUBJECT_SPEECH_LANGS,
  pickVoice,
  speechSegments,
  stripForSpeech,
} from '../client/src/speech';

describe('read-aloud segmentation', () => {
  it('reads a normal reply as one English chunk', () => {
    expect(speechSegments('Nice! What is **3/4** of $12$?', { baseLang: 'en-GB' })).toEqual([
      { text: 'Nice! What is 3/4 of 12 ?', lang: 'en-GB' },
    ]);
  });

  it('speaks italicised target-language phrases in the target voice', () => {
    expect(
      speechSegments('In Spanish we say *las matemáticas* - your turn!', {
        baseLang: 'en-GB',
        targetLang: 'es-ES',
      })
    ).toEqual([
      { text: 'In Spanish we say', lang: 'en-GB' },
      { text: 'las matemáticas', lang: 'es-ES' },
      { text: '- your turn!', lang: 'en-GB' },
    ]);
  });

  it('leaves bold emphasis in the narration voice', () => {
    const segments = speechSegments('That is **really** close, *bien joué*!', {
      baseLang: 'en-GB',
      targetLang: 'fr-FR',
    });
    expect(segments.map(segment => segment.lang)).toEqual(['en-GB', 'fr-FR', 'en-GB']);
    expect(segments[0].text).toBe('That is really close,');
  });

  it('handles a reply that is entirely target language', () => {
    expect(speechSegments('*Bonjour !*', { baseLang: 'en-GB', targetLang: 'fr-FR' })).toEqual([
      { text: 'Bonjour !', lang: 'fr-FR' },
    ]);
  });

  it('strips markdown and LaTeX commands before speaking', () => {
    // Braces survive (harmless to a speech engine); the markup itself does not
    expect(stripForSpeech('## Try $\\frac{1}{2}$ **now**')).toBe('Try {1}{2} now');
  });
});

describe('voice selection', () => {
  const voices = [{ lang: 'en-US' }, { lang: 'fr_FR' }, { lang: 'es-MX' }];

  it('prefers an exact locale, normalising underscores', () => {
    expect(pickVoice(voices, 'fr-FR')).toEqual({ lang: 'fr_FR' });
  });

  it('falls back to any voice for the same language', () => {
    expect(pickVoice(voices, 'es-ES')).toEqual({ lang: 'es-MX' });
  });

  it('returns null when the language is unavailable', () => {
    expect(pickVoice(voices, 'de-DE')).toBeNull();
  });

  it('maps language subjects to their locale', () => {
    expect(SUBJECT_SPEECH_LANGS.french).toBe('fr-FR');
    expect(SUBJECT_SPEECH_LANGS.spanish).toBe('es-ES');
    expect(SUBJECT_SPEECH_LANGS.math).toBeUndefined();
  });
});
