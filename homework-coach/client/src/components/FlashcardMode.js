import React, { useState, useEffect } from 'react';
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
      { front: 'De rien', back: "You're welcome" },
      { front: 'Enchanté(e)', back: 'Nice to meet you' },
    ],
    numbers: [
      { front: 'un', back: 'one (1)' },
      { front: 'deux', back: 'two (2)' },
      { front: 'trois', back: 'three (3)' },
      { front: 'quatre', back: 'four (4)' },
      { front: 'cinq', back: 'five (5)' },
      { front: 'six', back: 'six (6)' },
      { front: 'sept', back: 'seven (7)' },
      { front: 'huit', back: 'eight (8)' },
      { front: 'neuf', back: 'nine (9)' },
      { front: 'dix', back: 'ten (10)' },
      { front: 'onze', back: 'eleven (11)' },
      { front: 'douze', back: 'twelve (12)' },
      { front: 'vingt', back: 'twenty (20)' },
      { front: 'trente', back: 'thirty (30)' },
      { front: 'cinquante', back: 'fifty (50)' },
      { front: 'cent', back: 'one hundred (100)' },
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
      { front: 'le riz', back: 'rice' },
      { front: 'les pâtes', back: 'pasta' },
      { front: 'la glace', back: 'ice cream' },
      { front: 'le chocolat', back: 'chocolate' },
    ],
    family: [
      { front: 'la mère', back: 'mother' },
      { front: 'le père', back: 'father' },
      { front: 'la sœur', back: 'sister' },
      { front: 'le frère', back: 'brother' },
      { front: 'les parents', back: 'parents' },
      { front: 'les grands-parents', back: 'grandparents' },
      { front: 'la grand-mère', back: 'grandmother' },
      { front: 'le grand-père', back: 'grandfather' },
      { front: 'la tante', back: 'aunt' },
      { front: "l'oncle", back: 'uncle' },
      { front: 'le cousin', back: 'cousin (male)' },
      { front: 'la cousine', back: 'cousin (female)' },
      { front: 'le fils', back: 'son' },
      { front: 'la fille', back: 'daughter' },
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
      { front: 'vouloir', back: 'to want' },
      { front: 'pouvoir', back: 'to be able to / can' },
      { front: 'devoir', back: 'to have to / must' },
      { front: 'prendre', back: 'to take' },
      { front: 'venir', back: 'to come' },
      { front: 'voir', back: 'to see' },
    ],
    colours: [
      { front: 'rouge', back: 'red' },
      { front: 'bleu(e)', back: 'blue' },
      { front: 'vert(e)', back: 'green' },
      { front: 'jaune', back: 'yellow' },
      { front: 'orange', back: 'orange' },
      { front: 'violet(te)', back: 'purple' },
      { front: 'rose', back: 'pink' },
      { front: 'noir(e)', back: 'black' },
      { front: 'blanc(he)', back: 'white' },
      { front: 'gris(e)', back: 'grey' },
      { front: 'marron', back: 'brown' },
      { front: 'bleu clair', back: 'light blue' },
    ],
    days: [
      { front: 'lundi', back: 'Monday' },
      { front: 'mardi', back: 'Tuesday' },
      { front: 'mercredi', back: 'Wednesday' },
      { front: 'jeudi', back: 'Thursday' },
      { front: 'vendredi', back: 'Friday' },
      { front: 'samedi', back: 'Saturday' },
      { front: 'dimanche', back: 'Sunday' },
      { front: 'aujourd\'hui', back: 'today' },
      { front: 'demain', back: 'tomorrow' },
      { front: 'hier', back: 'yesterday' },
      { front: 'la semaine', back: 'the week' },
      { front: 'le week-end', back: 'the weekend' },
    ],
    school: [
      { front: 'le collège', back: 'secondary school' },
      { front: 'le professeur', back: 'teacher' },
      { front: 'l\'élève', back: 'student / pupil' },
      { front: 'la classe', back: 'classroom / class' },
      { front: 'le cours', back: 'lesson' },
      { front: 'les devoirs', back: 'homework' },
      { front: 'un stylo', back: 'a pen' },
      { front: 'un crayon', back: 'a pencil' },
      { front: 'un cahier', back: 'an exercise book' },
      { front: 'une règle', back: 'a ruler' },
      { front: 'la récréation', back: 'break time' },
      { front: 'la cantine', back: 'canteen' },
    ],
    weather: [
      { front: 'Il fait beau', back: 'The weather is nice' },
      { front: 'Il fait chaud', back: 'It\'s hot' },
      { front: 'Il fait froid', back: 'It\'s cold' },
      { front: 'Il pleut', back: 'It\'s raining' },
      { front: 'Il neige', back: 'It\'s snowing' },
      { front: 'Il y a du soleil', back: 'It\'s sunny' },
      { front: 'Il y a du vent', back: 'It\'s windy' },
      { front: 'Il y a des nuages', back: 'It\'s cloudy' },
      { front: 'le temps', back: 'the weather' },
      { front: 'le ciel', back: 'the sky' },
    ],
    opinions: [
      { front: 'J\'aime', back: 'I like' },
      { front: 'J\'adore', back: 'I love' },
      { front: 'Je déteste', back: 'I hate' },
      { front: 'Je préfère', back: 'I prefer' },
      { front: 'Je pense que', back: 'I think that' },
      { front: 'À mon avis', back: 'In my opinion' },
      { front: 'C\'est génial', back: 'It\'s great' },
      { front: 'C\'est nul', back: 'It\'s rubbish' },
      { front: 'C\'est intéressant', back: 'It\'s interesting' },
      { front: 'C\'est ennuyeux', back: 'It\'s boring' },
      { front: 'Je suis d\'accord', back: 'I agree' },
      { front: 'Je ne suis pas d\'accord', back: 'I disagree' },
    ],
    time: [
      { front: 'Quelle heure est-il?', back: 'What time is it?' },
      { front: 'Il est une heure', back: 'It\'s one o\'clock' },
      { front: 'Il est midi', back: 'It\'s midday' },
      { front: 'Il est minuit', back: 'It\'s midnight' },
      { front: 'et quart', back: 'quarter past' },
      { front: 'et demie', back: 'half past' },
      { front: 'moins le quart', back: 'quarter to' },
      { front: 'le matin', back: 'the morning' },
      { front: 'l\'après-midi', back: 'the afternoon' },
      { front: 'le soir', back: 'the evening' },
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
      { front: 'De nada', back: "You're welcome" },
      { front: 'Mucho gusto', back: 'Nice to meet you' },
    ],
    numbers: [
      { front: 'uno', back: 'one (1)' },
      { front: 'dos', back: 'two (2)' },
      { front: 'tres', back: 'three (3)' },
      { front: 'cuatro', back: 'four (4)' },
      { front: 'cinco', back: 'five (5)' },
      { front: 'seis', back: 'six (6)' },
      { front: 'siete', back: 'seven (7)' },
      { front: 'ocho', back: 'eight (8)' },
      { front: 'nueve', back: 'nine (9)' },
      { front: 'diez', back: 'ten (10)' },
      { front: 'once', back: 'eleven (11)' },
      { front: 'doce', back: 'twelve (12)' },
      { front: 'veinte', back: 'twenty (20)' },
      { front: 'treinta', back: 'thirty (30)' },
      { front: 'cincuenta', back: 'fifty (50)' },
      { front: 'cien', back: 'one hundred (100)' },
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
      { front: 'el arroz', back: 'rice' },
      { front: 'la pasta', back: 'pasta' },
      { front: 'el helado', back: 'ice cream' },
      { front: 'el chocolate', back: 'chocolate' },
    ],
    family: [
      { front: 'la madre', back: 'mother' },
      { front: 'el padre', back: 'father' },
      { front: 'la hermana', back: 'sister' },
      { front: 'el hermano', back: 'brother' },
      { front: 'los padres', back: 'parents' },
      { front: 'los abuelos', back: 'grandparents' },
      { front: 'la abuela', back: 'grandmother' },
      { front: 'el abuelo', back: 'grandfather' },
      { front: 'la tía', back: 'aunt' },
      { front: 'el tío', back: 'uncle' },
      { front: 'el primo', back: 'cousin (male)' },
      { front: 'la prima', back: 'cousin (female)' },
      { front: 'el hijo', back: 'son' },
      { front: 'la hija', back: 'daughter' },
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
      { front: 'querer', back: 'to want' },
      { front: 'poder', back: 'to be able to / can' },
      { front: 'deber', back: 'to have to / must' },
      { front: 'tomar', back: 'to take' },
      { front: 'venir', back: 'to come' },
      { front: 'ver', back: 'to see' },
    ],
    colours: [
      { front: 'rojo', back: 'red' },
      { front: 'azul', back: 'blue' },
      { front: 'verde', back: 'green' },
      { front: 'amarillo', back: 'yellow' },
      { front: 'naranja', back: 'orange' },
      { front: 'morado', back: 'purple' },
      { front: 'rosa', back: 'pink' },
      { front: 'negro', back: 'black' },
      { front: 'blanco', back: 'white' },
      { front: 'gris', back: 'grey' },
      { front: 'marrón', back: 'brown' },
      { front: 'azul claro', back: 'light blue' },
    ],
    days: [
      { front: 'lunes', back: 'Monday' },
      { front: 'martes', back: 'Tuesday' },
      { front: 'miércoles', back: 'Wednesday' },
      { front: 'jueves', back: 'Thursday' },
      { front: 'viernes', back: 'Friday' },
      { front: 'sábado', back: 'Saturday' },
      { front: 'domingo', back: 'Sunday' },
      { front: 'hoy', back: 'today' },
      { front: 'mañana', back: 'tomorrow' },
      { front: 'ayer', back: 'yesterday' },
      { front: 'la semana', back: 'the week' },
      { front: 'el fin de semana', back: 'the weekend' },
    ],
    school: [
      { front: 'el instituto', back: 'secondary school' },
      { front: 'el profesor', back: 'teacher' },
      { front: 'el alumno', back: 'student / pupil' },
      { front: 'la clase', back: 'classroom / class' },
      { front: 'la lección', back: 'lesson' },
      { front: 'los deberes', back: 'homework' },
      { front: 'un bolígrafo', back: 'a pen' },
      { front: 'un lápiz', back: 'a pencil' },
      { front: 'un cuaderno', back: 'an exercise book' },
      { front: 'una regla', back: 'a ruler' },
      { front: 'el recreo', back: 'break time' },
      { front: 'la cantina', back: 'canteen' },
    ],
    weather: [
      { front: 'Hace buen tiempo', back: 'The weather is nice' },
      { front: 'Hace calor', back: 'It\'s hot' },
      { front: 'Hace frío', back: 'It\'s cold' },
      { front: 'Llueve', back: 'It\'s raining' },
      { front: 'Nieva', back: 'It\'s snowing' },
      { front: 'Hace sol', back: 'It\'s sunny' },
      { front: 'Hace viento', back: 'It\'s windy' },
      { front: 'Está nublado', back: 'It\'s cloudy' },
      { front: 'el tiempo', back: 'the weather' },
      { front: 'el cielo', back: 'the sky' },
    ],
    opinions: [
      { front: 'Me gusta', back: 'I like' },
      { front: 'Me encanta', back: 'I love' },
      { front: 'Odio', back: 'I hate' },
      { front: 'Prefiero', back: 'I prefer' },
      { front: 'Pienso que', back: 'I think that' },
      { front: 'En mi opinión', back: 'In my opinion' },
      { front: 'Es genial', back: 'It\'s great' },
      { front: 'Es horrible', back: 'It\'s horrible' },
      { front: 'Es interesante', back: 'It\'s interesting' },
      { front: 'Es aburrido', back: 'It\'s boring' },
      { front: 'Estoy de acuerdo', back: 'I agree' },
      { front: 'No estoy de acuerdo', back: 'I disagree' },
    ],
    time: [
      { front: '¿Qué hora es?', back: 'What time is it?' },
      { front: 'Es la una', back: 'It\'s one o\'clock' },
      { front: 'Es mediodía', back: 'It\'s midday' },
      { front: 'Es medianoche', back: 'It\'s midnight' },
      { front: 'y cuarto', back: 'quarter past' },
      { front: 'y media', back: 'half past' },
      { front: 'menos cuarto', back: 'quarter to' },
      { front: 'la mañana', back: 'the morning' },
      { front: 'la tarde', back: 'the afternoon' },
      { front: 'la noche', back: 'the evening' },
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

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
