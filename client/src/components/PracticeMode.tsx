import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, RefreshCw, Lightbulb, Check, ArrowRight, Eye, Repeat } from 'lucide-react';
import CoachMarkdown from './CoachMarkdown';
import { apiJson, isApiError } from '../api';
import { useFamily } from '../FamilyContext';
import { useI18n, useGradeLabel, useSubjectName } from '../i18n';
import { EXAM_BOARD_LABELS, PAST_PAPER_URLS, type PracticeProblem } from '../types';
import { resolveSubjectId, visibleSubjectIds } from '../subjects';

interface GradeResponse {
  correct: boolean;
  feedback: string;
  explanation: string | null;
}

interface RevealResponse {
  answer: string;
  explanation: string;
}

function ProblemCard({
  item,
  index,
  total,
  onGraded,
  onSwapped,
}: {
  item: PracticeProblem;
  index: number;
  total: number;
  onGraded: (problemId: number, correct: boolean) => void;
  onSwapped: (problem: PracticeProblem) => void;
}) {
  const { t } = useI18n();
  const [answer, setAnswer] = useState('');
  const [hintShown, setHintShown] = useState(false);
  const [result, setResult] = useState<GradeResponse | null>(null);
  const [revealed, setRevealed] = useState<RevealResponse | null>(null);
  const [wrongTries, setWrongTries] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const settled = Boolean(revealed || result?.correct);
  const difficultyLabel =
    item.difficulty === 3
      ? t('practice.diff3')
      : item.difficulty === 2
        ? t('practice.diff2')
        : t('practice.diff1');

  const check = async (event: FormEvent) => {
    event.preventDefault();
    if (!answer.trim() || busy || settled) return;
    setBusy(true);
    setError('');
    try {
      const graded = await apiJson<GradeResponse>('/api/practice/answer', {
        method: 'POST',
        body: { problemId: item.id, answer: answer.trim() },
      });
      setResult(graded);
      if (graded.correct) onGraded(item.id, true);
      else setWrongTries(tries => tries + 1);
    } catch (err) {
      setError(isApiError(err) && err.friendly ? err.message : t('practice.checkFailed'));
    } finally {
      setBusy(false);
    }
  };

  const reveal = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await apiJson<RevealResponse>('/api/practice/reveal', {
        method: 'POST',
        body: { problemId: item.id },
      });
      setRevealed(data);
      onGraded(item.id, false);
    } catch (err) {
      setError(isApiError(err) && err.friendly ? err.message : t('practice.answerFailed'));
    } finally {
      setBusy(false);
    }
  };

  const similar = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await apiJson<{ problem: PracticeProblem }>('/api/practice/similar', {
        method: 'POST',
        body: { problemId: item.id },
      });
      onSwapped(data.problem);
    } catch (err) {
      setError(isApiError(err) && err.friendly ? err.message : t('practice.similarFailed'));
      setBusy(false);
    }
  };

  return (
    <div className="problem-card">
      <div className="problem-card-top">
        <span className="problem-count">
          {t('practice.problemCount', { i: index + 1, n: total })}
        </span>
        <span className="difficulty-chip">{difficultyLabel}</span>
      </div>

      <div className="problem-text">
        <CoachMarkdown>{item.problem}</CoachMarkdown>
      </div>

      {hintShown ? (
        <div className="hint-box">💡 {item.hint}</div>
      ) : (
        !settled && (
          <button className="hint-btn" onClick={() => setHintShown(true)}>
            <Lightbulb size={16} /> {t('practice.showHint')}
          </button>
        )
      )}

      {!settled && (
        <form className="answer-row" onSubmit={check}>
          <input
            type="text"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder={t('practice.answerPh')}
            maxLength={300}
            aria-label={t('practice.yourAnswer')}
          />
          <button
            type="submit"
            className="generate-btn check-btn"
            disabled={busy || !answer.trim()}
          >
            {busy ? <RefreshCw size={18} className="spinning" /> : <Check size={18} />}{' '}
            {t('practice.check')}
          </button>
        </form>
      )}

      {result && !result.correct && !revealed && (
        <div className="feedback-box incorrect">
          <CoachMarkdown>{result.feedback}</CoachMarkdown>
          {wrongTries >= 2 && (
            <button className="reveal-btn" onClick={reveal} disabled={busy}>
              <Eye size={16} /> {t('practice.showAnswer')}
            </button>
          )}
        </div>
      )}

      {result?.correct && (
        <div className="feedback-box correct">
          <strong>{t('practice.gotIt')}</strong>
          <CoachMarkdown>{result.feedback}</CoachMarkdown>
          {result.explanation && <CoachMarkdown>{result.explanation}</CoachMarkdown>}
        </div>
      )}

      {revealed && (
        <div className="feedback-box revealed">
          <strong>{t('practice.answerIs', { answer: revealed.answer })}</strong>
          <CoachMarkdown>{revealed.explanation}</CoachMarkdown>
        </div>
      )}

      {settled && (
        <button className="hint-btn" onClick={similar} disabled={busy}>
          <Repeat size={16} /> {t('practice.similar')}
        </button>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function PracticeMode() {
  const { family, activeChild } = useFamily();
  const { t } = useI18n();
  const gradeLabel = useGradeLabel();
  const subjectName = useSubjectName();
  const year = Number(activeChild?.grade ?? 0);
  const subjectIds = visibleSubjectIds(family?.curriculum, year);
  const examEligible = family?.curriculum === 'uk' && activeChild != null && year >= 10;
  // Arriving from the home screen's daily challenge preselects its subject
  const [searchParams] = useSearchParams();
  const askedSubject = searchParams.get('subject') ?? '';
  const [subject, setSubject] = useState(
    askedSubject ? resolveSubjectId(askedSubject, family?.curriculum, year) : 'math'
  );
  const [topic, setTopic] = useState(searchParams.get('topic') ?? '');
  const [examStyle, setExamStyle] = useState(false);
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [review, setReview] = useState<{ due: PracticeProblem[]; total: number } | null>(null);

  // Check for spaced-repetition reviews whenever the setup screen is visible
  useEffect(() => {
    let cancelled = false;
    if (!activeChild || (problems.length > 0 && !finished)) return undefined;
    apiJson<{ due: PracticeProblem[]; total: number }>(
      `/api/practice/review?childId=${activeChild.id}`
    )
      .then(data => {
        if (!cancelled) setReview(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeChild, problems.length, finished]);

  if (!activeChild) return null;

  const startReview = () => {
    if (!review?.due?.length) return;
    setProblems(review.due);
    setCurrent(0);
    setResults({});
    setFinished(false);
    setReview(null);
  };

  const generateProblems = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await apiJson<{ problems: PracticeProblem[] }>('/api/practice/generate', {
        method: 'POST',
        body: {
          childId: activeChild.id,
          subject,
          topic: topic || subject,
          examStyle: examEligible && examStyle,
        },
      });
      setProblems(data.problems);
      setCurrent(0);
      setResults({});
      setFinished(false);
    } catch (err) {
      setError(isApiError(err) && err.friendly ? err.message : t('practice.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const onGraded = (problemId: number, correct: boolean) => {
    setResults(prev => ({ ...prev, [problemId]: correct }));
  };

  const onSwapped = (newProblem: PracticeProblem) => {
    setProblems(prev => prev.map((p, i) => (i === current ? newProblem : p)));
  };

  const correctCount = Object.values(results).filter(Boolean).length;
  const answeredCurrent = problems[current] && results[problems[current].id] !== undefined;

  return (
    <div className="practice-mode">
      <header className="practice-header">
        <Sparkles size={40} />
        <h1>{t('practice.title')}</h1>
        <p>
          {t('practice.subtitle', { name: activeChild.name, grade: gradeLabel(activeChild.grade) })}
        </p>
      </header>

      {problems.length === 0 || finished ? (
        <>
          {review && review.total > 0 && (
            <button className="review-banner" onClick={startReview}>
              <span className="review-emoji">🔁</span>
              <span>
                <strong>{t('practice.reviewTitle')}</strong>{' '}
                {review.total === 1
                  ? t('practice.reviewOne')
                  : t('practice.reviewMany', { n: review.total })}
              </span>
            </button>
          )}
          {finished && (
            <div className="practice-card score-card">
              <div className="score-big">
                {correctCount} / {problems.length}
              </div>
              <p>
                {correctCount === problems.length
                  ? t('practice.perfect')
                  : correctCount > 0
                    ? t('practice.nice')
                    : t('practice.tough')}
              </p>
            </div>
          )}
          <div className="practice-card">
            <div className="practice-options">
              <div>
                <label htmlFor="practice-subject">{t('practice.subject')}</label>
                <select
                  id="practice-subject"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                >
                  {subjectIds.map(id => (
                    <option key={id} value={id}>
                      {subjectName(id)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="practice-topic">{t('practice.topic')}</label>
                <input
                  id="practice-topic"
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  maxLength={100}
                  placeholder={t('practice.topicPh')}
                />
              </div>

              {examEligible && (
                <div className="exam-style-row">
                  <button
                    type="button"
                    className={`tab-btn exam-style-btn ${examStyle ? 'active' : ''}`}
                    aria-pressed={examStyle}
                    onClick={() => setExamStyle(v => !v)}
                  >
                    {t('practice.examStyle')}
                  </button>
                  <span className="field-note">{t('practice.examStyleNote')}</span>
                  {activeChild.examBoard && PAST_PAPER_URLS[activeChild.examBoard] && (
                    <a
                      className="past-papers-link"
                      href={PAST_PAPER_URLS[activeChild.examBoard]}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('practice.pastPapers', {
                        board: EXAM_BOARD_LABELS[activeChild.examBoard],
                      })}
                    </a>
                  )}
                </div>
              )}
            </div>

            <button className="generate-btn" onClick={generateProblems} disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw size={20} className="spinning" /> {t('practice.generating')}
                </>
              ) : (
                <>
                  <Sparkles size={20} /> {finished ? t('practice.again') : t('practice.generate')}
                </>
              )}
            </button>
            {error && <p className="form-error">{error}</p>}
          </div>
        </>
      ) : (
        <>
          <ProblemCard
            key={problems[current].id}
            item={problems[current]}
            index={current}
            total={problems.length}
            onGraded={onGraded}
            onSwapped={onSwapped}
          />
          <div className="practice-nav">
            <span className="practice-score">
              {t('practice.rightSoFar', { n: correctCount })} {correctCount > 0 ? '🌟' : ''}
            </span>
            {current < problems.length - 1 ? (
              <button
                className="generate-btn next-btn"
                onClick={() => setCurrent(c => c + 1)}
                disabled={!answeredCurrent}
                title={answeredCurrent ? t('practice.next') : t('practice.tryFirst')}
              >
                {t('practice.next')} <ArrowRight size={18} />
              </button>
            ) : (
              <button
                className="generate-btn next-btn"
                onClick={() => setFinished(true)}
                disabled={!answeredCurrent}
              >
                {t('practice.finish')} <Check size={18} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default PracticeMode;
