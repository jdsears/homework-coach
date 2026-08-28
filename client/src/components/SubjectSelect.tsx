import { Link } from 'react-router-dom';
import {
  Calculator,
  BookOpen,
  Feather,
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
import { visibleSubjectIds } from '../subjects';
import ProgressStrip from './ProgressStrip';

const SUBJECT_META: Record<string, { coach: string; emoji: string; icon: LucideIcon }> = {
  math: { coach: 'Coach Mathilda', emoji: '🧮', icon: Calculator },
  reading: { coach: 'Coach Riley', emoji: '📖', icon: BookOpen },
  englishlang: { coach: 'Coach Riley', emoji: '📖', icon: BookOpen },
  englishlit: { coach: 'Coach Brontë', emoji: '🎭', icon: Feather },
  science: { coach: 'Coach Newton', emoji: '🔬', icon: FlaskConical },
  geography: { coach: 'Coach Atlas', emoji: '🌍', icon: Globe },
  history: { coach: 'Coach Clio', emoji: '🏛️', icon: Landmark },
  french: { coach: 'Coach Amélie', emoji: '🇫🇷', icon: Languages },
  spanish: { coach: 'Coach Diego', emoji: '🇪🇸', icon: Languages },
  furthermaths: { coach: 'Coach Ada', emoji: '📐', icon: Sigma },
};

function SubjectSelect() {
  const { family, activeChild, selectChild, personas } = useFamily();
  const { t } = useI18n();
  const gradeLabel = useGradeLabel();
  const subjectName = useSubjectName();

  if (!activeChild) return null;

  const isUk = family?.curriculum === 'uk';
  const year = Number(activeChild.grade);
  const subjectIds = visibleSubjectIds(family?.curriculum, year);

  // Every subject is a GCSE subject in Years 10-11 and an A-level subject in
  // Years 12-13, so the stage badge applies to all cards. Further Maths keeps
  // a GCSE badge for the Year 9s who start it early.
  const stageBadge = isUk
    ? year >= 12
      ? t('badge.alevel')
      : year >= 10
        ? t('badge.gcse')
        : null
    : null;
  const badgeFor = (id: string): string | null =>
    id === 'furthermaths' ? (stageBadge ?? t('badge.gcse')) : stageBadge;

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
        {subjectIds.map(id => {
          const meta = SUBJECT_META[id];
          const badge = badgeFor(id);
          const Icon = meta.icon;
          return (
            <Link key={id} to={`/chat/${id}`} className={`subject-card ${id}`}>
              <div className="subject-icon">
                <Icon size={32} />
              </div>
              <div className="subject-info">
                <h2>
                  {subjectName(id)}
                  {badge && <span className="level-badge">{badge}</span>}
                </h2>
                <p>{t(`subject.${id}.description`)}</p>
                <div className="coach-name">
                  {meta.coach} {meta.emoji}
                </div>
              </div>
            </Link>
          );
        })}
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
