import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send, Calculator, BookOpen, FlaskConical, Globe, Landmark, Languages, Image, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// UK National Curriculum topics by subject and year
const curriculumTopics = {
  maths: {
    name: 'Maths',
    sensei: 'Sensei Nova',
    emoji: '⚡',
    icon: Calculator,
    years: {
      7: ['Number operations', 'Fractions & decimals', 'Ratio & proportion', 'Algebra basics', 'Geometry', 'Statistics'],
      8: ['Algebra expressions', 'Linear equations', 'Angles & shapes', 'Area & perimeter', 'Probability', 'Data handling'],
      9: ['Indices & standard form', 'Linear graphs', 'Pythagoras\' theorem', 'Transformations', 'Constructions', 'Scatter graphs'],
      10: ['Quadratics', 'Simultaneous equations', 'Trigonometry', 'Circle theorems', 'Vectors', 'Compound measures'],
      11: ['Algebraic fractions', 'Surds', 'Advanced trigonometry', 'Iteration', 'Functions', 'Proof'],
    },
    starters: [
      "I need help with my maths homework",
      "📝 Review my marked homework",
      "🎓 Teach me a topic...",
    ],
  },
  english: {
    name: 'English',
    sensei: 'Sensei Lyra',
    emoji: '📖',
    icon: BookOpen,
    years: {
      7: ['Reading comprehension', 'Descriptive writing', 'Poetry analysis', 'Grammar & punctuation', 'Spelling', 'Speaking & listening'],
      8: ['Narrative writing', 'Persuasive writing', 'Shakespeare introduction', 'Media texts', 'Inference skills', 'Vocabulary building'],
      9: ['Essay structure', 'Character analysis', 'Theme analysis', 'Rhetoric techniques', 'Comparative writing', 'Language devices'],
      10: ['GCSE Literature texts', 'Unseen poetry', 'Transactional writing', 'Analytical writing', 'Quotation integration', 'Context'],
      11: ['Exam technique', 'A Christmas Carol', 'Macbeth', 'Power & Conflict poetry', 'Language Paper skills', 'Revision'],
    },
    starters: [
      "I need help with an essay",
      "📝 Review my marked homework",
      "🎓 Teach me a topic...",
    ],
  },
  science: {
    name: 'Science',
    sensei: 'Sensei Phoenix',
    emoji: '🔬',
    icon: FlaskConical,
    years: {
      7: ['Cells & organisms', 'Particles & matter', 'Forces & motion', 'Energy', 'Atoms & elements', 'Reproduction'],
      8: ['Photosynthesis', 'Respiration', 'Chemical reactions', 'Light & sound', 'Earth & space', 'Health'],
      9: ['Inheritance', 'Periodic table', 'Electricity', 'Waves', 'Ecosystems', 'Acids & alkalis'],
      10: ['Cell biology', 'Organisation', 'Atomic structure', 'Bonding', 'Energy changes', 'Electricity & circuits'],
      11: ['Homeostasis', 'Inheritance & variation', 'Organic chemistry', 'Rates of reaction', 'Forces', 'Magnetism & EM'],
    },
    starters: [
      "Help me understand a science concept",
      "📝 Review my marked homework",
      "🎓 Teach me a topic...",
    ],
  },
  geography: {
    name: 'Geography',
    sensei: 'Sensei Terra',
    emoji: '🌍',
    icon: Globe,
    years: {
      7: ['Map skills', 'Weather & climate', 'Rivers', 'Settlements', 'The UK', 'Africa'],
      8: ['Ecosystems', 'Population', 'Urbanisation', 'Natural hazards', 'Development', 'Russia'],
      9: ['Climate change', 'Resource management', 'Coasts', 'Global cities', 'Migration', 'The Middle East'],
      10: ['The Living World', 'Physical landscapes UK', 'Urban issues', 'The changing economy', 'Fieldwork', 'Issue evaluation'],
      11: ['Resource management', 'The challenge of natural hazards', 'Pre-release material', 'Decision making', 'Case studies', 'Exam skills'],
    },
    starters: [
      "Help me with geography homework",
      "📝 Review my marked homework",
      "🎓 Teach me a topic...",
    ],
  },
  history: {
    name: 'History',
    sensei: 'Sensei Chronos',
    emoji: '🏛️',
    icon: Landmark,
    years: {
      7: ['Norman Conquest', 'Medieval England', 'The Black Death', 'Magna Carta', 'The Crusades', 'Medieval monarchy'],
      8: ['The Tudors', 'English Civil War', 'The Slave Trade', 'Industrial Revolution', 'British Empire', 'Victorian Britain'],
      9: ['World War I', 'Rise of dictators', 'World War II', 'The Holocaust', 'Cold War', 'Civil Rights'],
      10: ['Medicine through time', 'Crime & punishment', 'Weimar & Nazi Germany', 'Elizabeth I', 'The American West', 'Source analysis'],
      11: ['Superpower relations', 'British depth study', 'Historic environment', 'Interpretation skills', 'Essay writing', 'Exam technique'],
    },
    starters: [
      "Help me understand a historical event",
      "📝 Review my marked homework",
      "🎓 Teach me a topic...",
    ],
  },
  french: {
    name: 'French',
    sensei: 'Sensei Lumière',
    emoji: '🇫🇷',
    icon: Languages,
    years: {
      7: ['Greetings & introductions', 'Numbers & dates', 'Family & pets', 'School subjects', 'Hobbies', 'Food & drink'],
      8: ['Daily routine', 'House & home', 'Town & directions', 'Clothes & shopping', 'Weather', 'Holidays'],
      9: ['Past tense (passé composé)', 'Future tense', 'Opinions & reasons', 'Technology', 'Health & fitness', 'Environment'],
      10: ['Complex opinions', 'Imperfect tense', 'Social issues', 'Work experience', 'Education systems', 'Speaking practice'],
      11: ['All tenses revision', 'Writing skills', 'Listening strategies', 'Reading comprehension', 'Translation', 'Exam preparation'],
    },
    starters: [
      "Help me with French vocabulary",
      "📝 Review my marked homework",
      "🎓 Teach me a topic...",
    ],
  },
  spanish: {
    name: 'Spanish',
    sensei: 'Sensei Sol',
    emoji: '🇪🇸',
    icon: Languages,
    years: {
      7: ['Greetings & introductions', 'Numbers & dates', 'Family & pets', 'School life', 'Free time', 'Food & mealtimes'],
      8: ['Daily routine', 'House & rooms', 'Town & places', 'Clothes & fashion', 'Weather & seasons', 'Holidays'],
      9: ['Preterite tense', 'Future plans', 'Giving opinions', 'Technology & media', 'Health & lifestyle', 'Environment'],
      10: ['Complex structures', 'Imperfect tense', 'Social issues', 'World of work', 'Travel & tourism', 'Speaking skills'],
      11: ['All tenses revision', 'Writing coursework', 'Listening practice', 'Reading strategies', 'Translation skills', 'Final revision'],
    },
    starters: [
      "Help me with Spanish vocabulary",
      "📝 Review my marked homework",
      "🎓 Teach me a topic...",
    ],
  },
};

