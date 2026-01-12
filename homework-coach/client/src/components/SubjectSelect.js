import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, BookOpen, FlaskConical, Globe, Landmark, Languages } from 'lucide-react';

const subjects = [
  {
    id: 'maths',
    name: 'Maths',
    description: 'Numbers, fractions, algebra & more',
    coach: 'Coach Mathilda 🧮',
    icon: Calculator,
  },
  {
    id: 'english',
    name: 'English',
    description: 'Reading, writing & vocabulary',
    coach: 'Coach Riley 📖',
    icon: BookOpen,
  },
  {
    id: 'science',
    name: 'Science',
    description: 'Discover how the world works',
    coach: 'Coach Newton 🔬',
    icon: FlaskConical,
  },
  {
    id: 'geography',
    name: 'Geography',
    description: 'Explore places around the world',
    coach: 'Coach Atlas 🌍',
    icon: Globe,
  },
  {
    id: 'history',
    name: 'History',
    description: 'Stories from the past',
    coach: 'Coach Clio 🏛️',
    icon: Landmark,
  },
  {
    id: 'french',
    name: 'French',
    description: 'Bonjour! Learn to speak French',
    coach: 'Coach Amélie 🇫🇷',
    icon: Languages,
  },
  {
    id: 'spanish',
    name: 'Spanish',
    description: '¡Hola! Learn to speak Spanish',
    coach: 'Coach Diego 🇪🇸',
    icon: Languages,
  },
];

const years = ['7', '8', '9', '10', '11'];

function SubjectSelect() {
  const [selectedYear, setSelectedYear] = useState('9');

  return (
    <div className="subject-select">
      <header className="header">
        <div className="mascot">🎓</div>
        <h1>Homework Coach</h1>
        <p>Let's learn something awesome today!</p>
      </header>

      <div className="grade-selector">
        <label>What year are you in?</label>
        <div className="grade-buttons">
          {years.map(year => (
            <button
              key={year}
              className={`grade-btn ${selectedYear === year ? 'active' : ''}`}
              onClick={() => setSelectedYear(year)}
            >
              Year {year}
            </button>
          ))}
        </div>
      </div>

      <div className="subject-grid">
        {subjects.map(subject => (
          <Link
            key={subject.id}
            to={`/chat/${subject.id}?year=${selectedYear}`}
            className={`subject-card ${subject.id}`}
          >
            <div className="subject-icon">
              <subject.icon size={32} />
            </div>
            <div className="subject-info">
              <h2>{subject.name}</h2>
              <p>{subject.description}</p>
              <div className="coach-name">{subject.coach}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default SubjectSelect;
