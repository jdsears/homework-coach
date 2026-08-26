import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, AlertCircle, Heart, BookOpen } from 'lucide-react';

function ParentDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const response = await fetch('/api/parent/summary');
      if (!response.ok) {
        throw new Error(`Summary request failed (${response.status})`);
      }
      const summary = await response.json();
      setData(summary);
    } catch (error) {
      console.error('Error fetching summary:', error);
      setLoadError(true);
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

  if (loadError) {
    return (
      <div className="parent-dashboard">
        <header className="parent-header">
          <button className="parent-back-btn" onClick={() => navigate('/')}>
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

  const totalStruggles = data?.struggles
    ? Object.values(data.struggles).flat().length
    : 0;

  return (
    <div className="parent-dashboard">
      <header className="parent-header">
        <button className="parent-back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
        </button>
        <h1>📊 Parent Dashboard</h1>
      </header>

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
          <div className="stat-value">{data?.subjectBreakdown?.math || 0}</div>
          <div className="stat-label">Math</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data?.subjectBreakdown?.reading || 0}</div>
          <div className="stat-label">Reading</div>
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
