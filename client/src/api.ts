// Small fetch helpers shared by every screen.

export interface ApiError extends Error {
  friendly: boolean;
  status?: number;
  needPin?: boolean;
  needFamily?: boolean;
}

function makeError(
  data: { error?: string; needPin?: boolean; needFamily?: boolean },
  status?: number
): ApiError {
  const error = new Error(data.error || 'Something went wrong') as ApiError;
  error.friendly = Boolean(data.error);
  error.status = status;
  error.needPin = Boolean(data.needPin);
  error.needFamily = Boolean(data.needFamily);
  return error;
}

interface JsonOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiJson<T = unknown>(path: string, options: JsonOptions = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method,
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw makeError(data as { error?: string }, response.status);
  }
  return data as T;
}

export interface ChatImagePayload {
  media_type: string;
  data: string;
}

export interface StreamMeta {
  sessionId?: string;
  cheatDetected?: boolean;
}

// POST /api/chat and consume the Server-Sent Events stream.
// onMeta gets { sessionId, cheatDetected? } early; onDelta gets each text chunk.
export async function streamChat({
  childId,
  sessionId,
  subject,
  message,
  image,
  onMeta,
  onDelta,
}: {
  childId: string;
  sessionId: string | null;
  subject: string;
  message: string;
  image?: ChatImagePayload;
  onMeta?: (meta: StreamMeta) => void;
  onDelta?: (text: string) => void;
}): Promise<StreamMeta> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ childId, sessionId, subject, message, image }),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('text/event-stream')) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw makeError(data, response.status);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: StreamMeta = {};

  const handleEvent = (event: string, payload: Record<string, unknown>) => {
    if (event === 'meta') {
      result = { ...result, ...payload };
      onMeta?.(payload as StreamMeta);
    } else if (event === 'delta') {
      onDelta?.(String(payload.text ?? ''));
    } else if (event === 'done') {
      result = { ...result, ...payload };
    } else if (event === 'error') {
      const error = new Error(String(payload.error || 'Something went wrong')) as ApiError;
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
      if (data) handleEvent(event, JSON.parse(data) as Record<string, unknown>);
    }
  }

  return result;
}

export interface ApiImage extends ChatImagePayload {
  previewUrl: string;
}

// Downscale a photo for the API: max ~1568px on the long edge is the sweet
// spot for Claude vision. Returns { media_type, data, previewUrl }.
export async function fileToApiImage(file: File, maxEdge = 1568): Promise<ApiImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const previewUrl = canvas.toDataURL('image/jpeg', 0.82);
  return { media_type: 'image/jpeg', data: previewUrl.split(',')[1], previewUrl };
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && 'friendly' in error;
}
