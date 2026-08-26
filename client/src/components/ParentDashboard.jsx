import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingUp,
  AlertCircle,
  Heart,
  BookOpen,
  KeyRound,
  LogOut,
  Mail,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { apiJson, gradeLabel } from '../api';
import { useFamily } from '../FamilyContext';
import ActivityChart from './ActivityChart';

const GRADES = ['3', '4', '5', '6', '7', '8'];

function ParentDashboard() {
  const navigate = useNavigate();
  const { refresh, signOut } = useFamily();

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needPin, setNeedPin] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const [kidName, setKidName] = useState('');
  const [kidGrade, setKidGrade] = useState('5');
  const [kidError, setKidError] = useState('');

  const [digestEmail, setDigestEmail] = useState('');
  const [digestSaved, setDigestSaved] = useState(false);
  const [digestError, setDigestError] = useState('');
  const [digestPreview, setDigestPreview] = useState(null);

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const summary = await apiJson('/api/parent/summary');
      setData(summary);
      setDigestEmail(summary.digestEmail || '');
      setNeedPin(false);
    } catch (error) {
      if (error.needPin) setNeedPin(true);
      else if (error.needFamily) navigate('/');
      else setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const submitPin = async event => {
    event.preventDefault();
    setPinError('');
    try {
      await apiJson('/api/parent/verify', { method: 'POST', body: { pin } });
      setPin('');
      fetchSummary();
    } catch (error) {
      setPinError(error.friendly ? error.message : 'Could not check the PIN - try again');
    }
  };

  const addKid = async event => {
    event.preventDefault();
    setKidError('');
    if (!kidName.trim()) return;
    try {
      await apiJson('/api/children', { method: 'POST', body: { name: kidName, grade: kidGrade } });
      setKidName('');
      await refresh();
      fetchSummary();
    } catch (error) {
      if (error.needPin) setNeedPin(true);
      else setKidError(error.friendly ? error.message : 'Could not add that kid - try again');
    }
  };

  const saveDigestEmail = async event => {
    event.preventDefault();
    setDigestError('');
    setDigestSaved(false);
    try {
      await apiJson('/api/parent/settings', { method: 'POST', body: { digestEmail } });
      setDigestSaved(true);
    } catch (error) {
      if (error.needPin) setNeedPin(true);
      else setDigestError(error.friendly ? error.message : 'Could not save that - try again');
    }
  };

  const previewDigest = async () => {
    setDigestError('');
    try {
      const { html } = await apiJson('/api/parent/digest');
      setDigestPreview(html);
    } catch (error) {
      if (error.needPin) setNeedPin(true);
      else setDigestError('Could not build the preview - try again');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="parent-dashboard">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (needPin) {
    return (
      <div className="parent-dashboard">
        <header className="parent-header">
          <button className="parent-back-btn" onClick={() => navigate('/')} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h1>📊 Parent Dashboard</h1>
        </header>
        <div className="section-card pin-gate">
          <KeyRound size={32} />
          <h2>Parents only</h2>
          <p>Enter your parent PIN to see this week's summary.</p>
          <form onSubmit={submitPin} className="pin-form">
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Parent PIN"
              aria-label="Parent PIN"
              autoFocus
            />
            <button type="submit" className="generate-btn" disabled={!pin}>
              Unlock
            </button>
          </form>
          {pinError && <p className="form-error">{pinError}</p>}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="parent-dashboard">
        <header className="parent-header">
          <button className="parent-back-btn" onClick={() => navigate('/')} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h1>📊 Parent Dashboard</h1>
        </header>
        <div className="section-card">
          <p>Couldn't load the dashboard right now. Please refresh to try again.</p>
        </div>
      </div>
    );
  }

  const totalInteractions = data?.subjectBreakdown
    ? Object.values(data.subjectBreakdown).reduce((a, b) => a + b, 0)
    : 0;

  const totalStruggles = data?.struggles ? Object.values(data.struggles).flat().length : 0;

  return (
    <div className="parent-dashboard">
      <header className="parent-header">
        <button className="parent-back-btn" onClick={() => navigate('/')} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1>📊 {data.familyName} Family</h1>
        <button
          className="parent-back-btn sign-out-btn"
          onClick={handleSignOut}
          title="Sign this device out"
        >
          <LogOut size={18} />
        </button>
      </header>

      <div className="section-card family-code-card">
        <div>
          <strong>Family code: {data.familyCode}</strong>
          <p>Use it with your PIN to sign in on another device.</p>
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-value">{data.totalSessions}</div>
          <div className="stat-label">Sessions this week</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.totalMinutes}</div>
          <div className="stat-label">Minutes on task</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalInteractions}</div>
          <div className="stat-label">Messages</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalStruggles}</div>
          <div className="stat-label">Tricky moments</div>
        </div>
      </div>

      <div className="section-card">
        <h2>
          <TrendingUp size={20} /> Last 14 days
        </h2>
        <ActivityChart days={data.dailyActivity || []} />
      </div>

      <div className="section-card">
        <h2>
          <Users size={20} /> Your kids
        </h2>
        {data.children?.map(kid => (
          <div key={kid.id} className="kid-summary">
            <div className="kid-summary-row">
              <strong>{kid.name}</strong>
              <span>
                {gradeLabel(kid.grade)} grade · {kid.minutes} min · {kid.messageCount} messages ·{' '}
                {kid.practiceCount} practice
              </span>
            </div>
            {(kid.strengths?.length > 0 || kid.focusAreas?.length > 0) && (
              <div className="mastery-chips">
                {kid.strengths?.map(topic => (
                  <span key={`s-${topic}`} className="mastery-chip strong">
                    💪 {topic}
                  </span>
                ))}
                {kid.focusAreas?.map(topic => (
                  <span key={`f-${topic}`} className="mastery-chip focus">
                    🎯 {topic}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        <form onSubmit={addKid} className="add-kid-form">
          <input
            type="text"
            value={kidName}
            onChange={e => setKidName(e.target.value)}
            placeholder="Add a kid (first name)"
            maxLength={40}
            aria-label="New kid name"
          />
          <select
            value={kidGrade}
            onChange={e => setKidGrade(e.target.value)}
            aria-label="New kid grade"
          >
            {GRADES.map(grade => (
              <option key={grade} value={grade}>
                {gradeLabel(grade)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="icon-btn"
            aria-label="Add kid"
            disabled={!kidName.trim()}
          >
            <Plus size={18} />
          </button>
        </form>
        {kidError && <p className="form-error">{kidError}</p>}
      </div>

      {totalStruggles > 0 && (
        <div className="section-card">
          <h2>
            <AlertCircle size={20} /> Areas That Need Support
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '12px' }}>
            These are moments where your child expressed difficulty or tried to skip the learning
            process.
          </p>
          {Object.entries(data.struggles).map(
            ([subject, items]) =>
              items.length > 0 && (
                <div key={subject} style={{ marginBottom: '16px' }}>
                  <h3
                    style={{ textTransform: 'capitalize', fontSize: '1rem', marginBottom: '8px' }}
                  >
                    {subject}
                  </h3>
                  {items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="struggle-item">
                      <strong>{item.type}</strong>
                      <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                        {new Date(item.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )
          )}
        </div>
      )}

      <div className="section-card">
        <h2>
          <Heart size={20} /> Tips for Parents
        </h2>
        <div className="encouragement-box">
          {data?.encouragement?.map((tip, idx) => (
            <p key={idx}>💡 {tip}</p>
          ))}
        </div>
      </div>

      <div className="section-card">
        <h2>
          <Mail size={20} /> Weekly Email Digest
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '12px' }}>
          Get this summary in your inbox every Sunday. Leave the email empty to turn it off.
        </p>
        <form onSubmit={saveDigestEmail} className="add-kid-form">
          <input
            type="email"
            value={digestEmail}
            onChange={e => {
              setDigestEmail(e.target.value);
              setDigestSaved(false);
            }}
            placeholder="parent@example.com"
            maxLength={120}
            aria-label="Digest email address"
          />
          <button type="submit" className="generate-btn digest-save-btn">
            {digestSaved ? 'Saved ✔' : 'Save'}
          </button>
        </form>
        <button className="hint-btn" onClick={previewDigest} style={{ marginTop: '12px' }}>
          👀 Preview this week's digest
        </button>
        {digestError && <p className="form-error">{digestError}</p>}
      </div>

      <div className="section-card">
        <h2>
          <BookOpen size={20} /> How It Works
        </h2>
        <p style={{ marginBottom: '12px' }}>
          Homework Coach uses the Socratic method - instead of giving answers directly, it asks
          guiding questions to help your child discover solutions on their own.
        </p>
        <p style={{ marginBottom: '12px' }}>
          <strong>Answer-fishing detection:</strong> If your child asks for direct answers, the
          coach gently redirects them back to learning, and it shows up here as a tricky moment.
        </p>
        <p>
          <strong>Privacy:</strong> Everything your kids write stays in your family's account, and
          this dashboard only shows the type of tricky moment - never their words.
        </p>
      </div>

      {digestPreview && (
        <div className="digest-modal" role="dialog" aria-label="Digest preview">
          <div className="digest-modal-card">
            <button
              className="icon-btn digest-close"
              onClick={() => setDigestPreview(null)}
              aria-label="Close preview"
            >
              <X size={18} />
            </button>
            {/* Our own server-generated digest HTML */}
            <div dangerouslySetInnerHTML={{ __html: digestPreview }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default ParentDashboard;
