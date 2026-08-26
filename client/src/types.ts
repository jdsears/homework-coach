// Shared client-side types mirroring the API.

export interface Family {
  id: string;
  name: string;
}

export interface Child {
  id: string;
  name: string;
  grade: string;
}

export interface Persona {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  earned: boolean;
}

export interface Progress {
  xp: number;
  level: number;
  intoLevel: number;
  levelSize: number;
  streak: number;
  activeDates: string[];
  badges: Badge[];
  challenge: {
    title: string;
    subject: string;
    topic: string;
    goal: number;
    progress: number;
    done: boolean;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  streaming?: boolean;
  imageUrl?: string;
  hadImage?: boolean;
}

export interface PracticeProblem {
  id: number;
  problem: string;
  hint: string;
  difficulty: number;
}

export interface RecentSession {
  id: string;
  subject: string;
  startedAt: string;
  lastActiveAt: string;
  messageCount: number;
  preview: string;
}

export interface ChildSummary extends Child {
  messageCount: number;
  practiceCount: number;
  minutes: number;
  strengths: string[];
  focusAreas: string[];
}

export interface ParentSummary {
  weekStart: string;
  weekEnd: string;
  familyName: string;
  familyCode: string;
  digestEmail: string;
  totalSessions: number;
  totalMinutes: number;
  subjectBreakdown: Record<string, number>;
  struggles: Record<string, Array<{ type: string; timestamp: string; subject: string }>>;
  children: ChildSummary[];
  dailyActivity: Array<{ date: string; messages: number; practice: number }>;
  encouragement: string[];
}
