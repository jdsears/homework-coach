import { Link } from 'react-router-dom';
import {
  Calculator,
  BookOpen,
  FlaskConical,
  Globe,
  Landmark,
  Languages,
  RefreshCw,
} from 'lucide-react';
import ProgressStrip from './ProgressStrip';
import { gradeLabel } from '../api';
import { useFamily } from '../FamilyContext';

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

function SubjectSelect() {
  const { activeChild, selectChild } = useFamily();

  if (!activeChild) return null;

  return (
    <div className="subject-select">
      <header className="header">
        <div className="mascot">🎓</div>
        <h1>Hi {activeChild.name}!</h1>
        <p>Let's learn something awesome today!</p>
        <button className="switch-kid-btn" onClick={() => selectChild(null)}>
          <RefreshCw size={14} /> {gradeLabel(activeChild.grade)} grade · not you?
        </button>
      </header>

      <ProgressStrip />

      <div className="subject-grid">
        {subjects.map(subject => (
          <Link
            key={subject.id}
            to={`/chat/${subject.id}`}
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
