export interface HttpResult<T = unknown> {
  ok: boolean;
  status?: number;
  data?: T;
  text?: string;
  error?: string;
  latencyMs: number;
}

interface JsonRequestOptions {
  method?: string;
  token?: string;
  body?: unknown;
  timeoutMs?: number;
}

export async function requestJson<T = unknown>(url: string, options: JsonRequestOptions = {}): Promise<HttpResult<T>> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    let body: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    const response = await fetch(url, {
      method: options.method ?? (body ? 'POST' : 'GET'),
      headers,
      body,
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const raw = await response.text();
    const data = contentType.includes('application/json') && raw ? (JSON.parse(raw) as T) : undefined;

    return {
      ok: response.ok,
      status: response.status,
      data,
      text: raw,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}
