import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, AlertCircle, Heart, BookOpen, Trophy, Target, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function ParentDashboard() {
  const navigate = useNavigate();
  const { children: familyChildren, family } = useAuth();
  const [data, setData] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState('all');

  useEffect(() => {
    fetchAllData();
  }, [selectedChildId]);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const childParam = selectedChildId !== 'all' ? `?childId=${selectedChildId}` : '';
      const headers = {
        credentials: 'include',
      };

      const [summaryRes, quizRes] = await Promise.all([
        fetch(`/api/parent/summary${childParam}`, { credentials: 'include' }),
        fetch(`/api/parent/quiz-summary${childParam}`, { credentials: 'include' })
      ]);
      const summary = await summaryRes.json();
      const quiz = await quizRes.json();
      setData(summary);
      setQuizData(quiz);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="parent-dashboard">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  const totalInteractions = data?.subjectBreakdown 
    ? Object.values(data.subjectBreakdown).reduce((a, b) => a + b, 0)
    : 0;

  const totalStruggles = data?.struggles
    ? Object.values(data.struggles).flat().length
    : 0;

  const selectedChild = familyChildren?.find(c => c.id === parseInt(selectedChildId));

  return (
    <div className="parent-dashboard">
      <header className="parent-header">
        <button className="parent-back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
        </button>
        <h1>📊 Parent Dashboard</h1>
      </header>

      {familyChildren?.length > 0 && (
        <div className="child-filter">
          <Users size={18} />
          <select
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
          >
            <option value="all">All Children</option>
            {familyChildren.map(child => (
              <option key={child.id} value={child.id}>
                {child.name} (Year {child.year_group})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-value">{data?.totalSessions || 0}</div>
          <div className="stat-label">Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalInteractions}</div>
          <div className="stat-label">Messages</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data?.subjectBreakdown?.maths || 0}</div>
          <div className="stat-label">Maths</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data?.subjectBreakdown?.english || 0}</div>
          <div className="stat-label">English</div>
        </div>
      </div>

      <div className="section-card">
        <h2><TrendingUp size={20} /> This Week's Activity</h2>
        {data?.subjectBreakdown && Object.entries(data.subjectBreakdown).some(([_, v]) => v > 0) ? (
          <div>
            {Object.entries(data.subjectBreakdown).map(([subject, count]) => (
              count > 0 && (
                <div key={subject} style={{ marginBottom: '8px' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{subject}:</strong> {count} interactions
                </div>
              )
            ))}
          </div>
        ) : (
          <p style={{ color: '#64748b' }}>No activity this week yet. Encourage your child to start a session!</p>
        )}
      </div>

      {quizData?.totalQuizzes > 0 && (
        <div className="section-card">
          <h2><Trophy size={20} /> Quiz Performance</h2>
          <div className="quiz-stats">
            <div className="quiz-stat-row">
              <span>Total Quizzes Taken:</span>
              <strong>{quizData.totalQuizzes}</strong>
            </div>
            <div className="quiz-stat-row">
              <span>Average Score:</span>
              <strong className={quizData.averageScore >= 60 ? 'good-score' : 'needs-work'}>
                {quizData.averageScore}%
              </strong>
            </div>
            {quizData.bestSubject && (
              <div className="quiz-stat-row">
                <span>Strongest Subject:</span>
                <strong style={{ textTransform: 'capitalize', color: '#10b981' }}>
                  {quizData.bestSubject}
                </strong>
              </div>
            )}
          </div>

          {quizData.recentResults?.length > 0 && (
            <div className="recent-quizzes">
              <h3 style={{ fontSize: '0.95rem', marginTop: '16px', marginBottom: '12px' }}>Recent Quizzes</h3>
              {quizData.recentResults.slice(0, 5).map((result, idx) => (
                <div key={idx} className={`quiz-result-item ${result.percentage >= 60 ? 'passed' : 'needs-review'}`}>
                  <div className="quiz-result-info">
                    <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{result.subject}</span>
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}> - {result.topic}</span>
                  </div>
                  <div className="quiz-result-score">
                    {result.score}/{result.total} ({result.percentage}%)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {quizData?.weakAreas?.length > 0 && (
        <div className="section-card">
          <h2><Target size={20} /> Areas to Focus On</h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '12px' }}>
            Based on quiz results, these topics need more practice:
          </p>
          <div className="weak-areas-list">
            {quizData.weakAreas.map((area, idx) => (
              <div key={idx} className="weak-area-item">
                <div className="weak-area-subject">{area.subject}</div>
                <div className="weak-area-topic">{area.topic}</div>
                <div className="weak-area-score">{area.avgScore}% avg</div>
              </div>
            ))}
          </div>
          <div className="weak-areas-tip">
            <p>💡 Encourage your child to take a lesson on these topics before retrying the quiz!</p>
          </div>
        </div>
      )}

      {totalStruggles > 0 && (
        <div className="section-card">
          <h2><AlertCircle size={20} /> Areas That Need Support</h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '12px' }}>
            These are moments where your child expressed difficulty or tried to skip the learning process.
          </p>
          {Object.entries(data.struggles).map(([subject, items]) => (
            items.length > 0 && (
              <div key={subject} style={{ marginBottom: '16px' }}>
                <h3 style={{ textTransform: 'capitalize', fontSize: '1rem', marginBottom: '8px' }}>
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
          ))}
        </div>
      )}

      <div className="section-card">
        <h2><Heart size={20} /> Tips for Parents</h2>
        <div className="encouragement-box">
          {data?.encouragement?.map((tip, idx) => (
            <p key={idx}>💡 {tip}</p>
          )) || (
            <p>💡 Great week! Your child is making steady progress. Keep up the encouragement!</p>
          )}
        </div>
      </div>

      <div className="section-card">
        <h2><BookOpen size={20} /> How It Works</h2>
        <p style={{ marginBottom: '12px' }}>
          Homework Coach uses the Socratic method - instead of giving answers directly, 
          it asks guiding questions to help your child discover solutions on their own.
        </p>
        <p style={{ marginBottom: '12px' }}>
          <strong>Cheat Detection:</strong> If your child asks for direct answers, 
          the coach gently redirects them back to learning.
        </p>
        <p>
          <strong>Progress Tracking:</strong> This dashboard shows you what subjects 
          they're working on and where they might need extra support.
        </p>
      </div>
    </div>
  );
}

export default ParentDashboard;
