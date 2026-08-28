import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Flame, Star, Target, X } from 'lucide-react';
import { apiJson } from '../api';
import { useFamily } from '../FamilyContext';
import { useI18n, useSubjectName } from '../i18n';
import { resolveSubjectId } from '../subjects';
import type { Badge, Progress } from '../types';

// Streak, level, daily challenge, and trophies for the home screen.
function ProgressStrip() {
  const { family, activeChild } = useFamily();
  const { t } = useI18n();
  const subjectName = useSubjectName();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [newBadges, setNewBadges] = useState<Badge[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!activeChild) return undefined;

    apiJson<Progress>(`/api/progress?childId=${activeChild.id}`)
      .then(data => {
        if (cancelled) return;
        setProgress(data);

        // Celebrate badges earned since this device last looked
        const storageKey = `hc_badges_${activeChild.id}`;
        const earned = data.badges.filter(badge => badge.earned).map(badge => badge.id);
        try {
          const seen = JSON.parse(localStorage.getItem(storageKey) || '[]') as string[];
          const fresh = data.badges.filter(badge => badge.earned && !seen.includes(badge.id));
          if (seen.length && fresh.length) setNewBadges(fresh);
          localStorage.setItem(storageKey, JSON.stringify(earned));
        } catch {
          // localStorage unavailable - skip the celebration, keep the strip
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeChild]);

  if (!progress || !activeChild) return null;

  const earnedBadges = progress.badges.filter(badge => badge.earned);

  // Rebuild the challenge title locally so it follows the interface language
  // The challenge is generated without knowing the kid's year, so map it onto a
  // subject they're actually offered ("reading" is English Language at GCSE).
  const challengeSubject = resolveSubjectId(
    progress.challenge.subject,
    family?.curriculum,
    Number(activeChild.grade)
  );
  const challengeTitle = progress.challenge.topic
    ? t('progress.challengeTopic', { topic: progress.challenge.topic })
    : t('progress.challengeSubject', { subject: subjectName(challengeSubject) });

  // Tapping the challenge opens practice already set to its subject and topic
  const challengeParams = new URLSearchParams({ subject: challengeSubject });
  if (progress.challenge.topic) challengeParams.set('topic', progress.challenge.topic);

  return (
    <div className="progress-strip">
      {newBadges.length > 0 && (
        <div className="new-badge-banner">
          {t('progress.newTrophy', {
            names: newBadges.map(badge => `${badge.emoji} ${badge.name}`).join(', '),
          })}
          <button onClick={() => setNewBadges([])} aria-label={t('progress.dismiss')}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="progress-row">
        <div className="progress-stat" title={t('progress.streakTitle')}>
          <Flame size={18} className={progress.streak > 0 ? 'flame-lit' : ''} />
          <strong>{t('progress.streak', { n: progress.streak })}</strong>
        </div>
        <div
          className="progress-stat level-stat"
          title={t('progress.xpTitle', { into: progress.intoLevel, size: progress.levelSize })}
        >
          <Star size={18} />
          <strong>{t('progress.level', { n: progress.level })}</strong>
          <span className="xp-bar" aria-hidden="true">
            <span
              className="xp-fill"
              style={{ width: `${Math.round((progress.intoLevel / progress.levelSize) * 100)}%` }}
            />
          </span>
        </div>
      </div>

      <Link
        to={`/practice?${challengeParams}`}
        className={`challenge-chip ${progress.challenge.done ? 'done' : ''}`}
      >
        <Target size={16} />
        <span>
          {progress.challenge.done
            ? t('progress.challengeDone', { title: challengeTitle })
            : t('progress.challengeTodo', {
                title: challengeTitle,
                p: progress.challenge.progress,
                g: progress.challenge.goal,
              })}
        </span>
        <ChevronRight size={16} className="challenge-go" aria-hidden="true" />
      </Link>

      {earnedBadges.length > 0 && (
        <div className="trophy-row" aria-label={t('progress.trophies')}>
          {earnedBadges.map(badge => (
            <span key={badge.id} className="trophy" title={`${badge.name} - ${badge.description}`}>
              {badge.emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProgressStrip;
