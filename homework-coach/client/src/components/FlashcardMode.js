import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, ThumbsUp, ThumbsDown, Shuffle } from 'lucide-react';

const flashcardSets = {
  french: {
    greetings: [
      { front: 'Bonjour', back: 'Hello / Good day' },
      { front: 'Bonsoir', back: 'Good evening' },
      { front: 'Salut', back: 'Hi (informal)' },
      { front: 'Au revoir', back: 'Goodbye' },
      { front: 'À bientôt', back: 'See you soon' },
      { front: 'Comment ça va?', back: 'How are you?' },
      { front: 'Ça va bien', back: "I'm fine" },
      { front: 'Merci', back: 'Thank you' },
      { front: "S'il vous plaît", back: 'Please (formal)' },
      { front: 'Excusez-moi', back: 'Excuse me' },
    ],
    numbers: [
      { front: 'un', back: 'one (1)' },
      { front: 'deux', back: 'two (2)' },
      { front: 'trois', back: 'three (3)' },
      { front: 'quatre', back: 'four (4)' },
      { front: 'cinq', back: 'five (5)' },
      { front: 'dix', back: 'ten (10)' },
      { front: 'vingt', back: 'twenty (20)' },
      { front: 'cinquante', back: 'fifty (50)' },
      { front: 'cent', back: 'one hundred (100)' },
      { front: 'mille', back: 'one thousand (1000)' },
    ],
    food: [
      { front: 'le pain', back: 'bread' },
      { front: 'le fromage', back: 'cheese' },
      { front: 'la pomme', back: 'apple' },
      { front: 'le poulet', back: 'chicken' },
      { front: "l'eau", back: 'water' },
      { front: 'le café', back: 'coffee' },
      { front: 'le gâteau', back: 'cake' },
      { front: 'les légumes', back: 'vegetables' },
      { front: 'la viande', back: 'meat' },
      { front: 'le poisson', back: 'fish' },
    ],
    family: [
      { front: 'la mère', back: 'mother' },
      { front: 'le père', back: 'father' },
      { front: 'la sœur', back: 'sister' },
      { front: 'le frère', back: 'brother' },
      { front: 'les parents', back: 'parents' },
      { front: 'les grands-parents', back: 'grandparents' },
      { front: 'la tante', back: 'aunt' },
      { front: "l'oncle", back: 'uncle' },
      { front: 'le cousin', back: 'cousin (male)' },
      { front: 'la cousine', back: 'cousin (female)' },
    ],
    verbs: [
      { front: 'être', back: 'to be' },
      { front: 'avoir', back: 'to have' },
      { front: 'aller', back: 'to go' },
      { front: 'faire', back: 'to do/make' },
      { front: 'manger', back: 'to eat' },
      { front: 'boire', back: 'to drink' },
      { front: 'parler', back: 'to speak' },
      { front: 'écouter', back: 'to listen' },
      { front: 'regarder', back: 'to watch' },
      { front: 'aimer', back: 'to like/love' },
    ],
  },
  spanish: {
    greetings: [
      { front: 'Hola', back: 'Hello' },
      { front: 'Buenos días', back: 'Good morning' },
      { front: 'Buenas tardes', back: 'Good afternoon' },
      { front: 'Buenas noches', back: 'Good night' },
      { front: 'Adiós', back: 'Goodbye' },
      { front: '¿Cómo estás?', back: 'How are you?' },
      { front: 'Muy bien', back: 'Very well' },
      { front: 'Gracias', back: 'Thank you' },
      { front: 'Por favor', back: 'Please' },
      { front: 'Perdón', back: 'Sorry / Excuse me' },
    ],
    numbers: [
      { front: 'uno', back: 'one (1)' },
      { front: 'dos', back: 'two (2)' },
      { front: 'tres', back: 'three (3)' },
      { front: 'cuatro', back: 'four (4)' },
      { front: 'cinco', back: 'five (5)' },
      { front: 'diez', back: 'ten (10)' },
      { front: 'veinte', back: 'twenty (20)' },
      { front: 'cincuenta', back: 'fifty (50)' },
      { front: 'cien', back: 'one hundred (100)' },
      { front: 'mil', back: 'one thousand (1000)' },
    ],
    food: [
      { front: 'el pan', back: 'bread' },
      { front: 'el queso', back: 'cheese' },
      { front: 'la manzana', back: 'apple' },
      { front: 'el pollo', back: 'chicken' },
      { front: 'el agua', back: 'water' },
      { front: 'el café', back: 'coffee' },
      { front: 'el pastel', back: 'cake' },
      { front: 'las verduras', back: 'vegetables' },
      { front: 'la carne', back: 'meat' },
      { front: 'el pescado', back: 'fish' },
    ],
    family: [
      { front: 'la madre', back: 'mother' },
      { front: 'el padre', back: 'father' },
      { front: 'la hermana', back: 'sister' },
      { front: 'el hermano', back: 'brother' },
      { front: 'los padres', back: 'parents' },
      { front: 'los abuelos', back: 'grandparents' },
      { front: 'la tía', back: 'aunt' },
      { front: 'el tío', back: 'uncle' },
      { front: 'el primo', back: 'cousin (male)' },
      { front: 'la prima', back: 'cousin (female)' },
    ],
    verbs: [
      { front: 'ser', back: 'to be (permanent)' },
      { front: 'estar', back: 'to be (temporary)' },
      { front: 'tener', back: 'to have' },
      { front: 'ir', back: 'to go' },
      { front: 'hacer', back: 'to do/make' },
      { front: 'comer', back: 'to eat' },
      { front: 'beber', back: 'to drink' },
      { front: 'hablar', back: 'to speak' },
      { front: 'escuchar', back: 'to listen' },
      { front: 'mirar', back: 'to watch' },
    ],
  },
};

