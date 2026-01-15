import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const subjectTopics = {
  maths: ['fractions', 'algebra', 'percentages', 'Pythagoras', 'ratios', 'equations'],
  english: ['grammar', 'vocabulary', 'literary devices', 'Shakespeare', 'essay writing'],
  physics: ['forces', 'energy', 'electricity', 'waves', 'motion', 'magnetism'],
  chemistry: ['atoms', 'elements', 'reactions', 'acids & alkalis', 'bonding', 'periodic table'],
  biology: ['cells', 'ecosystems', 'respiration', 'photosynthesis', 'inheritance', 'evolution'],
  geography: ['rivers', 'volcanoes', 'climate', 'population', 'maps', 'tectonics'],
  history: ['the Tudors', 'World War II', 'Industrial Revolution', 'Roman Empire', 'Medieval England'],
  french: ['greetings', 'numbers', 'food vocabulary', 'family', 'past tense', 'opinions'],
  spanish: ['greetings', 'numbers', 'food vocabulary', 'family', 'past tense', 'opinions'],
};

function QuizMode() {
  const navigate = useNavigate();
  const { currentChild } = useAuth();
  const [subject, setSubject] = useState('maths');
  const [topic, setTopic] = useState('');
  const year = currentChild?.year_group || 9;
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const startQuiz = async () => {
    if (!topic) return;
    setIsLoading(true);

    try {
      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentChild && { 'X-Child-Id': currentChild.id }),
        },
        credentials: 'include',
        body: JSON.stringify({ subject, topic, year }),
      });
      const data = await response.json();
      setQuiz(data.quiz);
      setCurrentQuestion(0);
      setAnswers([]);
      setShowResults(false);
    } catch (error) {
      console.error('Error starting quiz:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (answerIndex) => {
    if (showFeedback) return;

    setSelectedAnswer(answerIndex);
    setShowFeedback(true);

    const isCorrect = answerIndex === quiz.questions[currentQuestion].correctAnswer;
    setAnswers([...answers, {
      question: currentQuestion,
      selected: answerIndex,
      correct: isCorrect
    }]);
  };

  const nextQuestion = () => {
    setSelectedAnswer(null);
    setShowFeedback(false);

    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setShowResults(true);
      // Save quiz result
      saveQuizResult();
    }
  };

  const saveQuizResult = async () => {
    const score = answers.filter(a => a.correct).length;
    try {
      await fetch('/api/quiz/result', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentChild && { 'X-Child-Id': currentChild.id }),
        },
        credentials: 'include',
        body: JSON.stringify({
          subject,
          topic,
          year,
          score,
          total: quiz.questions.length,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Error saving quiz result:', error);
    }
  };

  const score = answers.filter(a => a.correct).length;
  const percentage = quiz ? Math.round((score / quiz.questions.length) * 100) : 0;

  const getScoreMessage = () => {
    if (percentage >= 80) return { emoji: '🌟', message: "Brilliant! You've really mastered this!" };
    if (percentage >= 60) return { emoji: '👍', message: "Good job! A bit more practice and you'll ace it!" };
    if (percentage >= 40) return { emoji: '💪', message: "Nice effort! Let's review the tricky bits." };
    return { emoji: '📚', message: "Keep going! Every mistake is a chance to learn." };
  };

  if (showResults && quiz) {
    const { emoji, message } = getScoreMessage();
    return (
      <div className="quiz-mode">
        <header className="quiz-header">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={24} />
          </button>
          <h1>Quiz Results</h1>
        </header>

        <div className="quiz-results">
          <div className="score-circle">
            <Trophy size={48} />
            <div className="score-text">{score}/{quiz.questions.length}</div>
            <div className="score-percent">{percentage}%</div>
          </div>

          <div className="score-message">
            <span className="score-emoji">{emoji}</span>
            <p>{message}</p>
          </div>

          <div className="results-breakdown">
            <h3>Question Breakdown</h3>
            {quiz.questions.map((q, idx) => (
              <div key={idx} className={`result-item ${answers[idx]?.correct ? 'correct' : 'incorrect'}`}>
                {answers[idx]?.correct ? (
                  <CheckCircle size={20} className="result-icon correct" />
                ) : (
                  <XCircle size={20} className="result-icon incorrect" />
                )}
                <span>Q{idx + 1}: {q.question.substring(0, 50)}...</span>
              </div>
            ))}
          </div>

          {percentage < 80 && (
            <div className="revision-tip">
              <h3>💡 Revision Tip</h3>
              <p>Try a lesson on <strong>{topic}</strong> to strengthen your understanding, then take the quiz again!</p>
            </div>
          )}

          <div className="results-actions">
            <button className="quiz-btn secondary" onClick={() => {
              setQuiz(null);
              setTopic('');
            }}>
              Try Another Topic
            </button>
            <button className="quiz-btn primary" onClick={() => {
              setShowResults(false);
              setCurrentQuestion(0);
              setAnswers([]);
              startQuiz();
            }}>
              Retry This Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (quiz) {
    const question = quiz.questions[currentQuestion];
    return (
      <div className="quiz-mode">
        <header className="quiz-header">
          <button className="back-btn" onClick={() => setQuiz(null)}>
            <ArrowLeft size={24} />
          </button>
          <h1>{topic} Quiz</h1>
          <div className="quiz-progress">
            {currentQuestion + 1}/{quiz.questions.length}
          </div>
        </header>

        <div className="quiz-card">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
            />
          </div>

          <div className="question-container">
            <h2 className="question-text">{question.question}</h2>

            <div className="answers-grid">
              {question.options.map((option, idx) => (
                <button
                  key={idx}
                  className={`answer-btn ${
                    showFeedback
                      ? idx === question.correctAnswer
                        ? 'correct'
                        : idx === selectedAnswer
                        ? 'incorrect'
                        : ''
                      : selectedAnswer === idx
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => handleAnswer(idx)}
                  disabled={showFeedback}
                >
                  <span className="answer-letter">{String.fromCharCode(65 + idx)}</span>
                  <span className="answer-text">{option}</span>
                </button>
              ))}
            </div>

            {showFeedback && (
              <div className={`feedback ${answers[answers.length - 1]?.correct ? 'correct' : 'incorrect'}`}>
                {answers[answers.length - 1]?.correct ? (
                  <>
                    <CheckCircle size={24} />
                    <span>Correct! Well done! 🎉</span>
                  </>
                ) : (
                  <>
                    <XCircle size={24} />
                    <span>Not quite. The answer was: {question.options[question.correctAnswer]}</span>
                  </>
                )}
              </div>
            )}

            {showFeedback && (
              <button className="next-btn" onClick={nextQuestion}>
                {currentQuestion < quiz.questions.length - 1 ? 'Next Question →' : 'See Results'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-mode">
      <header className="quiz-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={24} />
        </button>
        <h1>📝 Quiz Time!</h1>
      </header>

      <div className="quiz-setup">
        <div className="setup-card">
          <Sparkles size={48} className="setup-icon" />
          <h2>Test Your Knowledge</h2>
          <p>Choose a subject and topic to start a quick quiz!</p>

          <div className="setup-options">
            <div className="option-group">
              <label>Subject</label>
              <select value={subject} onChange={(e) => {
                setSubject(e.target.value);
                setTopic('');
              }}>
                <option value="maths">Maths</option>
                <option value="english">English</option>
                <option value="science">Science</option>
                <option value="geography">Geography</option>
                <option value="history">History</option>
                <option value="french">French</option>
                <option value="spanish">Spanish</option>
              </select>
            </div>

            <div className="option-group">
              <label>Topic</label>
              <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="">Select a topic...</option>
                {subjectTopics[subject].map((t, idx) => (
                  <option key={idx} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="option-group">
              <label>Year</label>
              <select value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="7">Year 7</option>
                <option value="8">Year 8</option>
                <option value="9">Year 9</option>
                <option value="10">Year 10</option>
                <option value="11">Year 11</option>
              </select>
            </div>
          </div>

          <button
            className="start-quiz-btn"
            onClick={startQuiz}
            disabled={!topic || isLoading}
          >
            {isLoading ? 'Creating Quiz...' : 'Start Quiz 🚀'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuizMode;
