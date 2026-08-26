import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, Users, Sparkles } from 'lucide-react';
import { FamilyProvider, useFamily } from './FamilyContext';
import SubjectSelect from './components/SubjectSelect';
import ChatRoom from './components/ChatRoom';
import ParentDashboard from './components/ParentDashboard';
import PracticeMode from './components/PracticeMode';
import FamilySetup from './components/FamilySetup';
import ChildPicker from './components/ChildPicker';
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
      <Link
        to="/practice"
        className={`nav-item ${location.pathname === '/practice' ? 'active' : ''}`}
      >
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

function Gate() {
  const location = useLocation();
  const { loading, family, activeChild } = useFamily();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!family) return <FamilySetup />;

  // The parent dashboard works without picking a kid (it's where kids get added)
  if (!activeChild && location.pathname !== '/parent') return <ChildPicker />;

  return (
    <>
      <Routes>
        <Route path="/" element={<SubjectSelect />} />
        <Route path="/chat/:subject" element={<ChatRoom />} />
        <Route path="/practice" element={<PracticeMode />} />
        <Route path="/parent" element={<ParentDashboard />} />
      </Routes>
      <Navigation />
    </>
  );
}

function App() {
  return (
    <FamilyProvider>
      <BrowserRouter>
        <div className="app">
          <Gate />
        </div>
      </BrowserRouter>
    </FamilyProvider>
  );
}

export default App;
