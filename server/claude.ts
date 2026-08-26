import Anthropic from '@anthropic-ai/sdk';
import type {
  AnthropicLike,
  FinalMessageLike,
  MessageStreamLike,
  ParseResultLike,
  UsageLike,
} from './types';

// Tutoring model - env-configurable, current generation by default.
export const CHAT_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';
// Fast model for classification, grading, and memory summaries.
export const FAST_MODEL = process.env.CLAUDE_FAST_MODEL || 'claude-haiku-4-5';
// Adaptive thinking is on by default on this tier; low effort keeps chat snappy
// while letting the model think when a problem actually needs it.
const CHAT_EFFORT = process.env.CLAUDE_EFFORT || 'low';

// Server-side refusal fallbacks exist on the Opus 5 / Fable 5 tier: if the
// primary model declines for safety reasons, the API retries the same request
// on a fallback model inside the same call.
const FALLBACKS_SUPPORTED = /^claude-(opus-5|fable-5)/.test(CHAT_MODEL);

type SystemPrompt = string | Array<Record<string, unknown>>;

interface ChatParams {
  system: SystemPrompt;
  messages: Array<Record<string, unknown>>;
  maxTokens?: number;
}

interface StructuredParams extends ChatParams {
  format: Record<string, unknown>;
  effort?: string;
}

export function createAnthropic(): AnthropicLike {
  // The SDK client satisfies the structural AnthropicLike surface we use.
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) as unknown as AnthropicLike;
}

export function streamChat(
  anthropic: AnthropicLike,
  { system, messages, maxTokens = 1024 }: ChatParams
): MessageStreamLike {
  const params = {
    model: CHAT_MODEL,
    max_tokens: maxTokens,
    system,
    messages,
    output_config: { effort: CHAT_EFFORT },
  };
  if (FALLBACKS_SUPPORTED) {
    return anthropic.beta.messages.stream({
      ...params,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  }
  return anthropic.messages.stream(params);
}

// Structured generation on the tutoring model (practice sets and similar).
export function parseStructured(
  anthropic: AnthropicLike,
  { system, messages, format, maxTokens = 2000, effort = 'medium' }: StructuredParams
): Promise<ParseResultLike> {
  return anthropic.messages.parse({
    model: CHAT_MODEL,
    max_tokens: maxTokens,
    system,
    messages,
    output_config: { format, effort },
  });
}

// Structured call on the fast model (classifier, answer grading, memory).
// Haiku 4.5 does not take output_config.effort, so none is sent.
export function fastParse(
  anthropic: AnthropicLike,
  { system, messages, format, maxTokens = 400 }: StructuredParams
): Promise<ParseResultLike> {
  return anthropic.messages.parse({
    model: FAST_MODEL,
    max_tokens: maxTokens,
    system,
    messages,
    output_config: { format },
  });
}

export function extractText(message: FinalMessageLike): string {
  return (message.content || [])
    .filter(block => block.type === 'text')
    .map(block => block.text || '')
    .join('');
}

export function totalInputTokens(usage: UsageLike = {}): number {
  return (
    (usage.input_tokens || 0) +
    (usage.cache_read_input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0)
  );
}
