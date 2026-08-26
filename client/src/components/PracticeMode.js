import React, { useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Split the generated text into text segments and hidden hints.
// Hint lines arrive from the server marked with a leading [HINT].
function parseProblemText(text) {
  const segments = [];
  let current = [];
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('[HINT]')) {
      if (current.length) {
        segments.push({ type: 'text', content: current.join('\n') });
        current = [];
      }
      segments.push({ type: 'hint', content: line.trim().replace(/^\[HINT\]\s*/, '') });
    } else {
      current.push(line);
    }
  }
  if (current.length) {
    segments.push({ type: 'text', content: current.join('\n') });
  }
  return segments;
}

function Hint({ text }) {
  const [revealed, setRevealed] = useState(false);

  if (!revealed) {
    return (
      <button className="hint-btn" onClick={() => setRevealed(true)}>
        💡 Show hint
      </button>
    );
  }
  return <div className="hint-box">💡 {text}</div>;
}

function PracticeMode() {
  const [subject, setSubject] = useState('math');
  const [grade, setGrade] = useState('5');
  const [topic, setTopic] = useState('');
  const [problems, setProblems] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const generateProblems = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, grade, topic: topic || subject }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Could not generate problems');
      }
      const data = await response.json();
      setProblems(data.problems);
    } catch (error) {
      console.error('Error:', error);
      setProblems('Oops! Could not generate problems. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="practice-mode">
      <header className="practice-header">
        <Sparkles size={40} />
        <h1>Practice Time!</h1>
        <p>Get custom problems to sharpen your skills</p>
      </header>

      <div className="practice-card">
        <div className="practice-options">
          <div>
            <label>Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
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
            <label>Grade</label>
            <select value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="3">3rd Grade</option>
              <option value="4">4th Grade</option>
              <option value="5">5th Grade</option>
              <option value="6">6th Grade</option>
              <option value="7">7th Grade</option>
              <option value="8">8th Grade</option>
            </select>
          </div>

          <div>
            <label>Topic (optional)</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={100}
              placeholder="e.g., fractions, vocabulary, ecosystems..."
            />
          </div>
        </div>

        <button
          className="generate-btn"
          onClick={generateProblems}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <RefreshCw size={20} className="spinning" /> Generating...
            </>
          ) : (
            <>
              <Sparkles size={20} /> Generate Practice Problems
            </>
          )}
        </button>
      </div>

      {problems && (
        <div className="problems-container">
          <h3>📝 Your Practice Problems</h3>
          {parseProblemText(problems).map((segment, idx) =>
            segment.type === 'hint' ? (
              <Hint key={idx} text={segment.content} />
            ) : (
              <ReactMarkdown key={idx}>{segment.content}</ReactMarkdown>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default PracticeMode;
