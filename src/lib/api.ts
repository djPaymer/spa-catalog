import type { ManufacturerRow } from "@/lib/types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (res.status === 204) {
    return undefined as T;
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new HttpError(res.status, body.error || `Ошибка запроса ${url}`);
  }
  return body;
}

export async function requestMaybe<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return null;
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new HttpError(res.status, body.error || `Ошибка запроса ${url}`);
  }
  return body;
}

export function hrefOf(website: string) {
  if (!website.trim()) return null;
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

export type ManufacturerFields = {
  name: string;
  website: string;
  country_id: string;
  description: string;
  address: string;
};

export const emptyManufacturerFields = (): ManufacturerFields => ({
  name: "",
  website: "",
  country_id: "",
  description: "",
  address: "",
});

function manufacturerCacheKey(id: string) {
  return `spa-catalog:manufacturer:${id}`;
}

export function rememberManufacturer(row: ManufacturerRow) {
  try {
    sessionStorage.setItem(manufacturerCacheKey(row.id), JSON.stringify(row));
  } catch {
    /* ignore quota */
  }
}

export function recalledManufacturer(id: string): ManufacturerRow | null {
  try {
    const raw = sessionStorage.getItem(manufacturerCacheKey(id));
    return raw ? (JSON.parse(raw) as ManufacturerRow) : null;
  } catch {
    return null;
  }
}
