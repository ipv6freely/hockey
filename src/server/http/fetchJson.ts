/** Small per-host concurrency gate so a burst of lookups doesn't hammer a single upstream. */
class HostGate {
  private active = new Map<string, number>();
  private queue = new Map<string, (() => void)[]>();
  private readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  async run<T>(host: string, fn: () => Promise<T>): Promise<T> {
    await this.acquire(host);
    try {
      return await fn();
    } finally {
      this.release(host);
    }
  }

  private acquire(host: string): Promise<void> {
    const active = this.active.get(host) ?? 0;
    if (active < this.limit) {
      this.active.set(host, active + 1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const q = this.queue.get(host) ?? [];
      q.push(resolve);
      this.queue.set(host, q);
    });
  }

  private release(host: string): void {
    const q = this.queue.get(host);
    if (q && q.length > 0) {
      const next = q.shift()!;
      next();
      return;
    }
    const active = this.active.get(host) ?? 1;
    this.active.set(host, Math.max(0, active - 1));
  }
}

const gate = new HostGate(4);

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  retries?: number;
  timeoutMs?: number;
}

export class FetchError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/** GET JSON with timeout, retry/backoff on 429/5xx/network errors, and a per-host concurrency cap. */
export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const host = new URL(url).host;
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 15_000;

  return gate.run(host, async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { headers: opts.headers, signal: controller.signal });
        if (!res.ok) {
          // Include the response body: for Yahoo specifically, a bare status
          // code has repeatedly not been enough to tell an OAuth/scope error
          // apart from a WAF-level block on the request itself — the body
          // usually says which.
          const text = await res.text().catch(() => "");
          throw new FetchError(`${url} -> HTTP ${res.status}${text ? `: ${text.slice(0, 500)}` : ""}`, res.status);
        }
        return (await res.json()) as T;
      } catch (err) {
        lastErr = err;
        if (attempt < retries) {
          const backoffMs = 300 * 2 ** attempt + Math.random() * 200;
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(`fetchJson failed: ${url}`);
  });
}

export interface PostJsonOptions extends FetchJsonOptions {
  body?: unknown;
}

/** POST JSON with the same retry/backoff policy as fetchJson. Used for the OpenAI API. */
export async function postJson<T>(url: string, opts: PostJsonOptions = {}): Promise<T> {
  const host = new URL(url).host;
  const retries = opts.retries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  return gate.run(host, async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...opts.headers },
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: controller.signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new FetchError(`${url} -> HTTP ${res.status} ${text}`, res.status);
        }
        return (await res.json()) as T;
      } catch (err) {
        lastErr = err;
        if (attempt < retries) {
          const backoffMs = 300 * 2 ** attempt + Math.random() * 200;
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(`postJson failed: ${url}`);
  });
}
