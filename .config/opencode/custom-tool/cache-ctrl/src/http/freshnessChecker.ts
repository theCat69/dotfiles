export interface FreshnessCheckInput {
  url: string;
  etag?: string;
  last_modified?: string;
}

export interface FreshnessCheckOutput {
  url: string;
  status: "fresh" | "stale" | "error";
  http_status?: number;
  etag?: string;
  last_modified?: string;
  error?: string;
}

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function checkFreshness(input: FreshnessCheckInput): Promise<FreshnessCheckOutput> {
  if (!isAllowedUrl(input.url)) {
    return {
      url: input.url,
      status: "error",
      error: `Disallowed URL scheme — only http and https are permitted: ${input.url}`,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const headers: Record<string, string> = {};
    if (input.etag) {
      headers["If-None-Match"] = input.etag;
    }
    if (input.last_modified) {
      headers["If-Modified-Since"] = input.last_modified;
    }

    const response = await fetch(input.url, {
      method: "HEAD",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 304) {
      return {
        url: input.url,
        status: "fresh",
        http_status: 304,
      };
    }

    if (response.status === 200) {
      const etag = response.headers.get("etag") ?? undefined;
      const lastModified = response.headers.get("last-modified") ?? undefined;
      return {
        url: input.url,
        status: "stale",
        http_status: 200,
        etag,
        last_modified: lastModified,
      };
    }

    // 4xx/5xx
    return {
      url: input.url,
      status: "error",
      http_status: response.status,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const error = err as Error;
    return {
      url: input.url,
      status: "error",
      error: error.message,
    };
  }
}
