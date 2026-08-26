import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, BookOpen, FlaskConical, Globe, Landmark, Languages } from 'lucide-react';

const subjects = [
  {
    id: 'math',
    name: 'Math',
    description: 'Numbers, fractions, algebra & more',
    coach: 'Coach Mathilda 🧮',
    icon: Calculator,
  },
  {
    id: 'reading',
    name: 'Reading & Writing',
    description: 'Stories, essays & vocabulary',
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

const grades = ['3', '4', '5', '6', '7', '8'];

const ordinal = (grade) => (grade === '3' ? '3rd' : `${grade}th`);

function SubjectSelect() {
  const [selectedGrade, setSelectedGrade] = useState('5');

  return (
    <div className="subject-select">
      <header className="header">
        <div className="mascot">🎓</div>
        <h1>Homework Coach</h1>
        <p>Let's learn something awesome today!</p>
      </header>

      <div className="grade-selector">
        <label>What grade are you in?</label>
        <div className="grade-buttons">
          {grades.map(grade => (
            <button
              key={grade}
              className={`grade-btn ${selectedGrade === grade ? 'active' : ''}`}
              onClick={() => setSelectedGrade(grade)}
            >
              {ordinal(grade)}
            </button>
          ))}
        </div>
      </div>

      <div className="subject-grid">
        {subjects.map(subject => (
          <Link
            key={subject.id}
            to={`/chat/${subject.id}?grade=${selectedGrade}`}
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
