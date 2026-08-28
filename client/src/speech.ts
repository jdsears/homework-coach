// Speech helpers shared by the chat room: what to read aloud, and in which
// language. Language coaches write target-language phrases in *italics*, so a
// reply can be spoken as English narration with correctly-accented French or
// Spanish inside it.

export const SUBJECT_SPEECH_LANGS: Record<string, string> = {
  french: 'fr-FR',
  spanish: 'es-ES',
};

export interface SpeechSegment {
  text: string;
  lang: string;
}

// Markdown/LaTeX decorations that should never be read out loud
export function stripForSpeech(markdown: string): string {
  return markdown
    .replace(/\$\$?/g, ' ')
    .replace(/[*_#`>|]/g, '')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Bold first so **not italics** is left alone, then single-asterisk/underscore
// italics, which is what the language coaches mark target-language text with.
const ITALIC_RE = /\*\*[\s\S]*?\*\*|\*([^*\n]+)\*|_([^_\n]+)_/g;

export function speechSegments(
  markdown: string,
  { baseLang, targetLang }: { baseLang: string; targetLang?: string }
): SpeechSegment[] {
  if (!targetLang) {
    const text = stripForSpeech(markdown);
    return text ? [{ text, lang: baseLang }] : [];
  }

  const segments: SpeechSegment[] = [];
  let cursor = 0;
  ITALIC_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ITALIC_RE.exec(markdown)) !== null) {
    const inner = match[1] ?? match[2];
    if (inner === undefined) continue; // bold: stays with the narration
    if (match.index > cursor) {
      segments.push({ text: markdown.slice(cursor, match.index), lang: baseLang });
    }
    segments.push({ text: inner, lang: targetLang });
    cursor = match.index + match[0].length;
  }
  if (cursor < markdown.length) {
    segments.push({ text: markdown.slice(cursor), lang: baseLang });
  }

  return segments
    .map(segment => ({ ...segment, text: stripForSpeech(segment.text) }))
    .filter(segment => segment.text);
}

// Exact locale match wins; otherwise any voice for the same language
export function pickVoice<T extends { lang: string }>(voices: T[], lang: string): T | null {
  const wanted = lang.toLowerCase();
  const normalize = (voice: T) => voice.lang.replace('_', '-').toLowerCase();
  return (
    voices.find(voice => normalize(voice) === wanted) ??
    voices.find(voice => normalize(voice).startsWith(wanted.slice(0, 2))) ??
    null
  );
}
