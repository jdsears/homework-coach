import { useState } from 'react';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { apiJson } from '../api';
import { useFamily } from '../FamilyContext';

const GRADES = ['3', '4', '5', '6', '7', '8'];

function KidRows({ kids, setKids }) {
  const update = (index, patch) =>
    setKids(kids.map((kid, i) => (i === index ? { ...kid, ...patch } : kid)));

  return (
    <div className="kid-rows">
      {kids.map((kid, index) => (
        <div className="kid-row" key={index}>
          <input
            type="text"
            placeholder="Kid's first name"
            maxLength={40}
            value={kid.name}
            onChange={e => update(index, { name: e.target.value })}
            aria-label={`Kid ${index + 1} name`}
          />
          <select
            value={kid.grade}
            onChange={e => update(index, { grade: e.target.value })}
            aria-label={`Kid ${index + 1} grade`}
          >
            {GRADES.map(grade => (
              <option key={grade} value={grade}>
                {grade === '3' ? '3rd' : `${grade}th`} grade
              </option>
            ))}
          </select>
          {kids.length > 1 && (
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove kid ${index + 1}`}
              onClick={() => setKids(kids.filter((_, i) => i !== index))}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      ))}
      {kids.length < 8 && (
        <button
          type="button"
          className="add-kid-btn"
          onClick={() => setKids([...kids, { name: '', grade: '5' }])}
        >
          <Plus size={16} /> Add another kid
        </button>
      )}
    </div>
  );
}

function FamilySetup() {
  const { refresh } = useFamily();
  const [mode, setMode] = useState('signup');
  const [familyName, setFamilyName] = useState('');
  const [pin, setPin] = useState('');
  const [kids, setKids] = useState([{ name: '', grade: '5' }]);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState(null);

  const submitSignup = async event => {
    event.preventDefault();
    setError('');
    const kidList = kids.filter(kid => kid.name.trim());
    if (!kidList.length) {
      setError('Add at least one kid so they have a profile to learn with!');
      return;
    }
    setBusy(true);
    try {
      const data = await apiJson('/api/family/signup', {
        method: 'POST',
        body: { familyName, pin, children: kidList },
      });
      setNewCode(data.family.code);
    } catch (err) {
      setError(err.friendly ? err.message : 'Could not create your family - please try again');
    } finally {
      setBusy(false);
    }
  };

  const submitLogin = async event => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await apiJson('/api/family/login', { method: 'POST', body: { code, pin } });
      await refresh();
    } catch (err) {
      setError(err.friendly ? err.message : 'Could not sign in - please try again');
    } finally {
      setBusy(false);
    }
  };

  if (newCode) {
    return (
      <div className="setup-screen">
        <div className="setup-card code-reveal">
          <div className="mascot">🎉</div>
          <h1>Welcome!</h1>
          <p>Your family code is</p>
          <div className="family-code">{newCode}</div>
          <p className="code-note">
            Write it down! Use this code plus your parent PIN to sign in on other devices, like a
            phone or the school laptop.
          </p>
          <button className="generate-btn" onClick={() => refresh()}>
            Let's go!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-screen">
      <header className="header">
        <div className="mascot">🎓</div>
        <h1>Homework Coach</h1>
        <p>Friendly coaches that help kids learn - not just get answers</p>
      </header>

      <div className="setup-card">
        <div className="tab-row" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'signup'}
            className={`tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup');
              setError('');
            }}
          >
            New family
          </button>
          <button
            role="tab"
            aria-selected={mode === 'login'}
            className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            We have a code
          </button>
        </div>

        {mode === 'signup' ? (
          <form onSubmit={submitSignup} className="setup-form">
            <label className="form-field">
              Family name
              <input
                type="text"
                placeholder="e.g. The Riveras"
                maxLength={60}
                value={familyName}
                onChange={e => setFamilyName(e.target.value)}
                required
              />
            </label>

            <label className="form-field">
              Parent PIN (4-8 digits)
              <input
                type="password"
                inputMode="numeric"
                pattern="\d{4,8}"
                placeholder="For the parent dashboard"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                required
              />
            </label>

            <div className="form-field">
              <span>Who's learning?</span>
              <KidRows kids={kids} setKids={setKids} />
            </div>

            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="generate-btn" disabled={busy}>
              {busy ? 'Setting up...' : 'Create our family'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitLogin} className="setup-form">
            <label className="form-field">
              Family code
              <input
                type="text"
                placeholder="e.g. ABC-123"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                maxLength={7}
                required
              />
            </label>

            <label className="form-field">
              Parent PIN
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                required
              />
            </label>

            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="generate-btn" disabled={busy}>
              <KeyRound size={18} /> {busy ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default FamilySetup;
