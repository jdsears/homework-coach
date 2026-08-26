import { useState, type FormEvent } from 'react';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { apiJson, isApiError } from '../api';
import { useFamily } from '../FamilyContext';
import { LANGUAGE_NAMES, useI18n, useGradeLabel } from '../i18n';
import type { Lang } from '../prefs';

const GRADES = ['3', '4', '5', '6', '7', '8'];

interface KidInput {
  name: string;
  grade: string;
}

function KidRows({ kids, setKids }: { kids: KidInput[]; setKids: (kids: KidInput[]) => void }) {
  const { t } = useI18n();
  const gradeLabel = useGradeLabel();
  const update = (index: number, patch: Partial<KidInput>) =>
    setKids(kids.map((kid, i) => (i === index ? { ...kid, ...patch } : kid)));

  return (
    <div className="kid-rows">
      {kids.map((kid, index) => (
        <div className="kid-row" key={index}>
          <input
            type="text"
            placeholder={t('setup.kidNamePh')}
            maxLength={40}
            value={kid.name}
            onChange={e => update(index, { name: e.target.value })}
            aria-label={t('setup.kidName', { n: index + 1 })}
          />
          <select
            value={kid.grade}
            onChange={e => update(index, { grade: e.target.value })}
            aria-label={t('setup.kidGrade', { n: index + 1 })}
          >
            {GRADES.map(grade => (
              <option key={grade} value={grade}>
                {gradeLabel(grade)}
              </option>
            ))}
          </select>
          {kids.length > 1 && (
            <button
              type="button"
              className="icon-btn"
              aria-label={t('setup.removeKid', { n: index + 1 })}
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
          <Plus size={16} /> {t('setup.addKid')}
        </button>
      )}
    </div>
  );
}

function FamilySetup() {
  const { refresh } = useFamily();
  const { t, lang, setLang } = useI18n();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [familyName, setFamilyName] = useState('');
  const [pin, setPin] = useState('');
  const [kids, setKids] = useState<KidInput[]>([{ name: '', grade: '5' }]);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  const submitSignup = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const kidList = kids.filter(kid => kid.name.trim());
    if (!kidList.length) {
      setError(t('setup.needKid'));
      return;
    }
    setBusy(true);
    try {
      const data = await apiJson<{ family: { code: string } }>('/api/family/signup', {
        method: 'POST',
        body: { familyName, pin, children: kidList },
      });
      setNewCode(data.family.code);
    } catch (err) {
      setError(isApiError(err) && err.friendly ? err.message : t('setup.createFailed'));
    } finally {
      setBusy(false);
    }
  };

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await apiJson('/api/family/login', { method: 'POST', body: { code, pin } });
      await refresh();
    } catch (err) {
      setError(isApiError(err) && err.friendly ? err.message : t('setup.signInFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (newCode) {
    return (
      <div className="setup-screen">
        <div className="setup-card code-reveal">
          <div className="mascot">🎉</div>
          <h1>{t('setup.welcome')}</h1>
          <p>{t('setup.yourCode')}</p>
          <div className="family-code">{newCode}</div>
          <p className="code-note">{t('setup.codeNote')}</p>
          <button className="generate-btn" onClick={() => refresh()}>
            {t('setup.letsGo')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-screen">
      <div className="lang-corner">
        <select
          value={lang}
          onChange={e => setLang(e.target.value as Lang)}
          aria-label={t('parent.language')}
        >
          {(Object.keys(LANGUAGE_NAMES) as Lang[]).map(code => (
            <option key={code} value={code}>
              {LANGUAGE_NAMES[code]}
            </option>
          ))}
        </select>
      </div>

      <header className="header">
        <div className="mascot">🎓</div>
        <h1>{t('setup.title')}</h1>
        <p>{t('setup.tagline')}</p>
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
            {t('setup.newFamily')}
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
            {t('setup.haveCode')}
          </button>
        </div>

        {mode === 'signup' ? (
          <form onSubmit={submitSignup} className="setup-form">
            <label className="form-field">
              {t('setup.familyName')}
              <input
                type="text"
                placeholder={t('setup.familyNamePh')}
                maxLength={60}
                value={familyName}
                onChange={e => setFamilyName(e.target.value)}
                required
              />
            </label>

            <label className="form-field">
              {t('setup.parentPin')}
              <input
                type="password"
                inputMode="numeric"
                pattern="\d{4,8}"
                placeholder={t('setup.parentPinPh')}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                required
              />
            </label>

            <div className="form-field">
              <span>{t('setup.whoLearning')}</span>
              <KidRows kids={kids} setKids={setKids} />
            </div>

            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="generate-btn" disabled={busy}>
              {busy ? t('setup.creating') : t('setup.createFamily')}
            </button>
          </form>
        ) : (
          <form onSubmit={submitLogin} className="setup-form">
            <label className="form-field">
              {t('setup.familyCode')}
              <input
                type="text"
                placeholder={t('setup.codePh')}
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                maxLength={7}
                required
              />
            </label>

            <label className="form-field">
              {t('setup.parentPinShort')}
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
              <KeyRound size={18} /> {busy ? t('setup.signingIn') : t('setup.signIn')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default FamilySetup;
