import { getParserBaseUrl } from "@/lib/env";
import { readError, upstreamFetch } from "@/lib/http";
import type { ParseResult, SiteInstruction } from "@/lib/types";

const PARSER_TIMEOUT_MS = 5 * 60 * 1000;

async function parserPost<T>(path: string, body: unknown): Promise<T> {
  const url = `${getParserBaseUrl()}${path}`;
  const res = await upstreamFetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    timeoutMs: PARSER_TIMEOUT_MS,
  });
  if (!res.ok) {
    throw new Error(`td-parser ${path}: ${await readError(res)}`);
  }
  return res.json() as Promise<T>;
}

export function fetchInstruction(url: string) {
  return parserPost<SiteInstruction>("/api/v1/instruction", { url });
}

export function parseProducts(url: string, instruction: SiteInstruction) {
  return parserPost<ParseResult>("/api/v1/parse", { url, instruction });
}
