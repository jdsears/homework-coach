// Small fetch helpers shared by every screen.

export async function apiJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Something went wrong');
    error.friendly = Boolean(data.error);
    error.status = response.status;
    error.needPin = Boolean(data.needPin);
    error.needFamily = Boolean(data.needFamily);
    throw error;
  }
  return data;
}

// POST /api/chat and consume the Server-Sent Events stream.
// onMeta gets { sessionId, cheatDetected? } early; onDelta gets each text chunk.
export async function streamChat({ childId, sessionId, subject, message, onMeta, onDelta }) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ childId, sessionId, subject, message }),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('text/event-stream')) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error || 'Something went wrong');
    error.friendly = Boolean(data.error);
    error.needFamily = Boolean(data.needFamily);
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = {};

  const handleEvent = (event, payload) => {
    if (event === 'meta') {
      result = { ...result, ...payload };
      onMeta?.(payload);
    } else if (event === 'delta') {
      onDelta?.(payload.text);
    } else if (event === 'done') {
      result = { ...result, ...payload };
    } else if (event === 'error') {
      const error = new Error(payload.error || 'Something went wrong');
      error.friendly = true;
      throw error;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separator;
    while ((separator = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);

      let event = 'message';
      let data = '';
      for (const line of rawEvent.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      if (data) handleEvent(event, JSON.parse(data));
    }
  }

  return result;
}

export const gradeLabel = grade => (String(grade) === '3' ? '3rd' : `${grade}th`);
