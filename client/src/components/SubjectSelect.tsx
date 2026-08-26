import { Link } from 'react-router-dom';
import {
  Calculator,
  BookOpen,
  FlaskConical,
  Globe,
  Landmark,
  Languages,
  RefreshCw,
  Sigma,
  type LucideIcon,
} from 'lucide-react';
import { useFamily } from '../FamilyContext';
import { useI18n, useGradeLabel, useSubjectName } from '../i18n';
import ProgressStrip from './ProgressStrip';

interface SubjectMeta {
  id: string;
  coach: string;
  emoji: string;
  icon: LucideIcon;
  ukOnly?: boolean;
  badgeKey?: string;
}

const SUBJECTS: SubjectMeta[] = [
  { id: 'math', coach: 'Coach Mathilda', emoji: '🧮', icon: Calculator },
  { id: 'reading', coach: 'Coach Riley', emoji: '📖', icon: BookOpen },
  { id: 'science', coach: 'Coach Newton', emoji: '🔬', icon: FlaskConical },
  { id: 'geography', coach: 'Coach Atlas', emoji: '🌍', icon: Globe },
  { id: 'history', coach: 'Coach Clio', emoji: '🏛️', icon: Landmark },
  { id: 'french', coach: 'Coach Amélie', emoji: '🇫🇷', icon: Languages },
  { id: 'spanish', coach: 'Coach Diego', emoji: '🇪🇸', icon: Languages },
  {
    id: 'furthermaths',
    coach: 'Coach Ada',
    emoji: '📐',
    icon: Sigma,
    ukOnly: true,
    badgeKey: 'subject.furthermaths.badge',
  },
];

function SubjectSelect() {
  const { family, activeChild, selectChild, personas } = useFamily();
  const { t } = useI18n();
  const gradeLabel = useGradeLabel();
  const subjectName = useSubjectName();

  if (!activeChild) return null;

  const visibleSubjects = SUBJECTS.filter(
    subject => !subject.ukOnly || family?.curriculum === 'uk'
  );

  return (
    <div className="subject-select">
      <header className="header">
        <div className="mascot">🎓</div>
        <h1>{t('home.hi', { name: activeChild.name })}</h1>
        <p>{t('home.tagline')}</p>
        <button className="switch-kid-btn" onClick={() => selectChild(null)}>
          <RefreshCw size={14} /> {t('home.switchKid', { grade: gradeLabel(activeChild.grade) })}
        </button>
      </header>

      <ProgressStrip />

      <div className="subject-grid">
        {visibleSubjects.map(subject => (
          <Link
            key={subject.id}
            to={`/chat/${subject.id}`}
            className={`subject-card ${subject.id}`}
          >
            <div className="subject-icon">
              <subject.icon size={32} />
            </div>
            <div className="subject-info">
              <h2>
                {subjectName(subject.id)}
                {subject.badgeKey && <span className="gcse-badge">{t(subject.badgeKey)}</span>}
              </h2>
              <p>{t(`subject.${subject.id}.description`)}</p>
              <div className="coach-name">
                {subject.coach} {subject.emoji}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {personas.length > 0 && (
        <>
          <h2 className="custom-coach-heading">{t('home.customCoaches')}</h2>
          <div className="subject-grid">
            {personas.map(persona => (
              <Link key={persona.id} to={`/chat/p:${persona.id}`} className="subject-card custom">
                <div className="subject-icon persona-icon">{persona.emoji}</div>
                <div className="subject-info">
                  <h2>{persona.name}</h2>
                  <p>{persona.description}</p>
                  <div className="coach-name">{t('home.customCoachBy')}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default SubjectSelect;
