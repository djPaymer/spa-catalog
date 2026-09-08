import { NextResponse } from "next/server";
import { getParserBaseUrl } from "@/lib/env";
import { readError, upstreamFetch } from "@/lib/http";
import type {
  InstructionSummary,
  ParseResult,
  SiteInstruction,
  StoredInstruction,
} from "@/lib/types";

const PARSER_TIMEOUT_MS = 5 * 60 * 1000;

export class ParserError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ParserError";
  }
}

export function userParserMessage(status: number, detail: string) {
  if (status === 400) {
    return /instruction/i.test(detail)
      ? "Передайте instruction"
      : "Некорректный URL";
  }
  if (status === 404) return "Сначала соберите инструкцию";
  if (status === 422) return detail;
  if (status === 502) return detail;
  if (status === 503) return "Сервис не настроен";
  if (status >= 500) return "Повторите позже";
  return detail;
}

export function isTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

export function jsonParserError(error: unknown) {
  if (isTimeoutError(error)) {
    return NextResponse.json({ error: "Повторите позже" }, { status: 504 });
  }
  if (error instanceof ParserError) {
    return NextResponse.json(
      { error: userParserMessage(error.status, error.message) },
      { status: error.status },
    );
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  if (message === "У производителя нет сайта") {
    return NextResponse.json({ error: "Некорректный URL" }, { status: 400 });
  }
  return NextResponse.json({ error: message }, { status: 502 });
}

async function parserFetch<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const url = `${getParserBaseUrl()}${path}`;
  let res: Response;
  try {
    res = await upstreamFetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      timeoutMs: init.timeoutMs ?? PARSER_TIMEOUT_MS,
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new ParserError(504, "Повторите позже");
    }
    throw error;
  }

  if (res.status === 204) {
    return undefined as T;
  }
  if (!res.ok) {
    throw new ParserError(res.status, await readError(res));
  }
  return res.json() as Promise<T>;
}

export function fetchInstruction(url: string, refresh = false) {
  return parserFetch<SiteInstruction>("/api/v1/instruction", {
    method: "POST",
    body: JSON.stringify({ url, refresh }),
  });
}

export function parseProducts(url: string, instruction?: SiteInstruction) {
  return parserFetch<ParseResult>("/api/v1/parse", {
    method: "POST",
    body: JSON.stringify(instruction ? { url, instruction } : { url }),
  });
}

export function listInstructions() {
  return parserFetch<InstructionSummary[]>("/api/v1/instructions", {
    method: "GET",
    timeoutMs: 30_000,
  });
}

export function getStoredInstruction(host: string) {
  return parserFetch<StoredInstruction>(
    `/api/v1/instructions/${encodeURIComponent(host)}`,
    { method: "GET", timeoutMs: 30_000 },
  );
}

export function saveInstruction(
  host: string,
  instruction: SiteInstruction,
  url?: string,
) {
  return parserFetch<StoredInstruction>(
    `/api/v1/instructions/${encodeURIComponent(host)}`,
    {
      method: "PUT",
      body: JSON.stringify(url ? { url, instruction } : { instruction }),
    },
  );
}

export function deleteInstruction(host: string) {
  return parserFetch<void>(`/api/v1/instructions/${encodeURIComponent(host)}`, {
    method: "DELETE",
    timeoutMs: 30_000,
  });
}
