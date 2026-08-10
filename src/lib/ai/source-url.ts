const TRACKING_QUERY_PARAMETERS = new Set([
  "dclid",
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "utm_campaign",
  "utm_content",
  "utm_id",
  "utm_medium",
  "utm_source",
  "utm_term",
]);

/**
 * Normalizes source URLs for evidence and duplicate checks without erasing
 * query parameters that identify the content itself (for example YouTube's
 * `v` parameter). Only explicitly recognized analytics parameters are dropped.
 */
export function canonicalSourceUrl(value: string) {
  try {
    const url = new URL(value);
    for (const key of Array.from(url.searchParams.keys())) {
      if (TRACKING_QUERY_PARAMETERS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const query = url.searchParams.toString();
    return `${url.protocol}//${url.host}${path}${query ? `?${query}` : ""}`;
  } catch {
    return value;
  }
}
