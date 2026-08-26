import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useFamily } from '../FamilyContext';
import { useI18n, useGradeLabel } from '../i18n';

const AVATARS = ['🦊', '🐼', '🦉', '🐯', '🐸', '🦄', '🐧', '🐨'];

function ChildPicker() {
  const { family, kids, selectChild } = useFamily();
  const { t } = useI18n();
  const gradeLabel = useGradeLabel();

  return (
    <div className="setup-screen">
      <header className="header">
        <div className="mascot">👋</div>
        <h1>{t('picker.title')}</h1>
        <p>{family?.name}</p>
      </header>

      {kids.length === 0 ? (
        <div className="setup-card">
          <p style={{ marginBottom: '16px' }}>{t('picker.noKids')}</p>
          <Link
            to="/parent"
            className="generate-btn"
            style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
          >
            {t('picker.openParent')}
          </Link>
        </div>
      ) : (
        <div className="child-grid">
          {kids.map((kid, index) => (
            <button key={kid.id} className="child-card" onClick={() => selectChild(kid.id)}>
              <div className="child-avatar">{AVATARS[index % AVATARS.length]}</div>
              <div className="child-name">{kid.name}</div>
              <div className="child-grade">{gradeLabel(kid.grade)}</div>
            </button>
          ))}
        </div>
      )}

      <Link to="/parent" className="parent-corner-link">
        <Users size={16} /> {t('picker.parents')}
      </Link>
    </div>
  );
}

export default ChildPicker;
