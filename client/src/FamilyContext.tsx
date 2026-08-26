import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiJson } from './api';
import type { Child, Family, Persona } from './types';

interface FamilyValue {
  loading: boolean;
  family: Family | null;
  kids: Child[];
  personas: Persona[];
  activeChild: Child | null;
  selectChild: (id: string | null) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const FamilyContext = createContext<FamilyValue | null>(null);

const ACTIVE_CHILD_KEY = 'hc_active_child';

function readStoredChild(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CHILD_KEY) || null;
  } catch {
    return null;
  }
}

interface MeResponse {
  family: Family;
  children: Child[];
  personas?: Persona[];
  parentVerified: boolean;
}

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState<Family | null>(null);
  const [kids, setKids] = useState<Child[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(readStoredChild);

  const refresh = useCallback(async () => {
    try {
      const data = await apiJson<MeResponse>('/api/family/me');
      setFamily(data.family);
      setKids(data.children);
      setPersonas(data.personas || []);
    } catch {
      setFamily(null);
      setKids([]);
      setPersonas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectChild = useCallback((id: string | null) => {
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
      setPersonas([]);
      selectChild(null);
    }
  }, [selectChild]);

  const activeChild = kids.find(kid => kid.id === activeChildId) || null;

  return (
    <FamilyContext.Provider
      value={{ loading, family, kids, personas, activeChild, selectChild, refresh, signOut }}
    >
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily(): FamilyValue {
  const value = useContext(FamilyContext);
  if (!value) throw new Error('useFamily must be used inside FamilyProvider');
  return value;
}
