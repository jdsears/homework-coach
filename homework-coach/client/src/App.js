import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, Users, Sparkles, FileQuestion, Languages, User } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthScreen from './components/AuthScreen';
import ProfileSelector from './components/ProfileSelector';
import SubjectSelect from './components/SubjectSelect';
import ChatRoom from './components/ChatRoom';
import ParentDashboard from './components/ParentDashboard';
import PracticeMode from './components/PracticeMode';
import QuizMode from './components/QuizMode';
import FlashcardMode from './components/FlashcardMode';
import './App.css';

function Navigation() {
  const location = useLocation();
  const { currentChild, selectChild } = useAuth();
  const isParentView = location.pathname === '/parent';
  const isChatView = location.pathname.startsWith('/chat');

  if (isParentView || isChatView) return null;

  return (
    <nav className="bottom-nav">
      <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
        <Home size={24} />
        <span>Home</span>
      </Link>
      <Link to="/quiz" className={`nav-item ${location.pathname === '/quiz' ? 'active' : ''}`}>
        <FileQuestion size={24} />
        <span>Quiz</span>
      </Link>
      <Link to="/flashcards" className={`nav-item ${location.pathname === '/flashcards' ? 'active' : ''}`}>
        <Languages size={24} />
        <span>Cards</span>
      </Link>
      <Link to="/practice" className={`nav-item ${location.pathname === '/practice' ? 'active' : ''}`}>
        <Sparkles size={24} />
        <span>Practice</span>
      </Link>
      <Link to="/parent" className="nav-item parent-link">
        <Users size={20} />
        <span>Parent</span>
      </Link>
      {currentChild && (
        <button
          className="nav-item profile-switch"
          onClick={() => selectChild(null)}
          title="Switch profile"
        >
          <User size={20} />
          <span>{currentChild.name.substring(0, 6)}</span>
        </button>
      )}
    </nav>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, currentChild } = useAuth();

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="app loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Show auth screen if not logged in
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // Show profile selector if no child selected
  if (!currentChild) {
    return <ProfileSelector />;
  }

  // Show main app
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<SubjectSelect />} />
          <Route path="/chat/:subject" element={<ChatRoom />} />
          <Route path="/practice" element={<PracticeMode />} />
          <Route path="/quiz" element={<QuizMode />} />
          <Route path="/flashcards" element={<FlashcardMode />} />
          <Route path="/parent" element={<ParentDashboard />} />
        </Routes>
        <Navigation />
      </div>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
