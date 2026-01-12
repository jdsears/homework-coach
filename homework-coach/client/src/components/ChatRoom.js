import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send, Calculator, BookOpen, FlaskConical, Globe, Landmark, Languages } from 'lucide-react';

const subjectConfig = {
  math: {
    name: 'Math',
    coach: 'Coach Mathilda',
    emoji: '🧮',
    icon: Calculator,
    starters: [
      "I need help with fractions",
      "Can you help me with word problems?",
      "I'm stuck on my math homework",
    ],
  },
  reading: {
    name: 'Reading & Writing',
    coach: 'Coach Riley',
    emoji: '📖',
    icon: BookOpen,
    starters: [
      "I need to write an essay",
      "Can you help me understand this story?",
      "I'm learning new vocabulary words",
    ],
  },
  science: {
    name: 'Science',
    coach: 'Coach Newton',
    emoji: '🔬',
    icon: FlaskConical,
    starters: [
      "How does photosynthesis work?",
      "I have a science project question",
      "Help me understand the solar system",
    ],
  },
  geography: {
    name: 'Geography',
    coach: 'Coach Atlas',
    emoji: '🌍',
    icon: Globe,
    starters: [
      "Help me learn the continents",
      "What's the difference between countries and states?",
      "I need to learn about a country for school",
    ],
  },
  history: {
    name: 'History',
    coach: 'Coach Clio',
    emoji: '🏛️',
    icon: Landmark,
    starters: [
      "Tell me about ancient civilizations",
      "I'm learning about a historical figure",
      "Why did this event happen in history?",
    ],
  },
  french: {
    name: 'French',
    coach: 'Coach Amélie',
    emoji: '🇫🇷',
    icon: Languages,
    starters: [
      "How do I introduce myself in French?",
      "Help me with French vocabulary",
      "I need to practice French conversation",
    ],
  },
  spanish: {
    name: 'Spanish',
    coach: 'Coach Diego',
    emoji: '🇪🇸',
    icon: Languages,
    starters: [
      "How do I say hello in Spanish?",
      "Help me with Spanish vocabulary",
      "I need to practice Spanish conversation",
    ],
  },
};

function ChatRoom() {
  const { subject } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const grade = searchParams.get('grade') || '5';
  
  const config = subjectConfig[subject] || subjectConfig.math;
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageText) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: text,
          subject,
          grade,
        }),
      });

      const data = await response.json();

      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      const assistantMessage = {
        role: data.cheatDetected ? 'system' : 'assistant',
        content: data.response,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'system',
        content: 'Oops! Something went wrong. Let\'s try again! 🔄',
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-room">
      <header className="chat-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={24} />
        </button>
        <div className="chat-header-info">
          <h1>{config.emoji} {config.coach}</h1>
          <p>Grade {grade} • {config.name}</p>
        </div>
      </header>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <div className={`welcome-avatar ${subject}`}>
              {config.emoji}
            </div>
            <h2>Hi there! I'm {config.coach}!</h2>
            <p>
              I'm here to help you learn - not just give you answers! 
              Tell me what you're working on and we'll figure it out together. 🌟
            </p>
            <div className="starter-questions">
              {config.starters.map((starter, idx) => (
                <button
                  key={idx}
                  className="starter-btn"
                  onClick={() => sendMessage(starter)}
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              {msg.content}
            </div>
          ))
        )}
        
        {isLoading && (
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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question here..."
            rows={1}
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className="send-btn"
            disabled={!input.trim() || isLoading}
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}

export default ChatRoom;
