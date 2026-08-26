import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiJson } from './api';

const FamilyContext = createContext(null);

const ACTIVE_CHILD_KEY = 'hc_active_child';

function readStoredChild() {
  try {
    return localStorage.getItem(ACTIVE_CHILD_KEY) || null;
  } catch {
    return null;
  }
}

export function FamilyProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState(null);
  const [kids, setKids] = useState([]);
  const [activeChildId, setActiveChildId] = useState(readStoredChild);

  const refresh = useCallback(async () => {
    try {
      const data = await apiJson('/api/family/me');
      setFamily(data.family);
      setKids(data.children);
    } catch {
      setFamily(null);
      setKids([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectChild = useCallback(id => {
    setActiveChildId(id);
    try {
      if (id) localStorage.setItem(ACTIVE_CHILD_KEY, id);
      else localStorage.removeItem(ACTIVE_CHILD_KEY);
    } catch {
      // localStorage unavailable - selection just won't survive a reload
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiJson('/api/family/logout', { method: 'POST' });
    } finally {
      setFamily(null);
      setKids([]);
      selectChild(null);
    }
  }, [selectChild]);

  const activeChild = kids.find(kid => kid.id === activeChildId) || null;

  return (
    <FamilyContext.Provider
      value={{ loading, family, kids, activeChild, selectChild, refresh, signOut }}
    >
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  return useContext(FamilyContext);
}
