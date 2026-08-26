import { useEffect, useState } from 'react';
import { Flame, Star, Target, X } from 'lucide-react';
import { apiJson } from '../api';
import { useFamily } from '../FamilyContext';

// Streak, level, daily challenge, and trophies for the home screen.
function ProgressStrip() {
  const { activeChild } = useFamily();
  const [progress, setProgress] = useState(null);
  const [newBadges, setNewBadges] = useState([]);

  useEffect(() => {
    let cancelled = false;
    if (!activeChild) return undefined;

    apiJson(`/api/progress?childId=${activeChild.id}`)
      .then(data => {
        if (cancelled) return;
        setProgress(data);

        // Celebrate badges earned since this device last looked
        const storageKey = `hc_badges_${activeChild.id}`;
        const earned = data.badges.filter(badge => badge.earned).map(badge => badge.id);
        try {
          const seen = JSON.parse(localStorage.getItem(storageKey) || '[]');
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

  if (!progress) return null;

  const earnedBadges = progress.badges.filter(badge => badge.earned);

  return (
    <div className="progress-strip">
      {newBadges.length > 0 && (
        <div className="new-badge-banner">
          🎉 New trophy: {newBadges.map(badge => `${badge.emoji} ${badge.name}`).join(', ')}!
          <button onClick={() => setNewBadges([])} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="progress-row">
        <div className="progress-stat" title="Days in a row of learning">
          <Flame size={18} className={progress.streak > 0 ? 'flame-lit' : ''} />
          <strong>{progress.streak}</strong> day{progress.streak === 1 ? '' : 's'}
        </div>
        <div
          className="progress-stat level-stat"
          title={`${progress.intoLevel}/${progress.levelSize} XP into this level`}
        >
          <Star size={18} />
          <strong>Level {progress.level}</strong>
          <span className="xp-bar" aria-hidden="true">
            <span
              className="xp-fill"
              style={{ width: `${Math.round((progress.intoLevel / progress.levelSize) * 100)}%` }}
            />
          </span>
        </div>
      </div>

      <div className={`challenge-chip ${progress.challenge.done ? 'done' : ''}`}>
        <Target size={16} />
        <span>
          {progress.challenge.done
            ? `Challenge complete! ${progress.challenge.title} ✔`
            : `Today's challenge: ${progress.challenge.title} (${progress.challenge.progress}/${progress.challenge.goal})`}
        </span>
      </div>

      {earnedBadges.length > 0 && (
        <div className="trophy-row" aria-label="Trophies earned">
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
