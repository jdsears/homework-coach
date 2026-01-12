import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children: reactChildren }) {
  const [family, setFamily] = useState(null);
  const [childProfiles, setChildProfiles] = useState([]);
  const [currentChild, setCurrentChild] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setFamily(data.family);
        setChildProfiles(data.children);

        // Restore selected child from localStorage
        const savedChildId = localStorage.getItem('currentChildId');
        if (savedChildId) {
          const child = data.children.find(c => c.id === parseInt(savedChildId));
          if (child) {
            setCurrentChild(child);
          }
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email, password, familyName) => {
    setError(null);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, familyName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      setFamily(data.family);
      setChildProfiles([]);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const login = async (email, password) => {
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setFamily(data.family);
      setChildProfiles(data.children);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout error:', err);
    }

    setFamily(null);
    setChildProfiles([]);
    setCurrentChild(null);
    localStorage.removeItem('currentChildId');
  };

  const selectChild = (child) => {
    setCurrentChild(child);
    if (child) {
      localStorage.setItem('currentChildId', child.id.toString());
    } else {
      localStorage.removeItem('currentChildId');
    }
  };

  const addChild = async (name, yearGroup, avatar) => {
    try {
      const response = await fetch('/api/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, yearGroup, avatar }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add child');
      }

      setChildProfiles(prev => [...prev, data]);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateChild = async (childId, updates) => {
    try {
      const response = await fetch(`/api/children/${childId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update child');
      }

      setChildProfiles(prev => prev.map(c => c.id === childId ? data : c));
      if (currentChild?.id === childId) {
        setCurrentChild(data);
      }
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteChild = async (childId) => {
    try {
      const response = await fetch(`/api/children/${childId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete child');
      }

      setChildProfiles(prev => prev.filter(c => c.id !== childId));
      if (currentChild?.id === childId) {
        setCurrentChild(null);
        localStorage.removeItem('currentChildId');
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const value = {
    family,
    children: childProfiles,
    currentChild,
    isLoading,
    error,
    isAuthenticated: !!family,
    signup,
    login,
    logout,
    selectChild,
    addChild,
    updateChild,
    deleteChild,
    clearError: () => setError(null),
  };

  return (
    <AuthContext.Provider value={value}>
      {reactChildren}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
