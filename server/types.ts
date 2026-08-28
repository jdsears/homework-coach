// Shared row and boundary types for the server.

export interface FamilyRow {
  id: string;
  name: string;
  code: string;
  pin_hash: string;
  created_at: string;
  digest_email: string;
  curriculum: 'us' | 'uk';
}

export interface ChildRow {
  id: string;
  family_id: string;
  name: string;
  grade: string;
  created_at: string;
  memory: string;
  exam_board: string;
  course_notes: string;
}

export interface SessionRow {
  id: string;
  child_id: string;
  subject: string;
  started_at: string;
  last_active_at: string;
}

export type ChatRole = 'user' | 'assistant';

export interface MessageRow {
  id: number;
  session_id: string;
  role: ChatRole;
  content: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
  has_image: number;
}

export interface ProblemRow {
  id: number;
  child_id: string;
  subject: string;
  topic: string;
  difficulty: number;
  problem: string;
  hint: string;
  answer: string;
  explanation: string;
  created_at: string;
}

export interface MasteryRow {
  child_id: string;
  subject: string;
  topic: string;
  score: number;
  attempts: number;
  updated_at: string;
}

export interface ReviewRow {
  id: number;
  child_id: string;
  problem_id: number;
  due_at: string;
  interval_index: number;
  retired: number;
  created_at: string;
}

export interface PersonaRow {
  id: string;
  family_id: string;
  name: string;
  emoji: string;
  description: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Minimal structural view of the Anthropic client. The app only relies on this
// surface, which lets tests inject a lightweight fake.
// ---------------------------------------------------------------------------

export interface UsageLike {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface FinalMessageLike {
  content?: Array<{ type: string; text?: string }>;
  usage?: UsageLike;
  stop_reason?: string | null;
}

export interface MessageStreamLike {
  on(event: 'text', callback: (text: string) => void): unknown;
  finalMessage(): Promise<FinalMessageLike>;
}

export interface ParseResultLike {
  parsed_output: unknown;
  usage?: UsageLike;
}

export interface AnthropicLike {
  messages: {
    stream(params: Record<string, unknown>): MessageStreamLike;
    parse(params: Record<string, unknown>): Promise<ParseResultLike>;
  };
  beta: {
    messages: {
      stream(params: Record<string, unknown>): MessageStreamLike;
    };
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // Populated by the requireFamily middleware
      family: FamilyRow;
    }
  }
}
