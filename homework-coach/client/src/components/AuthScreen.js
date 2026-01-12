import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Mail, Lock, Users, ArrowRight, AlertCircle } from 'lucide-react';

function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
        <div className="auth-mascot">
          <BookOpen size={48} />
        </div>
        <h1>Homework Coach</h1>
        <p>Your friendly AI tutoring assistant</p>
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
              New to Homework Coach?{' '}
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

      <div className="auth-features">
        <div className="feature">
          <span className="feature-icon">🎓</span>
          <span>AI tutors using the Socratic method</span>
        </div>
        <div className="feature">
          <span className="feature-icon">👨‍👩‍👧‍👦</span>
          <span>Track each child's progress</span>
        </div>
        <div className="feature">
          <span className="feature-icon">🇬🇧</span>
          <span>Aligned with UK curriculum</span>
        </div>
      </div>
    </div>
  );
}

export default AuthScreen;
