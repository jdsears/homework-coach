import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, BookOpen, FlaskConical, Globe, Landmark, Languages } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const subjects = [
  {
    id: 'maths',
    name: 'Maths',
    description: 'Numbers, algebra & problem solving',
    coach: 'Sensei Nova ⚡',
    icon: Calculator,
  },
  {
    id: 'english',
    name: 'English',
    description: 'Master words & storytelling',
    coach: 'Sensei Lyra 📖',
    icon: BookOpen,
  },
  {
    id: 'science',
    name: 'Science',
    description: 'Unlock the secrets of the universe',
    coach: 'Sensei Phoenix 🔬',
    icon: FlaskConical,
  },
  {
    id: 'geography',
    name: 'Geography',
    description: 'Explore epic lands & places',
    coach: 'Sensei Terra 🌍',
    icon: Globe,
  },
  {
    id: 'history',
    name: 'History',
    description: 'Epic tales from the past',
    coach: 'Sensei Chronos 🏛️',
    icon: Landmark,
  },
  {
    id: 'french',
    name: 'French',
    description: 'Bonjour! Unlock a new language',
    coach: 'Sensei Lumière 🇫🇷',
    icon: Languages,
  },
  {
    id: 'spanish',
    name: 'Spanish',
    description: '¡Hola! Speak like a champion',
    coach: 'Sensei Sol 🇪🇸',
    icon: Languages,
  },
];

function SubjectSelect() {
  const { currentChild } = useAuth();
  const year = currentChild?.year_group || 9;

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="subject-select">
      <header className="header">
        <div className="mascot">⚡</div>
        <h1>Hey {currentChild?.name || 'Hero'}!</h1>
        <p>Year {year} Champion • Choose Your Quest!</p>
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
