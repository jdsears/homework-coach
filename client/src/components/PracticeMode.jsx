import { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, Lightbulb, Check, ArrowRight, Eye, Repeat } from 'lucide-react';
import CoachMarkdown from './CoachMarkdown';
import { apiJson, gradeLabel } from '../api';
import { useFamily } from '../FamilyContext';

const DIFFICULTY_LABELS = { 1: '★☆☆ warm-up', 2: '★★☆ practice', 3: '★★★ stretch' };

function ProblemCard({ item, index, total, onGraded, onSwapped }) {
  const [answer, setAnswer] = useState('');
  const [hintShown, setHintShown] = useState(false);
  const [result, setResult] = useState(null); // {correct, feedback, explanation}
  const [revealed, setRevealed] = useState(null); // {answer, explanation}
  const [wrongTries, setWrongTries] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const settled = revealed || result?.correct;

  const check = async event => {
    event.preventDefault();
    if (!answer.trim() || busy || settled) return;
    setBusy(true);
    setError('');
    try {
      const graded = await apiJson('/api/practice/answer', {
        method: 'POST',
        body: { problemId: item.id, answer: answer.trim() },
      });
      setResult(graded);
      if (graded.correct) onGraded(item.id, true);
      else setWrongTries(tries => tries + 1);
    } catch (err) {
      setError(err.friendly ? err.message : 'Could not check that answer - try again!');
    } finally {
      setBusy(false);
    }
  };

  const reveal = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await apiJson('/api/practice/reveal', {
        method: 'POST',
        body: { problemId: item.id },
      });
      setRevealed(data);
      onGraded(item.id, false);
    } catch (err) {
      setError(err.friendly ? err.message : 'Could not fetch the answer - try again!');
    } finally {
      setBusy(false);
    }
  };

  const similar = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await apiJson('/api/practice/similar', {
        method: 'POST',
        body: { problemId: item.id },
      });
      onSwapped(data.problem);
    } catch (err) {
      setError(err.friendly ? err.message : 'Could not make a similar one - try again!');
      setBusy(false);
    }
  };

  return (
    <div className="problem-card">
      <div className="problem-card-top">
        <span className="problem-count">
          Problem {index + 1} of {total}
        </span>
        <span className="difficulty-chip">{DIFFICULTY_LABELS[item.difficulty] || '★☆☆'}</span>
      </div>

      <div className="problem-text">
        <CoachMarkdown>{item.problem}</CoachMarkdown>
      </div>

      {hintShown ? (
        <div className="hint-box">💡 {item.hint}</div>
      ) : (
        !settled && (
          <button className="hint-btn" onClick={() => setHintShown(true)}>
            <Lightbulb size={16} /> Show hint
          </button>
        )
      )}

      {!settled && (
        <form className="answer-row" onSubmit={check}>
          <input
            type="text"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Type your answer..."
            maxLength={300}
            aria-label="Your answer"
          />
          <button
            type="submit"
            className="generate-btn check-btn"
            disabled={busy || !answer.trim()}
          >
            {busy ? <RefreshCw size={18} className="spinning" /> : <Check size={18} />} Check
          </button>
        </form>
      )}

      {result && !result.correct && !revealed && (
        <div className="feedback-box incorrect">
          <CoachMarkdown>{result.feedback}</CoachMarkdown>
          {wrongTries >= 2 && (
            <button className="reveal-btn" onClick={reveal} disabled={busy}>
              <Eye size={16} /> Show me the answer
            </button>
          )}
        </div>
      )}

      {result?.correct && (
        <div className="feedback-box correct">
          <strong>🎉 You got it!</strong>
          <CoachMarkdown>{result.feedback}</CoachMarkdown>
          {result.explanation && <CoachMarkdown>{result.explanation}</CoachMarkdown>}
        </div>
      )}

      {revealed && (
        <div className="feedback-box revealed">
          <strong>The answer is: {revealed.answer}</strong>
          <CoachMarkdown>{revealed.explanation}</CoachMarkdown>
        </div>
      )}

      {settled && (
        <button className="hint-btn" onClick={similar} disabled={busy}>
          <Repeat size={16} /> Give me a similar one
        </button>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function PracticeMode() {
  const { activeChild } = useFamily();
  const [subject, setSubject] = useState('math');
  const [topic, setTopic] = useState('');
  const [problems, setProblems] = useState([]);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState({}); // problemId -> boolean
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [review, setReview] = useState(null); // { due, total }

  // Check for spaced-repetition reviews whenever the setup screen is visible
  useEffect(() => {
    let cancelled = false;
    if (!activeChild || (problems.length > 0 && !finished)) return undefined;
    apiJson(`/api/practice/review?childId=${activeChild.id}`)
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
    setProblems(
      review.due.map(problem => ({
        id: problem.id,
        problem: problem.problem,
        hint: problem.hint,
        difficulty: problem.difficulty,
      }))
    );
    setCurrent(0);
    setResults({});
    setFinished(false);
    setReview(null);
  };

  const generateProblems = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await apiJson('/api/practice/generate', {
        method: 'POST',
        body: { childId: activeChild.id, subject, topic: topic || subject },
      });
      setProblems(data.problems);
      setCurrent(0);
      setResults({});
      setFinished(false);
    } catch (err) {
      setError(err.friendly ? err.message : 'Oops! Could not generate problems. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onGraded = (problemId, correct) => {
    setResults(prev => ({ ...prev, [problemId]: correct }));
  };

  const onSwapped = newProblem => {
    setProblems(prev => prev.map((p, i) => (i === current ? newProblem : p)));
  };

  const correctCount = Object.values(results).filter(Boolean).length;
  const answeredCurrent = problems[current] && results[problems[current].id] !== undefined;

  return (
    <div className="practice-mode">
      <header className="practice-header">
        <Sparkles size={40} />
        <h1>Practice Time!</h1>
        <p>
          Custom problems for {activeChild.name} · {gradeLabel(activeChild.grade)} grade
        </p>
      </header>

      {problems.length === 0 || finished ? (
        <>
          {review?.total > 0 && (
            <button className="review-banner" onClick={startReview}>
              <span className="review-emoji">🔁</span>
              <span>
                <strong>Review time!</strong> {review.total} problem
                {review.total === 1 ? '' : 's'} from before {review.total === 1 ? 'is' : 'are'}{' '}
                ready for another try.
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
                  ? 'Perfect round! 🌟 Want to try something harder?'
                  : correctCount > 0
                    ? 'Nice work! Every problem you try makes you stronger. 💪'
                    : "Tough round - that's how learning feels sometimes. Let's try again! 🌱"}
              </p>
            </div>
          )}
          <div className="practice-card">
            <div className="practice-options">
              <div>
                <label htmlFor="practice-subject">Subject</label>
                <select
                  id="practice-subject"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                >
                  <option value="math">Math</option>
                  <option value="reading">Reading & Writing</option>
                  <option value="science">Science</option>
                  <option value="geography">Geography</option>
                  <option value="history">History</option>
                  <option value="french">French</option>
                  <option value="spanish">Spanish</option>
                </select>
              </div>

              <div>
                <label htmlFor="practice-topic">Topic (optional)</label>
                <input
                  id="practice-topic"
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  maxLength={100}
                  placeholder="e.g., fractions, vocabulary, ecosystems..."
                />
              </div>
            </div>

            <button className="generate-btn" onClick={generateProblems} disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw size={20} className="spinning" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles size={20} />{' '}
                  {finished ? 'Practice again' : 'Generate Practice Problems'}
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
              {correctCount} right so far {correctCount > 0 ? '🌟' : ''}
            </span>
            {current < problems.length - 1 ? (
              <button
                className="generate-btn next-btn"
                onClick={() => setCurrent(c => c + 1)}
                disabled={!answeredCurrent}
                title={answeredCurrent ? 'Next problem' : 'Give this one a try first!'}
              >
                Next <ArrowRight size={18} />
              </button>
            ) : (
              <button
                className="generate-btn next-btn"
                onClick={() => setFinished(true)}
                disabled={!answeredCurrent}
              >
                Finish <Check size={18} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default PracticeMode;
