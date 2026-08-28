// Shared client-side types mirroring the API.

export type Curriculum = 'us' | 'uk';

// Grades are stored as plain numbers; the curriculum decides how they read
// ("5" → "5th grade" or "Year 5") and which ones are on offer.
export const GRADE_SETS: Record<Curriculum, string[]> = {
  us: ['3', '4', '5', '6', '7', '8'],
  uk: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'],
};

export interface Family {
  id: string;
  name: string;
  curriculum: Curriculum;
}

export interface Child {
  id: string;
  name: string;
  grade: string;
  examBoard: string;
  courseNotes: string;
}

// GCSE/A-level exam boards ('' = not set) and where their real past papers live.
export const EXAM_BOARDS = ['aqa', 'edexcel', 'ocr', 'wjec'] as const;
export const EXAM_BOARD_LABELS: Record<string, string> = {
  aqa: 'AQA',
  edexcel: 'Pearson Edexcel',
  ocr: 'OCR',
  wjec: 'WJEC Eduqas',
};
export const PAST_PAPER_URLS: Record<string, string> = {
  aqa: 'https://www.aqa.org.uk/find-past-papers-and-mark-schemes',
  edexcel: 'https://qualifications.pearson.com/en/support/support-topics/exams/past-papers.html',
  ocr: 'https://www.ocr.org.uk/qualifications/past-paper-finder/',
  wjec: 'https://www.eduqas.co.uk/home/past-papers/',
};

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
