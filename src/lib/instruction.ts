import type { SiteInstruction } from "@/lib/types";

export function hostOf(siteUrl: string): string | null {
  try {
    const url = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return host || null;
  } catch {
    return null;
  }
}

export function emptyInstruction(): SiteInstruction {
  return {
    engine: "html",
    url: "/",
    links: { name: "text" },
  };
}

export function instructionPayload(draft: SiteInstruction): SiteInstruction {
  const links: SiteInstruction["links"] = {
    name: draft.links?.name || "text",
  };
  const href = draft.links?.href?.trim();
  const path = draft.links?.path?.trim();
  const cssClass = draft.links?.class?.trim();
  const skipHref = draft.links?.skip_href?.trim();
  if (href) links.href = href;
  if (path) links.path = path;
  if (cssClass) links.class = cssClass;
  if (skipHref) links.skip_href = skipHref;

  const payload: SiteInstruction = {
    engine: "html",
    url: draft.url?.trim() || "/",
    links,
  };

  const categoryHref = draft.categories?.href?.trim();
  if (categoryHref) {
    payload.categories = {
      href: categoryHref,
      max_pages: clampPages(draft.categories?.max_pages),
    };
  }

  const param = draft.pagination?.param?.trim();
  if (param) {
    payload.pagination = {
      param,
      ...(draft.pagination?.declared_count?.trim()
        ? { declared_count: draft.pagination.declared_count.trim() }
        : {}),
    };
  }

  return payload;
}

export function parseInstructionJson(raw: string): SiteInstruction {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Невалидный JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Ожидался JSON-объект");
  }
  const obj = parsed as Record<string, unknown>;
  const inner =
    obj.instruction &&
    typeof obj.instruction === "object" &&
    !Array.isArray(obj.instruction)
      ? (obj.instruction as SiteInstruction)
      : (obj as unknown as SiteInstruction);
  return inner;
}

function clampPages(value?: number) {
  if (!value || Number.isNaN(value)) return 300;
  return Math.min(2000, Math.max(1, Math.round(value)));
}
