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
// image (optional): { media_type, data } - base64 without the data: prefix.
export async function streamChat({ childId, sessionId, subject, message, image, onMeta, onDelta }) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ childId, sessionId, subject, message, image }),
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

// Downscale a photo for the API: max ~1568px on the long edge is the sweet
// spot for Claude vision. Returns { media_type, data, previewUrl }.
export async function fileToApiImage(file, maxEdge = 1568) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const previewUrl = canvas.toDataURL('image/jpeg', 0.82);
  return { media_type: 'image/jpeg', data: previewUrl.split(',')[1], previewUrl };
}
