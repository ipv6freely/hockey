import { fetchJson, FetchError } from "../../http/fetchJson.ts";
import { getAccessToken, forceRefresh } from "../../auth/yahooOAuth.ts";

const BASE = "https://fantasysports.yahooapis.com/fantasysports/v2";

/**
 * GET against the Yahoo Fantasy Sports API. `resourcePath` is anything after
 * the version segment, e.g. `/league/453.l.12345/teams`. See normalize.ts for
 * why the response needs the helpers there instead of a plain JSON shape.
 */
export async function yahooGet<T = unknown>(
  resourcePath: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const query = new URLSearchParams({ format: "json" });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) query.set(k, String(v));
  }
  const url = `${BASE}${resourcePath}?${query.toString()}`;

  // Yahoo's API is known to be stricter about requests with no User-Agent at
  // all (Node's fetch sends none by default) than about the header's actual
  // value — this is a defensive addition, not a spoofed browser identity.
  const doFetch = (token: string) =>
    fetchJson<T>(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "puck-advisor (+https://github.com/ipv6freely/hockey)",
      },
    });

  const token = await getAccessToken();
  try {
    return await doFetch(token);
  } catch (err) {
    // A token can expire between the freshness check in getAccessToken and
    // Yahoo actually seeing the request; retry once with a forced refresh
    // rather than surfacing an auth error for something transient.
    if (err instanceof FetchError && err.status === 401) {
      const refreshed = await forceRefresh();
      return await doFetch(refreshed);
    }
    throw err;
  }
}
