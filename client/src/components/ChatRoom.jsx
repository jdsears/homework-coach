import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { streamChat, gradeLabel } from '../api';
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

function updateLast(messages, patch) {
  const copy = messages.slice();
  const last = copy[copy.length - 1];
  copy[copy.length - 1] = typeof patch === 'function' ? patch(last) : { ...last, ...patch };
  return copy;
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

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!activeChild) return null;

  const sendMessage = async messageText => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    setMessages(prev => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '', streaming: true },
    ]);
    setInput('');
    setIsLoading(true);

    try {
      await streamChat({
        childId: activeChild.id,
        sessionId,
        subject,
        message: text,
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
              I'm here to help you learn - not just give you answers! Tell me what you're working on
              and we'll figure it out together. 🌟
            </p>
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
              {msg.role === 'user' ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
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
        <div className="chat-input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question here..."
            rows={1}
            maxLength={2000}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="send-btn"
            disabled={!input.trim() || isLoading}
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
