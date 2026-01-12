import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send, Calculator, BookOpen, FlaskConical, Globe, Landmark, Languages, Image, X } from 'lucide-react';

const subjectConfig = {
  maths: {
    name: 'Maths',
    coach: 'Coach Mathilda',
    emoji: '🧮',
    icon: Calculator,
    starters: [
      "I need help with fractions",
      "📝 Review my marked homework",
      "🎓 Teach me about...",
    ],
    lessonTopics: ["algebra", "percentages", "Pythagoras", "ratios"],
  },
  english: {
    name: 'English',
    coach: 'Coach Riley',
    emoji: '📖',
    icon: BookOpen,
    starters: [
      "I need to write an essay",
      "📝 Review my marked homework",
      "🎓 Teach me about...",
    ],
    lessonTopics: ["essay structure", "analysing poetry", "persuasive writing", "Shakespeare"],
  },
  science: {
    name: 'Science',
    coach: 'Coach Newton',
    emoji: '🔬',
    icon: FlaskConical,
    starters: [
      "How does photosynthesis work?",
      "📝 Review my marked homework",
      "🎓 Teach me about...",
    ],
    lessonTopics: ["atoms", "electricity", "the human body", "chemical reactions"],
  },
  geography: {
    name: 'Geography',
    coach: 'Coach Atlas',
    emoji: '🌍',
    icon: Globe,
    starters: [
      "Help me learn the continents",
      "📝 Review my marked homework",
      "🎓 Teach me about...",
    ],
    lessonTopics: ["climate change", "volcanoes", "rivers", "population"],
  },
  history: {
    name: 'History',
    coach: 'Coach Clio',
    emoji: '🏛️',
    icon: Landmark,
    starters: [
      "Tell me about ancient civilizations",
      "📝 Review my marked homework",
      "🎓 Teach me about...",
    ],
    lessonTopics: ["the Tudors", "World War II", "the Industrial Revolution", "the Roman Empire"],
  },
  french: {
    name: 'French',
    coach: 'Coach Amélie',
    emoji: '🇫🇷',
    icon: Languages,
    starters: [
      "Help me with French vocabulary",
      "📝 Review my marked homework",
      "🎓 Teach me about...",
    ],
    lessonTopics: ["past tense", "food vocabulary", "asking questions", "numbers"],
  },
  spanish: {
    name: 'Spanish',
    coach: 'Coach Diego',
    emoji: '🇪🇸',
    icon: Languages,
    starters: [
      "Help me with Spanish vocabulary",
      "📝 Review my marked homework",
      "🎓 Teach me about...",
    ],
    lessonTopics: ["past tense", "food vocabulary", "asking questions", "numbers"],
  },
};

function ChatRoom() {
  const { subject } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const year = searchParams.get('year') || '9';

  const config = subjectConfig[subject] || subjectConfig.maths;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showLessonPicker, setShowLessonPicker] = useState(false);
  const [customTopic, setCustomTopic] = useState('');

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image is too large. Please choose an image under 5MB.');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }

      setSelectedImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = async (messageText) => {
    const text = messageText || input.trim();
    if ((!text && !selectedImage) || isLoading) return;

    // Create user message with optional image
    const userMessage = {
      role: 'user',
      content: text || 'Can you help me with this?',
      image: imagePreview
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Prepare image data for API
    let imageData = null;
    if (selectedImage) {
      const reader = new FileReader();
      imageData = await new Promise((resolve) => {
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve({
            type: selectedImage.type,
            data: base64
          });
        };
        reader.readAsDataURL(selectedImage);
      });
    }

    // Clear image after capturing data
    clearImage();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: text || 'Can you help me with this image?',
          subject,
          year,
          image: imageData,
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
          <p>Year {year} • {config.name}</p>
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
            <p className="image-hint">
              📷 Share photos of your textbook, worksheet, or marked homework for help!
            </p>
            {!showLessonPicker ? (
              <div className="starter-questions">
                {config.starters.map((starter, idx) => (
                  <button
                    key={idx}
                    className="starter-btn"
                    onClick={() => {
                      if (starter.includes('Teach me about')) {
                        setShowLessonPicker(true);
                      } else {
                        sendMessage(starter);
                      }
                    }}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            ) : (
              <div className="lesson-picker">
                <h3>What would you like to learn about?</h3>
                <div className="lesson-topics">
                  {config.lessonTopics.map((topic, idx) => (
                    <button
                      key={idx}
                      className="topic-btn"
                      onClick={() => {
                        sendMessage(`🎓 Please teach me a lesson about ${topic}`);
                        setShowLessonPicker(false);
                      }}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
                <div className="custom-topic">
                  <input
                    type="text"
                    placeholder="Or type your own topic..."
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customTopic.trim()) {
                        sendMessage(`🎓 Please teach me a lesson about ${customTopic.trim()}`);
                        setCustomTopic('');
                        setShowLessonPicker(false);
                      }
                    }}
                  />
                  <button
                    className="topic-submit-btn"
                    onClick={() => {
                      if (customTopic.trim()) {
                        sendMessage(`🎓 Please teach me a lesson about ${customTopic.trim()}`);
                        setCustomTopic('');
                        setShowLessonPicker(false);
                      }
                    }}
                    disabled={!customTopic.trim()}
                  >
                    Start Lesson
                  </button>
                </div>
                <button
                  className="back-link"
                  onClick={() => setShowLessonPicker(false)}
                >
                  ← Back to options
                </button>
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              {msg.image && (
                <div className="message-image">
                  <img src={msg.image} alt="Uploaded content" />
                </div>
              )}
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
        {imagePreview && (
          <div className="image-preview-container">
            <img src={imagePreview} alt="Preview" className="image-preview" />
            <button
              type="button"
              className="clear-image-btn"
              onClick={clearImage}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="chat-input-wrapper">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="image-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Upload an image"
          >
            <Image size={20} />
          </button>
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedImage ? "Add a message about the image..." : "Type your question here..."}
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="send-btn"
            disabled={(!input.trim() && !selectedImage) || isLoading}
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}

export default ChatRoom;