function ChatRoom() {
  const { subject } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentChild } = useAuth();
  const year = parseInt(currentChild?.year_group || searchParams.get('year') || '9');

  const config = curriculumTopics[subject] || curriculumTopics.maths;
  const yearTopics = config.years[year] || config.years[9];

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showLessonPicker, setShowLessonPicker] = useState(false);
  const [showCurriculum, setShowCurriculum] = useState(false);
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
      if (file.size > 5 * 1024 * 1024) {
        alert('Image is too large. Please choose an image under 5MB.');
        return;
      }

      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }

      setSelectedImage(file);

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

    const userMessage = {
      role: 'user',
      content: text || 'Can you help me with this?',
      image: imagePreview
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

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

    clearImage();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentChild && { 'X-Child-Id': currentChild.id }),
        },
        credentials: 'include',
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
          <h1>{config.emoji} {config.sensei}</h1>
          <p>Year {year} • {config.name}</p>
        </div>
      </header>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <div className={`welcome-avatar ${subject}`}>
              {config.emoji}
            </div>
            <h2>Hey! I'm {config.sensei}!</h2>
            <p>
              I'm your {config.name} guide — here to help you learn, not just give answers!
              Tell me what you're working on and we'll conquer it together! 💪
            </p>
            <p className="image-hint">
              📷 Upload photos of homework, textbooks, or worksheets for help!
            </p>

            {/* Curriculum Topics Section */}
            <button
              className="curriculum-toggle"
              onClick={() => setShowCurriculum(!showCurriculum)}
            >
              📚 Year {year} Curriculum Topics
              {showCurriculum ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showCurriculum && (
              <div className="curriculum-topics">
                <div className="topic-chips">
                  {yearTopics.map((topic, idx) => (
                    <button
                      key={idx}
                      className="curriculum-chip"
                      onClick={() => {
                        sendMessage(`🎓 Please teach me about ${topic}`);
                        setShowCurriculum(false);
                      }}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!showLessonPicker ? (
              <div className="starter-questions">
                {config.starters.map((starter, idx) => (
                  <button
                    key={idx}
                    className="starter-btn"
                    onClick={() => {
                      if (starter.includes('Teach me')) {
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
                <h3>What would you like to learn?</h3>
                <div className="lesson-topics">
                  {yearTopics.slice(0, 6).map((topic, idx) => (
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
                    placeholder="Or type any topic..."
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
                    Go!
                  </button>
                </div>
                <button
                  className="back-link"
                  onClick={() => setShowLessonPicker(false)}
                >
                  ← Back
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
            placeholder={selectedImage ? "Add a message about the image..." : "Ask me anything..."}
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
