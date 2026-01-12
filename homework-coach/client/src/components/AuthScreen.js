import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Users, ArrowRight, AlertCircle, ChevronDown, ChevronUp, BookOpen, Brain, Shield, BarChart3 } from 'lucide-react';

function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAbout, setShowAbout] = useState(false);

  const { login, signup } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password, familyName);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-header">
        <div className="auth-mascot">⚡</div>
        <h1>Homework Hero</h1>
        <p>Level up your learning powers!</p>
      </div>

      <div className="auth-card">
        <div className="auth-tabs">
          <button
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(true); setError(''); }}
          >
            Log In
          </button>
          <button
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(false); setError(''); }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="familyName">
                <Users size={16} />
                Family Name
              </label>
              <input
                id="familyName"
                type="text"
                placeholder="The Smith Family"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">
              <Mail size={16} />
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="parent@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <Lock size={16} />
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder={isLogin ? 'Your password' : 'At least 6 characters'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            ) : (
              <>
                {isLogin ? 'Log In' : 'Create Account'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          {isLogin ? (
            <p>
              New to Homework Hero?{' '}
              <button onClick={() => setIsLogin(false)}>Create an account</button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button onClick={() => setIsLogin(true)}>Log in</button>
            </p>
          )}
        </div>
      </div>

      {/* Quick Features */}
      <div className="auth-features">
        <div className="feature">
          <span className="feature-icon">🥷</span>
          <span>AI Senseis guide your learning quest</span>
        </div>
        <div className="feature">
          <span className="feature-icon">⚔️</span>
          <span>Battle quizzes & earn achievements</span>
        </div>
        <div className="feature">
          <span className="feature-icon">🏆</span>
          <span>Track progress for each child</span>
        </div>
      </div>

      {/* Learn More Button */}
      <button
        className="about-toggle"
        onClick={() => setShowAbout(!showAbout)}
      >
        {showAbout ? 'Hide Details' : 'Learn More About Homework Hero'}
        {showAbout ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {/* Detailed Product Overview */}
      {showAbout && (
        <div className="about-section">
          <div className="about-card">
            <div className="about-icon">
              <BookOpen size={24} />
            </div>
            <h3>UK Curriculum Aligned</h3>
            <p>
              Covers <strong>Years 7-11</strong> across Maths, English, Science, Geography,
              History, French, and Spanish. Content follows the National Curriculum
              and GCSE specifications, perfect for homework help and exam revision.
            </p>
          </div>

          <div className="about-card">
            <div className="about-icon">
              <Brain size={24} />
            </div>
            <h3>Socratic Teaching Method</h3>
            <p>
              Our AI tutors don't just give answers — they guide students to discover
              solutions themselves through thoughtful questions. This builds genuine
              understanding and problem-solving skills that last.
            </p>
          </div>

          <div className="about-card">
            <div className="about-icon">
              <Shield size={24} />
            </div>
            <h3>Safe & Kid-Friendly</h3>
            <p>
              Designed specifically for children aged 11-16. Each child gets their
              own profile with personalised progress tracking. No ads, no distractions —
              just focused learning in a safe environment.
            </p>
          </div>

          <div className="about-card">
            <div className="about-icon">
              <BarChart3 size={24} />
            </div>
            <h3>Parent Dashboard</h3>
            <p>
              Monitor your children's learning journey. See quiz scores, identify
              areas needing extra practice, and track improvement over time.
              Get insights without hovering over their shoulder.
            </p>
          </div>

          <div className="about-modes">
            <h3>Learning Modes</h3>
            <div className="mode-grid">
              <div className="mode-item">
                <span className="mode-emoji">💬</span>
                <strong>Chat with AI Tutors</strong>
                <span>Ask questions, get step-by-step explanations</span>
              </div>
              <div className="mode-item">
                <span className="mode-emoji">📚</span>
                <strong>Lesson Mode</strong>
                <span>Learn new topics from scratch</span>
              </div>
              <div className="mode-item">
                <span className="mode-emoji">📸</span>
                <strong>Homework Review</strong>
                <span>Upload photos of homework for feedback</span>
              </div>
              <div className="mode-item">
                <span className="mode-emoji">⚔️</span>
                <strong>Quiz Battles</strong>
                <span>Test knowledge with instant feedback</span>
              </div>
              <div className="mode-item">
                <span className="mode-emoji">🃏</span>
                <strong>Flashcards</strong>
                <span>Master vocabulary and key facts</span>
              </div>
              <div className="mode-item">
                <span className="mode-emoji">✏️</span>
                <strong>Practice Problems</strong>
                <span>Generate unlimited practice questions</span>
              </div>
            </div>
          </div>

          <div className="about-free">
            <span className="free-badge">100% Free</span>
            <p>No payment required. No hidden costs. Just sign up and start learning!</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuthScreen;
