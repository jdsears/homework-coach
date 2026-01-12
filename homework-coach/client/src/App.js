import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, Users, Sparkles, FileQuestion, Languages } from 'lucide-react';
import SubjectSelect from './components/SubjectSelect';
import ChatRoom from './components/ChatRoom';
import ParentDashboard from './components/ParentDashboard';
import PracticeMode from './components/PracticeMode';
import QuizMode from './components/QuizMode';
import FlashcardMode from './components/FlashcardMode';
import './App.css';

function Navigation() {
  const location = useLocation();
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
    </nav>
  );
}

function App() {
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

export default App;
