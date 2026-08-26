import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Camera, Mic, MicOff, Volume2, X, History } from 'lucide-react';
import CoachMarkdown from './CoachMarkdown';
import { streamChat, apiJson, gradeLabel, fileToApiImage } from '../api';
import { useFamily } from '../FamilyContext';

const subjectConfig = {
  math: {
    name: 'Math',
    coach: 'Coach Mathilda',
    emoji: '🧮',
    starters: [
      'I need help with fractions',
      'Can you help me with word problems?',
      "I'm stuck on my math homework",
    ],
  },
  reading: {
    name: 'Reading & Writing',
    coach: 'Coach Riley',
    emoji: '📖',
    starters: [
      'I need to write an essay',
      'Can you help me understand this story?',
      "I'm learning new vocabulary words",
    ],
  },
  science: {
    name: 'Science',
    coach: 'Coach Newton',
    emoji: '🔬',
    starters: [
      'How does photosynthesis work?',
      'I have a science project question',
      'Help me understand the solar system',
    ],
  },
  geography: {
    name: 'Geography',
    coach: 'Coach Atlas',
    emoji: '🌍',
    starters: [
      'Help me learn the continents',
      "What's the difference between countries and states?",
      'I need to learn about a country for school',
    ],
  },
  history: {
    name: 'History',
    coach: 'Coach Clio',
    emoji: '🏛️',
    starters: [
      'Tell me about ancient civilizations',
      "I'm learning about a historical figure",
      'Why did this event happen in history?',
    ],
  },
  french: {
    name: 'French',
    coach: 'Coach Amélie',
    emoji: '🇫🇷',
    starters: [
      'How do I introduce myself in French?',
      'Help me with French vocabulary',
      'I need to practice French conversation',
    ],
  },
  spanish: {
    name: 'Spanish',
    coach: 'Coach Diego',
    emoji: '🇪🇸',
    starters: [
      'How do I say hello in Spanish?',
      'Help me with Spanish vocabulary',
      'I need to practice Spanish conversation',
    ],
  },
};

const SpeechRecognitionImpl =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

function updateLast(messages, patch) {
  const copy = messages.slice();
  const last = copy[copy.length - 1];
  copy[copy.length - 1] = typeof patch === 'function' ? patch(last) : { ...last, ...patch };
  return copy;
}

function stripForSpeech(markdown) {
  return markdown
    .replace(/\$\$?/g, ' ')
    .replace(/[*_#`>|]/g, '')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ChatRoom() {
  const { subject } = useParams();
  const navigate = useNavigate();
  const { activeChild } = useFamily();

  const config = subjectConfig[subject] || subjectConfig.math;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [pendingImage, setPendingImage] = useState(null);
  const [listening, setListening] = useState(false);
  const [resumable, setResumable] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Offer to pick up the most recent conversation in this subject
  useEffect(() => {
    let cancelled = false;
    if (!activeChild) return undefined;
    apiJson(`/api/sessions/recent?childId=${activeChild.id}`)
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
      recognitionRef.current?.stop?.();
      window.speechSynthesis?.cancel();
    },
    []
  );

  if (!activeChild) return null;

  const resumeSession = async () => {
    try {
      const data = await apiJson(`/api/sessions/${resumable.id}/messages`);
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

  const attachPhoto = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setPendingImage(await fileToApiImage(file));
    } catch (error) {
      console.error('Photo error:', error);
      setMessages(prev => [
        ...prev,
        { role: 'system', content: "That photo didn't come through - try taking it again! 📷" },
      ]);
    }
  };

  const toggleListening = () => {
    if (!SpeechRecognitionImpl) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = 'en-US';
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

  const speak = text => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(stripForSpeech(text));
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async messageText => {
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
        subject,
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
            content: error.friendly
              ? error.message
              : "Oops! Something went wrong. Let's try again! 🔄",
          },
        ];
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = e => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const visibleMessages = messages.filter(msg => !(msg.streaming && !msg.content));
  const waitingForFirstToken =
    isLoading &&
    messages[messages.length - 1]?.streaming &&
    !messages[messages.length - 1]?.content;

  return (
    <div className="chat-room">
      <header className="chat-header">
        <button className="back-btn" onClick={() => navigate('/')} aria-label="Back to subjects">
          <ArrowLeft size={24} />
        </button>
        <div className="chat-header-info">
          <h1>
            {config.emoji} {config.coach}
          </h1>
          <p>
            {activeChild.name} · {gradeLabel(activeChild.grade)} grade · {config.name}
          </p>
        </div>
      </header>

      <div className="messages-container">
        {visibleMessages.length === 0 && !waitingForFirstToken ? (
          <div className="welcome-message">
            <div className={`welcome-avatar ${subject}`}>{config.emoji}</div>
            <h2>
              Hi {activeChild.name}! I'm {config.coach}!
            </h2>
            <p>
              I'm here to help you learn - not just give you answers! Tell me what you're working
              on, or snap a photo of it. 🌟
            </p>
            {resumable && (
              <button className="resume-chip" onClick={resumeSession}>
                <History size={16} /> Keep going where we left off
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
            <div key={idx} className={`message ${msg.role}`}>
              {msg.imageUrl && <img className="chat-photo" src={msg.imageUrl} alt="Homework" />}
              {msg.hadImage && !msg.imageUrl && <div className="photo-note">📷 sent a photo</div>}
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <>
                  <CoachMarkdown>{msg.content}</CoachMarkdown>
                  {msg.role === 'assistant' && !msg.streaming && msg.content && (
                    <button
                      className="speak-btn"
                      onClick={() => speak(msg.content)}
                      aria-label="Read this aloud"
                      title="Read aloud"
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

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-container" onSubmit={handleSubmit}>
        {pendingImage && (
          <div className="photo-preview">
            <img src={pendingImage.previewUrl} alt="Attached homework" />
            <span>Photo ready to send!</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setPendingImage(null)}
              aria-label="Remove photo"
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
            aria-label="Snap a photo of your homework"
            title="Snap your homework"
          >
            <Camera size={20} />
          </button>
          {SpeechRecognitionImpl && (
            <button
              type="button"
              className={`tool-btn ${listening ? 'listening' : ''}`}
              onClick={toggleListening}
              disabled={isLoading}
              aria-label={listening ? 'Stop listening' : 'Speak instead of typing'}
              title="Speak instead of typing"
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
            placeholder={listening ? 'Listening...' : 'Type your question here...'}
            rows={1}
            maxLength={2000}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="send-btn"
            disabled={(!input.trim() && !pendingImage) || isLoading}
            aria-label="Send message"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}

export default ChatRoom;
