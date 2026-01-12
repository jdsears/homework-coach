import React, { useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';

function PracticeMode() {
  const [subject, setSubject] = useState('maths');
  const [year, setYear] = useState('9');
  const [topic, setTopic] = useState('');
  const [problems, setProblems] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const generateProblems = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, year, topic: topic || subject }),
      });
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
              <option value="maths">Maths</option>
              <option value="english">English</option>
              <option value="science">Science</option>
              <option value="geography">Geography</option>
              <option value="history">History</option>
              <option value="french">French</option>
              <option value="spanish">Spanish</option>
            </select>
          </div>

          <div>
            <label>Year</label>
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="7">Year 7</option>
              <option value="8">Year 8</option>
              <option value="9">Year 9</option>
              <option value="10">Year 10</option>
              <option value="11">Year 11</option>
            </select>
          </div>

          <div>
            <label>Topic (optional)</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
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
          {problems}
        </div>
      )}
    </div>
  );
}

export default PracticeMode;
