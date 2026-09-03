import { Agent } from "undici";

const insecureDispatcher = new Agent({
  connect: { rejectUnauthorized: false },
});

export function parsePagination(
  searchParams: URLSearchParams,
  defaultLimit = 20,
) {
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0);
  const raw = Number(searchParams.get("limit") ?? defaultLimit) || defaultLimit;
  const limit = Math.min(100, Math.max(1, raw));
  return { offset, limit };
}

export function normalizeSiteUrl(website: string) {
  const trimmed = website.trim();
  if (!trimmed) {
    throw new Error("У производителя нет сайта");
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export async function upstreamFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
) {
  const { timeoutMs = 30_000, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    cache: "no-store",
    signal: rest.signal ?? AbortSignal.timeout(timeoutMs),
    // @ts-expect-error Node fetch accepts undici dispatcher
    dispatcher: insecureDispatcher,
  });
  return res;
}

export async function readError(res: Response) {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { detail?: unknown; error?: string };
    if (typeof body.error === "string" && body.error) {
      return body.error;
    }
    if (typeof body.detail === "string" && body.detail) {
      return body.detail;
    }
    if (Array.isArray(body.detail)) {
      return body.detail
        .map((item) =>
          typeof item === "object" && item && "msg" in item
            ? String((item as { msg: string }).msg)
            : JSON.stringify(item),
        )
        .join("; ");
    }
  } catch {
    /* not JSON */
  }
  const snippet = text.replace(/\s+/g, " ").slice(0, 180);
  return snippet || `HTTP ${res.status}`;
}