function FlashcardMode() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState('french');
  const [category, setCategory] = useState('');
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState([]);
  const [learningCards, setLearningCards] = useState([]);
  const [sessionComplete, setSessionComplete] = useState(false);

  const startSession = () => {
    if (!category) return;
    const selectedCards = [...flashcardSets[language][category]];
    // Shuffle cards
    for (let i = selectedCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [selectedCards[i], selectedCards[j]] = [selectedCards[j], selectedCards[i]];
    }
    setCards(selectedCards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnownCards([]);
    setLearningCards([]);
    setSessionComplete(false);
  };

  const handleKnown = () => {
    setKnownCards([...knownCards, cards[currentIndex]]);
    nextCard();
  };

  const handleLearning = () => {
    setLearningCards([...learningCards, cards[currentIndex]]);
    nextCard();
  };

  const nextCard = () => {
    setIsFlipped(false);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setSessionComplete(true);
    }
  };

  const shuffleCards = () => {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const practiceAgain = () => {
    if (learningCards.length > 0) {
      const shuffled = [...learningCards];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      setCards(shuffled);
      setCurrentIndex(0);
      setIsFlipped(false);
      setKnownCards([]);
      setLearningCards([]);
      setSessionComplete(false);
    }
  };

  if (sessionComplete) {
    const totalCards = knownCards.length + learningCards.length;
    const percentage = Math.round((knownCards.length / totalCards) * 100);

    return (
      <div className="flashcard-mode">
        <header className="flashcard-header">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={24} />
          </button>
          <h1>Session Complete!</h1>
        </header>

        <div className="session-results">
          <div className="results-summary">
            <div className="result-stat known">
              <ThumbsUp size={32} />
              <span className="stat-number">{knownCards.length}</span>
              <span className="stat-label">Got it!</span>
            </div>
            <div className="result-stat learning">
              <RotateCcw size={32} />
              <span className="stat-number">{learningCards.length}</span>
              <span className="stat-label">Still learning</span>
            </div>
          </div>

          <div className="results-message">
            {percentage >= 80 ? (
              <p>🌟 Brilliant! You're really getting the hang of this!</p>
            ) : percentage >= 50 ? (
              <p>👍 Good progress! Keep practising the tricky ones.</p>
            ) : (
              <p>💪 Keep going! Repetition is the key to memory.</p>
            )}
          </div>

          {learningCards.length > 0 && (
            <div className="learning-list">
              <h3>Cards to review:</h3>
              <div className="review-cards">
                {learningCards.map((card, idx) => (
                  <div key={idx} className="review-card-item">
                    <strong>{card.front}</strong> → {card.back}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="session-actions">
            {learningCards.length > 0 && (
              <button className="action-btn primary" onClick={practiceAgain}>
                Practice Tricky Ones Again
              </button>
            )}
            <button className="action-btn secondary" onClick={startSession}>
              Restart All Cards
            </button>
            <button className="action-btn secondary" onClick={() => {
              setCards([]);
              setCategory('');
            }}>
              Choose Different Topic
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (cards.length > 0) {
    const card = cards[currentIndex];
    return (
      <div className="flashcard-mode">
        <header className="flashcard-header">
          <button className="back-btn" onClick={() => setCards([])}>
            <ArrowLeft size={24} />
          </button>
          <h1>{language === 'french' ? '🇫🇷' : '🇪🇸'} {category}</h1>
          <div className="card-progress">
            {currentIndex + 1}/{cards.length}
          </div>
        </header>

        <div className="flashcard-container">
          <div
            className={`flashcard ${isFlipped ? 'flipped' : ''}`}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div className="flashcard-inner">
              <div className="flashcard-front">
                <span className="card-label">{language === 'french' ? 'French' : 'Spanish'}</span>
                <span className="card-text">{card.front}</span>
                <span className="tap-hint">Tap to flip</span>
              </div>
              <div className="flashcard-back">
                <span className="card-label">English</span>
                <span className="card-text">{card.back}</span>
                <span className="tap-hint">Tap to flip back</span>
              </div>
            </div>
          </div>

          <div className="flashcard-actions">
            <button className="rating-btn learning" onClick={handleLearning}>
              <RotateCcw size={24} />
              Still Learning
            </button>
            <button className="rating-btn known" onClick={handleKnown}>
              <ThumbsUp size={24} />
              Got It!
            </button>
          </div>

          <button className="shuffle-btn" onClick={shuffleCards}>
            <Shuffle size={16} /> Shuffle
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flashcard-mode">
      <header className="flashcard-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={24} />
        </button>
        <h1>🎴 Flashcards</h1>
      </header>

      <div className="flashcard-setup">
        <div className="setup-card">
          <h2>Practice Vocabulary</h2>
          <p>Swipe through flashcards to build your vocabulary!</p>

          <div className="setup-options">
            <div className="option-group">
              <label>Language</label>
              <div className="language-buttons">
                <button
                  className={`lang-btn ${language === 'french' ? 'active' : ''}`}
                  onClick={() => {
                    setLanguage('french');
                    setCategory('');
                  }}
                >
                  🇫🇷 French
                </button>
                <button
                  className={`lang-btn ${language === 'spanish' ? 'active' : ''}`}
                  onClick={() => {
                    setLanguage('spanish');
                    setCategory('');
                  }}
                >
                  🇪🇸 Spanish
                </button>
              </div>
            </div>

            <div className="option-group">
              <label>Category</label>
              <div className="category-grid">
                {Object.keys(flashcardSets[language]).map((cat) => (
                  <button
                    key={cat}
                    className={`category-btn ${category === cat ? 'active' : ''}`}
                    onClick={() => setCategory(cat)}
                  >
                    {cat}
                    <span className="card-count">{flashcardSets[language][cat].length} cards</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            className="start-btn"
            onClick={startSession}
            disabled={!category}
          >
            Start Practice 🚀
          </button>
        </div>
      </div>
    </div>
  );
}

export default FlashcardMode;
