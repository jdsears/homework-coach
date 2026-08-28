import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingUp,
  AlertCircle,
  Heart,
  BookOpen,
  Bot,
  KeyRound,
  LogOut,
  Mail,
  Plus,
  Settings,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { apiJson, isApiError } from '../api';
import { useFamily } from '../FamilyContext';
import { LANGUAGE_NAMES, useI18n, useGradeLabel, useSubjectName } from '../i18n';
import { getReadingFont, storeReadingFont, type Lang } from '../prefs';
import ActivityChart from './ActivityChart';
import {
  EXAM_BOARDS,
  EXAM_BOARD_LABELS,
  GRADE_SETS,
  type Curriculum,
  type ParentSummary,
} from '../types';

function ParentDashboard() {
  const navigate = useNavigate();
  const { family, refresh, signOut, personas } = useFamily();
  const { t, lang, setLang } = useI18n();
  const gradeLabel = useGradeLabel();
  const subjectName = useSubjectName();
  const grades = GRADE_SETS[family?.curriculum ?? 'uk'];

  const [data, setData] = useState<ParentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needPin, setNeedPin] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const [kidName, setKidName] = useState('');
  const [kidGrade, setKidGrade] = useState('5');
  const [kidError, setKidError] = useState('');

  const [coachName, setCoachName] = useState('');
  const [coachEmoji, setCoachEmoji] = useState('');
  const [coachDesc, setCoachDesc] = useState('');
  const [coachError, setCoachError] = useState('');

  const [digestEmail, setDigestEmail] = useState('');
  const [digestSaved, setDigestSaved] = useState(false);
  const [digestError, setDigestError] = useState('');
  const [digestPreview, setDigestPreview] = useState<string | null>(null);

  const [readingFont, setReadingFont] = useState(getReadingFont);
  const [curriculumBusy, setCurriculumBusy] = useState(false);

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const summary = await apiJson<ParentSummary>('/api/parent/summary');
      setData(summary);
      setDigestEmail(summary.digestEmail || '');
      setNeedPin(false);
    } catch (error) {
      if (isApiError(error) && error.needPin) setNeedPin(true);
      else if (isApiError(error) && error.needFamily) navigate('/');
      else setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const submitPin = async (event: FormEvent) => {
    event.preventDefault();
    setPinError('');
    try {
      await apiJson('/api/parent/verify', { method: 'POST', body: { pin } });
      setPin('');
      fetchSummary();
    } catch (error) {
      setPinError(isApiError(error) && error.friendly ? error.message : t('parent.pinFailed'));
    }
  };

  const addKid = async (event: FormEvent) => {
    event.preventDefault();
    setKidError('');
    if (!kidName.trim()) return;
    try {
      await apiJson('/api/children', { method: 'POST', body: { name: kidName, grade: kidGrade } });
      setKidName('');
      await refresh();
      fetchSummary();
    } catch (error) {
      if (isApiError(error) && error.needPin) setNeedPin(true);
      else
        setKidError(isApiError(error) && error.friendly ? error.message : t('parent.addKidFailed'));
    }
  };

  const addCoach = async (event: FormEvent) => {
    event.preventDefault();
    setCoachError('');
    if (!coachName.trim() || !coachDesc.trim()) return;
    try {
      await apiJson('/api/personas', {
        method: 'POST',
        body: { name: coachName, emoji: coachEmoji || '🤖', description: coachDesc },
      });
      setCoachName('');
      setCoachEmoji('');
      setCoachDesc('');
      await refresh();
    } catch (error) {
      if (isApiError(error) && error.needPin) setNeedPin(true);
      else
        setCoachError(isApiError(error) && error.friendly ? error.message : t('parent.saveFailed'));
    }
  };

  const deleteCoach = async (id: string) => {
    try {
      await apiJson(`/api/personas/${id}`, { method: 'DELETE' });
      await refresh();
    } catch (error) {
      if (isApiError(error) && error.needPin) setNeedPin(true);
    }
  };

  const saveDigestEmail = async (event: FormEvent) => {
    event.preventDefault();
    setDigestError('');
    setDigestSaved(false);
    try {
      await apiJson('/api/parent/settings', { method: 'POST', body: { digestEmail } });
      setDigestSaved(true);
    } catch (error) {
      if (isApiError(error) && error.needPin) setNeedPin(true);
      else
        setDigestError(
          isApiError(error) && error.friendly ? error.message : t('parent.saveFailed')
        );
    }
  };

  const previewDigest = async () => {
    setDigestError('');
    try {
      const { html } = await apiJson<{ html: string }>('/api/parent/digest');
      setDigestPreview(html);
    } catch (error) {
      if (isApiError(error) && error.needPin) setNeedPin(true);
      else setDigestError(t('parent.previewFailed'));
    }
  };

  const toggleReadingFont = () => {
    const next = !readingFont;
    setReadingFont(next);
    storeReadingFont(next);
  };

  const changeCurriculum = async (next: Curriculum) => {
    if (next === family?.curriculum || curriculumBusy) return;
    setCurriculumBusy(true);
    try {
      await apiJson('/api/parent/settings', { method: 'POST', body: { curriculum: next } });
      await refresh();
      fetchSummary();
    } catch (error) {
      if (isApiError(error) && error.needPin) setNeedPin(true);
    } finally {
      setCurriculumBusy(false);
    }
  };

  const patchKid = async (id: string, patch: Record<string, string>) => {
    try {
      await apiJson(`/api/children/${id}`, { method: 'PATCH', body: patch });
      await refresh();
      fetchSummary();
    } catch (error) {
      if (isApiError(error) && error.needPin) setNeedPin(true);
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
          <button
            className="parent-back-btn"
            onClick={() => navigate('/')}
            aria-label={t('parent.back')}
          >
            <ArrowLeft size={20} />
          </button>
          <h1>📊 {t('parent.title')}</h1>
        </header>
        <div className="section-card pin-gate">
          <KeyRound size={32} />
          <h2>{t('parent.pinTitle')}</h2>
          <p>{t('parent.pinBody')}</p>
          <form onSubmit={submitPin} className="pin-form">
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder={t('parent.pinPh')}
              aria-label={t('parent.pinPh')}
              autoFocus
            />
            <button type="submit" className="generate-btn" disabled={!pin}>
              {t('parent.unlock')}
            </button>
          </form>
          {pinError && <p className="form-error">{pinError}</p>}
        </div>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="parent-dashboard">
        <header className="parent-header">
          <button
            className="parent-back-btn"
            onClick={() => navigate('/')}
            aria-label={t('parent.back')}
          >
            <ArrowLeft size={20} />
          </button>
          <h1>📊 {t('parent.title')}</h1>
        </header>
        <div className="section-card">
          <p>{t('parent.loadError')}</p>
        </div>
      </div>
    );
  }

  const totalInteractions = Object.values(data.subjectBreakdown).reduce((a, b) => a + b, 0);
  const totalStruggles = Object.values(data.struggles).flat().length;

  return (
    <div className="parent-dashboard">
      <header className="parent-header">
        <button
          className="parent-back-btn"
          onClick={() => navigate('/')}
          aria-label={t('parent.back')}
        >
          <ArrowLeft size={20} />
        </button>
        <h1>📊 {t('parent.familyTitle', { name: data.familyName })}</h1>
        <button
          className="parent-back-btn sign-out-btn"
          onClick={handleSignOut}
          title={t('parent.signOut')}
        >
          <LogOut size={18} />
        </button>
      </header>

      <div className="section-card family-code-card">
        <div>
          <strong>{t('parent.codeCard', { code: data.familyCode })}</strong>
          <p>{t('parent.codeNote')}</p>
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-value">{data.totalSessions}</div>
          <div className="stat-label">{t('parent.sessions')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.totalMinutes}</div>
          <div className="stat-label">{t('parent.minutes')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalInteractions}</div>
          <div className="stat-label">{t('parent.messages')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalStruggles}</div>
          <div className="stat-label">{t('parent.tricky')}</div>
        </div>
      </div>

      <div className="section-card">
        <h2>
          <TrendingUp size={20} /> {t('parent.last14')}
        </h2>
        <ActivityChart days={data.dailyActivity || []} />
      </div>

      <div className="section-card">
        <h2>
          <Users size={20} /> {t('parent.kids')}
        </h2>
        {data.children.map(kid => (
          <div key={kid.id} className="kid-summary">
            <div className="kid-summary-row">
              <strong>{kid.name}</strong>
              <span className="kid-line">
                <select
                  className="kid-grade-select"
                  value={kid.grade}
                  onChange={e => patchKid(kid.id, { grade: e.target.value })}
                  aria-label={t('parent.kidYear', { name: kid.name })}
                >
                  {(grades.includes(kid.grade) ? grades : [kid.grade, ...grades]).map(grade => (
                    <option key={grade} value={grade}>
                      {gradeLabel(grade)}
                    </option>
                  ))}
                </select>
                {t('parent.kidLine', {
                  min: kid.minutes,
                  msg: kid.messageCount,
                  practice: kid.practiceCount,
                })}
              </span>
            </div>
            {family?.curriculum === 'uk' && Number(kid.grade) >= 10 && (
              <div className="kid-exam-row">
                <select
                  className="kid-grade-select"
                  value={kid.examBoard}
                  onChange={e => patchKid(kid.id, { examBoard: e.target.value })}
                  aria-label={t('parent.examBoard', { name: kid.name })}
                >
                  <option value="">{t('parent.examBoardNone')}</option>
                  {EXAM_BOARDS.map(board => (
                    <option key={board} value={board}>
                      {EXAM_BOARD_LABELS[board]}
                    </option>
                  ))}
                </select>
                <input
                  key={`${kid.id}-notes-${kid.courseNotes}`}
                  type="text"
                  defaultValue={kid.courseNotes}
                  placeholder={t('parent.courseNotesPh')}
                  maxLength={300}
                  aria-label={t('parent.courseNotes', { name: kid.name })}
                  onBlur={e => {
                    if (e.target.value.trim() !== kid.courseNotes) {
                      patchKid(kid.id, { courseNotes: e.target.value });
                    }
                  }}
                />
              </div>
            )}
            {(kid.strengths.length > 0 || kid.focusAreas.length > 0) && (
              <div className="mastery-chips">
                {kid.strengths.map(topic => (
                  <span key={`s-${topic}`} className="mastery-chip strong">
                    💪 {topic}
                  </span>
                ))}
                {kid.focusAreas.map(topic => (
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
            placeholder={t('parent.addKidPh')}
            maxLength={40}
            aria-label={t('parent.newKidName')}
          />
          <select
            value={kidGrade}
            onChange={e => setKidGrade(e.target.value)}
            aria-label={t('parent.newKidGrade')}
          >
            {grades.map(grade => (
              <option key={grade} value={grade}>
                {gradeLabel(grade)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="icon-btn"
            aria-label={t('parent.addKid')}
            disabled={!kidName.trim()}
          >
            <Plus size={18} />
          </button>
        </form>
        {kidError && <p className="form-error">{kidError}</p>}
      </div>

      <div className="section-card">
        <h2>
          <Bot size={20} /> {t('parent.coaches')}
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '12px' }}>
          {t('parent.coachesNote')}
        </p>
        {personas.map(persona => (
          <div key={persona.id} className="kid-summary-row">
            <strong>
              {persona.emoji} {persona.name}
            </strong>
            <span className="persona-row-desc">
              {persona.description}
              <button
                className="icon-btn"
                onClick={() => deleteCoach(persona.id)}
                aria-label={t('parent.deleteCoach', { name: persona.name })}
                title={t('parent.deleteCoach', { name: persona.name })}
              >
                <Trash2 size={16} />
              </button>
            </span>
          </div>
        ))}
        <form onSubmit={addCoach} className="coach-form">
          <div className="coach-form-row">
            <input
              type="text"
              value={coachEmoji}
              onChange={e => setCoachEmoji(e.target.value)}
              placeholder={t('parent.coachEmojiPh')}
              maxLength={8}
              className="coach-emoji-input"
              aria-label="Emoji"
            />
            <input
              type="text"
              value={coachName}
              onChange={e => setCoachName(e.target.value)}
              placeholder={t('parent.coachNamePh')}
              maxLength={30}
              aria-label={t('parent.coachNamePh')}
            />
          </div>
          <input
            type="text"
            value={coachDesc}
            onChange={e => setCoachDesc(e.target.value)}
            placeholder={t('parent.coachDescPh')}
            maxLength={200}
            aria-label={t('parent.coachDescPh')}
          />
          <button
            type="submit"
            className="generate-btn digest-save-btn"
            disabled={!coachName.trim() || !coachDesc.trim()}
          >
            <Plus size={16} /> {t('parent.addCoach')}
          </button>
        </form>
        {coachError && <p className="form-error">{coachError}</p>}
      </div>

      {totalStruggles > 0 && (
        <div className="section-card">
          <h2>
            <AlertCircle size={20} /> {t('parent.support')}
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '12px' }}>
            {t('parent.supportNote')}
          </p>
          {Object.entries(data.struggles).map(
            ([subject, items]) =>
              items.length > 0 && (
                <div key={subject} style={{ marginBottom: '16px' }}>
                  <h3
                    style={{ textTransform: 'capitalize', fontSize: '1rem', marginBottom: '8px' }}
                  >
                    {subject.startsWith('p:') ? t('parent.coaches') : subjectName(subject)}
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
          <Heart size={20} /> {t('parent.tips')}
        </h2>
        <div className="encouragement-box">
          {data.encouragement.map((tip, idx) => (
            <p key={idx}>💡 {tip}</p>
          ))}
        </div>
      </div>

      <div className="section-card">
        <h2>
          <Mail size={20} /> {t('parent.digest')}
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '12px' }}>
          {t('parent.digestNote')}
        </p>
        <form onSubmit={saveDigestEmail} className="add-kid-form">
          <input
            type="email"
            value={digestEmail}
            onChange={e => {
              setDigestEmail(e.target.value);
              setDigestSaved(false);
            }}
            placeholder={t('parent.digestPh')}
            maxLength={120}
            aria-label={t('parent.digestEmailLabel')}
          />
          <button type="submit" className="generate-btn digest-save-btn">
            {digestSaved ? t('parent.saved') : t('parent.save')}
          </button>
        </form>
        <button className="hint-btn" onClick={previewDigest} style={{ marginTop: '12px' }}>
          {t('parent.preview')}
        </button>
        {digestError && <p className="form-error">{digestError}</p>}
      </div>

      <div className="section-card">
        <h2>
          <Settings size={20} /> {t('parent.settings')}
        </h2>
        <div className="settings-row">
          <label htmlFor="lang-select">{t('parent.language')}</label>
          <select id="lang-select" value={lang} onChange={e => setLang(e.target.value as Lang)}>
            {(Object.keys(LANGUAGE_NAMES) as Lang[]).map(code => (
              <option key={code} value={code}>
                {LANGUAGE_NAMES[code]}
              </option>
            ))}
          </select>
        </div>
        <div className="settings-row">
          <label htmlFor="curriculum-select">
            {t('parent.curriculum')}
            <span className="settings-note">{t('parent.curriculumNote')}</span>
          </label>
          <select
            id="curriculum-select"
            value={family?.curriculum ?? 'uk'}
            onChange={e => changeCurriculum(e.target.value as Curriculum)}
            disabled={curriculumBusy}
          >
            <option value="us">{t('setup.systemUS')}</option>
            <option value="uk">{t('setup.systemUK')}</option>
          </select>
        </div>
        <div className="settings-row">
          <label htmlFor="reading-font-toggle">
            {t('parent.readingFont')}
            <span className="settings-note">{t('parent.readingFontNote')}</span>
          </label>
          <button
            id="reading-font-toggle"
            role="switch"
            aria-checked={readingFont}
            className={`toggle-btn ${readingFont ? 'on' : ''}`}
            onClick={toggleReadingFont}
          >
            <span className="toggle-knob" />
          </button>
        </div>
      </div>

      <div className="section-card">
        <h2>
          <BookOpen size={20} /> {t('parent.how')}
        </h2>
        <p style={{ marginBottom: '12px' }}>{t('parent.how1')}</p>
        <p style={{ marginBottom: '12px' }}>{t('parent.how2')}</p>
        <p>{t('parent.how3')}</p>
      </div>

      {digestPreview && (
        <div className="digest-modal" role="dialog" aria-label={t('parent.digestModal')}>
          <div className="digest-modal-card">
            <button
              className="icon-btn digest-close"
              onClick={() => setDigestPreview(null)}
              aria-label={t('parent.closePreview')}
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
