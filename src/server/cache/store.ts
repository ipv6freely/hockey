import fs from "node:fs/promises";
import path from "node:path";
import { cacheDir } from "../config.ts";

interface Meta {
  fetchedAt: string;
  ttlMs: number;
}

function pathsFor(source: string, key: string) {
  const dir = path.join(cacheDir, source);
  const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, "_");
  return {
    dir,
    dataPath: path.join(dir, `${safeKey}.json`),
    metaPath: path.join(dir, `${safeKey}.meta.json`),
  };
}

async function readMeta(metaPath: string): Promise<Meta | null> {
  try {
    return JSON.parse(await fs.readFile(metaPath, "utf8")) as Meta;
  } catch {
    return null;
  }
}

async function atomicWrite(filePath: string, contents: string): Promise<void> {
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, contents, "utf8");
  await fs.rename(tmp, filePath);
}

export interface CacheEntry<T> {
  value: T;
  stale: boolean;
  fetchedAt: string;
}

/**
 * Fresh-or-cached read with stale-while-error: if `fetch` throws and a
 * previous value exists on disk (of any age), that value is returned with
 * `stale: true` rather than propagating the failure. Yahoo's API and
 * OpenAI both have real rate limits; this is what keeps a burst of tab
 * switches from re-hitting either on every click.
 */
export async function readThrough<T>(
  source: string,
  key: string,
  ttlMs: number,
  fetchFresh: () => Promise<T>,
): Promise<CacheEntry<T>> {
  const { dir, dataPath, metaPath } = pathsFor(source, key);
  const meta = await readMeta(metaPath);
  const isFresh = meta !== null && Date.now() - Date.parse(meta.fetchedAt) < ttlMs;

  if (isFresh) {
    try {
      const value = JSON.parse(await fs.readFile(dataPath, "utf8")) as T;
      return { value, stale: false, fetchedAt: meta!.fetchedAt };
    } catch {
      // fall through to refetch
    }
  }

  try {
    const value = await fetchFresh();
    await fs.mkdir(dir, { recursive: true });
    const fetchedAt = new Date().toISOString();
    await atomicWrite(dataPath, JSON.stringify(value));
    await atomicWrite(metaPath, JSON.stringify({ fetchedAt, ttlMs } satisfies Meta));
    return { value, stale: false, fetchedAt };
  } catch (err) {
    try {
      const value = JSON.parse(await fs.readFile(dataPath, "utf8")) as T;
      return { value, stale: true, fetchedAt: meta?.fetchedAt ?? "unknown" };
    } catch {
      throw err;
    }
  }
}
