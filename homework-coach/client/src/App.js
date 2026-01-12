import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, Calculator, FlaskConical, Users, Sparkles } from 'lucide-react';
import SubjectSelect from './components/SubjectSelect';
import ChatRoom from './components/ChatRoom';
import ParentDashboard from './components/ParentDashboard';
import PracticeMode from './components/PracticeMode';
import './App.css';

function Navigation() {
  const location = useLocation();
  const isParentView = location.pathname === '/parent';

  if (isParentView) return null;

  return (
    <nav className="bottom-nav">
      <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
        <Home size={24} />
        <span>Home</span>
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
          <Route path="/parent" element={<ParentDashboard />} />
        </Routes>
        <Navigation />
      </div>
    </BrowserRouter>
  );
}

export default App;
