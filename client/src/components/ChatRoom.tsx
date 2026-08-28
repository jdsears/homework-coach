import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Camera, Mic, MicOff, Volume2, X, History } from 'lucide-react';
import CoachMarkdown from './CoachMarkdown';
import { streamChat, apiJson, fileToApiImage, isApiError, type ApiImage } from '../api';
import { useFamily } from '../FamilyContext';
import { useI18n, useGradeLabel, useSubjectName, type TFunction } from '../i18n';
import { SUBJECT_SPEECH_LANGS, pickVoice, speechSegments } from '../speech';
import type { ChatMessage, RecentSession } from '../types';

interface SubjectConfig {
  key: string;
  name: string;
  coach: string;
  emoji: string;
  starters: string[];
  isPersona: boolean;
}

const BUILTIN_COACHES: Record<string, { coach: string; emoji: string }> = {
  math: { coach: 'Coach Mathilda', emoji: '🧮' },
  reading: { coach: 'Coach Riley', emoji: '📖' },
  science: { coach: 'Coach Newton', emoji: '🔬' },
  geography: { coach: 'Coach Atlas', emoji: '🌍' },
  history: { coach: 'Coach Clio', emoji: '🏛️' },
  french: { coach: 'Coach Amélie', emoji: '🇫🇷' },
  spanish: { coach: 'Coach Diego', emoji: '🇪🇸' },
  furthermaths: { coach: 'Coach Ada', emoji: '📐' },
};

