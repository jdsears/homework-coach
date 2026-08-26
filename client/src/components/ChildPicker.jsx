import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { gradeLabel } from '../api';
import { useFamily } from '../FamilyContext';

const AVATARS = ['🦊', '🐼', '🦉', '🐯', '🐸', '🦄', '🐧', '🐨'];

function ChildPicker() {
  const { family, kids, selectChild } = useFamily();

  return (
    <div className="setup-screen">
      <header className="header">
        <div className="mascot">👋</div>
        <h1>Who's learning today?</h1>
        <p>{family.name}</p>
      </header>

      {kids.length === 0 ? (
        <div className="setup-card">
          <p style={{ marginBottom: '16px' }}>
            No kid profiles yet! A parent can add one from the parent dashboard.
          </p>
          <Link
            to="/parent"
            className="generate-btn"
            style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
          >
            Open parent dashboard
          </Link>
        </div>
      ) : (
        <div className="child-grid">
          {kids.map((kid, index) => (
            <button key={kid.id} className="child-card" onClick={() => selectChild(kid.id)}>
              <div className="child-avatar">{AVATARS[index % AVATARS.length]}</div>
              <div className="child-name">{kid.name}</div>
              <div className="child-grade">{gradeLabel(kid.grade)} grade</div>
            </button>
          ))}
        </div>
      )}

      <Link to="/parent" className="parent-corner-link">
        <Users size={16} /> Parents
      </Link>
    </div>
  );
}

export default ChildPicker;
