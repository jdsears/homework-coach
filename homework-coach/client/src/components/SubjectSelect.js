import React from 'react';
import { Link } from 'react-router-dom';
import { Calculator, BookOpen, FlaskConical, Globe, Landmark, Languages } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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

function SubjectSelect() {
  const { currentChild } = useAuth();
  const year = currentChild?.year_group || 9;

  return (
    <div className="subject-select">
      <header className="header">
        <div className="mascot">🎓</div>
        <h1>Hi, {currentChild?.name || 'there'}!</h1>
        <p>Year {year} • What would you like to learn today?</p>
      </header>

      <div className="subject-grid">
        {subjects.map(subject => (
          <Link
            key={subject.id}
            to={`/chat/${subject.id}?year=${year}`}
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