function resolveConfig(
  subject: string | undefined,
  t: TFunction,
  subjectName: (id: string) => string,
  personas: Array<{ id: string; name: string; emoji: string; description: string }>
): SubjectConfig {
  if (subject?.startsWith('p:')) {
    const persona = personas.find(p => p.id === subject.slice(2));
    if (persona) {
      return {
        key: subject,
        name: persona.description,
        coach: persona.name,
        emoji: persona.emoji,
        starters: [t('chat.customStarter1'), t('chat.customStarter2')],
        isPersona: true,
      };
    }
  }
  const key = subject && subject in BUILTIN_COACHES ? subject : 'math';
  return {
    key,
    name: subjectName(key),
    coach: BUILTIN_COACHES[key].coach,
    emoji: BUILTIN_COACHES[key].emoji,
    starters: [t(`subject.${key}.s1`), t(`subject.${key}.s2`), t(`subject.${key}.s3`)],
    isPersona: false,
  };
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const SpeechRecognitionImpl: (new () => SpeechRecognitionLike) | undefined =
  typeof window !== 'undefined'
    ? ((window as unknown as Record<string, unknown>).SpeechRecognition as
        (new () => SpeechRecognitionLike) | undefined) ||
      ((window as unknown as Record<string, unknown>).webkitSpeechRecognition as
        (new () => SpeechRecognitionLike) | undefined)
    : undefined;

function updateLast(
  messages: ChatMessage[],
  patch: Partial<ChatMessage> | ((last: ChatMessage) => ChatMessage)
): ChatMessage[] {
  const copy = messages.slice();
  const last = copy[copy.length - 1];
  copy[copy.length - 1] = typeof patch === 'function' ? patch(last) : { ...last, ...patch };
  return copy;
}

function ChatRoom() {
  const { subject } = useParams();
  const navigate = useNavigate();
  const { family, activeChild, personas } = useFamily();
  const { t } = useI18n();
  const gradeLabel = useGradeLabel();
  const subjectName = useSubjectName();

  const config = resolveConfig(subject, t, subjectName, personas);
  const baseLang = family?.curriculum === 'uk' ? 'en-GB' : 'en-US';
  const targetLang = SUBJECT_SPEECH_LANGS[config.key];

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<ApiImage | null>(null);
  const [listening, setListening] = useState(false);
  const [resumable, setResumable] = useState<RecentSession | null>(null);

  const messagesRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  // Whether the reader is parked at the bottom and wants to be carried along
  const followRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Follow a streaming reply only while the reader is already at the bottom,
  // so scrolling back to re-read something isn't yanked away mid-sentence.
  useEffect(() => {
    if (!followRef.current) return;
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  // A new question moves to the top of the view, so its answer is read from
  // the beginning instead of appearing already scrolled past.
  const questionCount = messages.filter(message => message.role === 'user').length;
  useEffect(() => {
    const container = messagesRef.current;
    const question = questionRef.current;
    if (!container || !question || !questionCount) return;
    followRef.current = false;
    const offset =
      question.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    container.scrollTo({ top: Math.max(0, offset - 8), behavior: 'smooth' });
  }, [questionCount]);

  // Grow the input with its content, up to a few lines
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  // Offer to pick up the most recent conversation in this subject
  useEffect(() => {
    let cancelled = false;
    if (!activeChild) return undefined;
    apiJson<{ sessions: RecentSession[] }>(`/api/sessions/recent?childId=${activeChild.id}`)
      .then(({ sessions }) => {
        if (cancelled) return;
        const match = sessions.find(s => s.subject === subject && s.messageCount > 0);
        if (match) setResumable(match);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeChild, subject]);

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    },
    []
  );

  if (!activeChild) return null;

  const resumeSession = async () => {
    if (!resumable) return;
    try {
      const data = await apiJson<{
        sessionId: string;
        messages: Array<{ role: 'user' | 'assistant'; content: string; hasImage: boolean }>;
      }>(`/api/sessions/${resumable.id}/messages`);
      setMessages(
        data.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          hadImage: msg.hasImage,
        }))
      );
      setSessionId(data.sessionId);
      setResumable(null);
    } catch {
      setResumable(null);
    }
  };

  const attachPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setPendingImage(await fileToApiImage(file));
    } catch (error) {
      console.error('Photo error:', error);
      setMessages(prev => [...prev, { role: 'system', content: t('chat.photoFailed') }]);
    }
  };

  const toggleListening = () => {
    if (!SpeechRecognitionImpl) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = targetLang ?? baseLang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  // Read a reply aloud: narration in the family's English, and any phrase the
  // language coach italicised in a real French/Spanish voice, a touch slower.
  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    for (const segment of speechSegments(text, { baseLang, targetLang })) {
      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.lang = segment.lang;
      const voice = pickVoice(voices, segment.lang);
      if (voice) utterance.voice = voice;
      utterance.rate = segment.lang === targetLang ? 0.85 : 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  const sendMessage = async (messageText?: string) => {
    const image = pendingImage;
    const text = messageText || input.trim() || (image ? 'Can you help me with this?' : '');
    if (!text || isLoading) return;

    setMessages(prev => [
      ...prev,
      { role: 'user', content: text, imageUrl: image?.previewUrl },
      { role: 'assistant', content: '', streaming: true },
    ]);
    setInput('');
    setPendingImage(null);
    setIsLoading(true);

    try {
      await streamChat({
        childId: activeChild.id,
        sessionId,
        subject: config.key,
        message: text,
        image: image ? { media_type: image.media_type, data: image.data } : undefined,
        onMeta: meta => {
          if (meta.sessionId) setSessionId(meta.sessionId);
          if (meta.cheatDetected) {
            setMessages(prev => updateLast(prev, { role: 'system' }));
          }
        },
        onDelta: delta => {
          setMessages(prev =>
            updateLast(prev, last => ({ ...last, content: last.content + delta }))
          );
        },
      });
      setMessages(prev => updateLast(prev, { streaming: false }));
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => {
        const copy = prev.slice();
        const last = copy[copy.length - 1];
        if (last?.streaming && !last.content) copy.pop();
        else if (last?.streaming) copy[copy.length - 1] = { ...last, streaming: false };
        return [
          ...copy,
          {
            role: 'system',
            content: isApiError(error) && error.friendly ? error.message : t('chat.error'),
          },
        ];
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleScroll = () => {
    const container = messagesRef.current;
    if (!container) return;
    followRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
  };

  const speakLabel = targetLang ? t('chat.speakLang', { lang: config.name }) : t('chat.speakTitle');
  const visibleMessages = messages.filter(msg => !(msg.streaming && !msg.content));
  const lastQuestionIndex = visibleMessages.map(msg => msg.role).lastIndexOf('user');
  const waitingForFirstToken =
    isLoading &&
    messages[messages.length - 1]?.streaming &&
    !messages[messages.length - 1]?.content;

  return (
    <div className="chat-room">
      <header className="chat-header">
        <button className="back-btn" onClick={() => navigate('/')} aria-label={t('chat.back')}>
          <ArrowLeft size={24} />
        </button>
        <div className="chat-header-info">
          <h1>
            {config.emoji} {config.coach}
          </h1>
          <p>
            {t('chat.headerLine', {
              name: activeChild.name,
              grade: gradeLabel(activeChild.grade),
              subject: config.name,
            })}
          </p>
        </div>
      </header>

      <div className="messages-container" ref={messagesRef} onScroll={handleScroll}>
        {visibleMessages.length === 0 && !waitingForFirstToken ? (
          <div className="welcome-message">
            <div className={`welcome-avatar ${config.isPersona ? 'custom' : config.key}`}>
              {config.emoji}
            </div>
            <h2>{t('chat.welcome', { name: activeChild.name, coach: config.coach })}</h2>
            <p>{t('chat.welcomeBody')}</p>
            {resumable && (
              <button className="resume-chip" onClick={resumeSession}>
                <History size={16} /> {t('chat.resume')}
              </button>
            )}
            <div className="starter-questions">
              {config.starters.map((starter, idx) => (
                <button key={idx} className="starter-btn" onClick={() => sendMessage(starter)}>
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          visibleMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`message ${msg.role}`}
              ref={idx === lastQuestionIndex ? questionRef : undefined}
            >
              {msg.imageUrl && <img className="chat-photo" src={msg.imageUrl} alt="Homework" />}
              {msg.hadImage && !msg.imageUrl && (
                <div className="photo-note">📷 {t('chat.sentPhoto')}</div>
              )}
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <>
                  <CoachMarkdown>{msg.content}</CoachMarkdown>
                  {msg.role === 'assistant' && !msg.streaming && msg.content && (
                    <button
                      className="speak-btn"
                      onClick={() => speak(msg.content)}
                      aria-label={t('chat.readAloud')}
                      title={t('chat.readAloud')}
                    >
                      <Volume2 size={16} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))
        )}

        {waitingForFirstToken && (
          <div className="message assistant">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        <div className="messages-tail" ref={messagesEndRef} />
      </div>

      <form className="chat-input-container" onSubmit={handleSubmit}>
        {pendingImage && (
          <div className="photo-preview">
            <img src={pendingImage.previewUrl} alt="Attached homework" />
            <span>{t('chat.photoReady')}</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setPendingImage(null)}
              aria-label={t('chat.removePhoto')}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="chat-input-wrapper">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={attachPhoto}
            hidden
          />
          <button
            type="button"
            className="tool-btn"
            onClick={() => fileRef.current?.click()}
            disabled={isLoading}
            aria-label={t('chat.snapTitle')}
            title={t('chat.snapTitle')}
          >
            <Camera size={20} />
          </button>
          {SpeechRecognitionImpl && (
            <button
              type="button"
              className={`tool-btn ${listening ? 'listening' : ''}`}
              onClick={toggleListening}
              disabled={isLoading}
              aria-label={listening ? t('chat.stopTitle') : speakLabel}
              title={speakLabel}
            >
              {listening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={listening ? t('chat.listening') : t('chat.inputPh')}
            rows={1}
            maxLength={2000}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="send-btn"
            disabled={(!input.trim() && !pendingImage) || isLoading}
            aria-label={t('chat.send')}
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}

export default ChatRoom;
