const Anthropic = require('@anthropic-ai/sdk');

// Tutoring model - env-configurable, current generation by default.
const CHAT_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';
// Adaptive thinking is on by default on this tier; low effort keeps chat snappy
// while letting the model think when a problem actually needs it.
const CHAT_EFFORT = process.env.CLAUDE_EFFORT || 'low';

// Server-side refusal fallbacks exist on the Opus 5 / Fable 5 tier: if the
// primary model declines for safety reasons, the API retries the same request
// on a fallback model inside the same call.
const FALLBACKS_SUPPORTED = /^claude-(opus-5|fable-5)/.test(CHAT_MODEL);

function createAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function streamChat(anthropic, { system, messages, maxTokens = 1024 }) {
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

async function createCompletion(
  anthropic,
  { system, messages, maxTokens = 1500, effort = 'medium' }
) {
  return anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: maxTokens,
    system,
    messages,
    output_config: { effort },
  });
}

function extractText(message) {
  return (message.content || [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');
}

function totalInputTokens(usage = {}) {
  return (
    (usage.input_tokens || 0) +
    (usage.cache_read_input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0)
  );
}

module.exports = {
  CHAT_MODEL,
  createAnthropic,
  streamChat,
  createCompletion,
  extractText,
  totalInputTokens,
};
