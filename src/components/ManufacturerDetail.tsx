"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import CatalogProducts from "@/components/CatalogProducts";
import CollapsibleSection from "@/components/CollapsibleSection";
import {
  InstructionPanel,
  SourceBadge,
} from "@/components/InstructionPanel";
import { IconButton, PencilIcon, SyncIcon } from "@/components/Icons";
import { hrefOf, recalledManufacturer, rememberManufacturer, requestJson, requestMaybe } from "@/lib/api";
import { emptyInstruction, hostOf, instructionPayload } from "@/lib/instruction";
import type {
  Category,
  InstructionSummary,
  ManufacturerRow,
  ParseResult,
  ParsedProduct,
  ProductType,
  SaveProductsResult,
  SiteInstruction,
  StoredInstruction,
} from "@/lib/types";

type Busy = "instruction" | "save" | "parse" | "delete" | null;

export default function ManufacturerDetail({ id }: { id: string }) {
  const [manufacturer, setManufacturer] = useState<ManufacturerRow | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [instructionError, setInstructionError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState<SiteInstruction | null>(null);
  const [dirty, setDirty] = useState(false);
  const [stored, setStored] = useState<StoredInstruction | null>(null);
  const [parse, setParse] = useState<ParseResult | null>(null);
  const [productPage, setProductPage] = useState(1);
  const [summary, setSummary] = useState<InstructionSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [catalogReload, setCatalogReload] = useState(0);
  const [instructionOpen, setInstructionOpen] = useState(true);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const site = manufacturer ? hrefOf(manufacturer.website) : null;
  const host = site ? hostOf(site) : null;

  const loadManufacturer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await requestJson<ManufacturerRow>(
        `/api/manufacturers/${id}`,
      );
      setManufacturer(next);
      rememberManufacturer(next);
    } catch (e) {
      const cached = recalledManufacturer(id);
      if (cached) {
        setManufacturer(cached);
        setError(null);
      } else {
        setError(
          e instanceof Error ? e.message : "Не удалось загрузить производителя",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadStored = useCallback(async (website: string) => {
    const nextSite = hrefOf(website);
    const nextHost = nextSite ? hostOf(nextSite) : null;
    if (!nextHost) return;
    try {
      const nextStored = await requestMaybe<StoredInstruction>(
        `/api/instructions/${encodeURIComponent(nextHost)}`,
      );
      if (!nextStored) return;
      setStored(nextStored);
      setInstruction((current) =>
        dirtyRef.current && current ? current : nextStored.instruction,
      );
    } catch (e) {
      setInstructionError(
        e instanceof Error ? e.message : "Не удалось загрузить инструкцию",
      );
    }
  }, []);

  useEffect(() => {
    void loadManufacturer();
  }, [loadManufacturer]);

  useEffect(() => {
    if (!manufacturer?.website) return;
    void loadStored(manufacturer.website);
  }, [manufacturer?.website, loadStored]);

  useEffect(() => {
    let cancelled = false;
    async function loadTaxonomy() {
      try {
        const [nextCategories, nextTypes] = await Promise.all([
          requestJson<Category[]>("/api/categories"),
          requestJson<ProductType[]>("/api/product-types"),
        ]);
        if (cancelled) return;
        setCategories(nextCategories);
        setProductTypes(nextTypes);
      } catch {
        /* taxonomy is only needed to save products */
      }
    }
    void loadTaxonomy();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    async function loadSummary() {
      try {
        const list = await requestJson<InstructionSummary[]>(
          "/api/instructions",
        );
        if (cancelled) return;
        const found = list.find((item) => item.host === host);
        setSummary(found ?? null);
      } catch {
        /* parser store may be down */
      }
    }
    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [host, stored?.updated_at]);

  const collectInstruction = async () => {
    if (!site) {
      setInstructionError("Некорректный URL");
      setEditorOpen(true);
      return;
    }
    setBusy("instruction");
    setInstructionError(null);
    setProductsError(null);
    setSaveError(null);
    setInstructionOpen(true);
    setEditorOpen(true);
    try {
      const nextInstruction = await requestJson<SiteInstruction>(
        "/api/instruction",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: site, refresh: false }),
        },
      );
      const nextStored = host
        ? await requestMaybe<StoredInstruction>(
            `/api/instructions/${encodeURIComponent(host)}`,
          )
        : null;
      setInstruction(nextInstruction);
      setStored(nextStored);
      setDirty(false);
      setParse(null);
      setProductPage(1);
    } catch (e) {
      setInstructionError(
        e instanceof Error ? e.message : "Не удалось собрать инструкцию",
      );
    } finally {
      setBusy(null);
    }
  };

  const openEditor = () => {
    setInstructionOpen(true);
    setEditorOpen(true);
    setInstruction((current) => current ?? emptyInstruction());
    if (manufacturer?.website && !stored && !instruction) {
      void loadStored(manufacturer.website);
    }
  };

  const saveManual = async (draft = instruction ?? emptyInstruction()) => {
    if (!host || !site) {
      setSaveError("Некорректный URL");
      setEditorOpen(true);
      return;
    }
    setBusy("save");
    setSaveError(null);
    setInstruction(draft);
    try {
      const nextStored = await requestJson<StoredInstruction>(
        `/api/instructions/${encodeURIComponent(host)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: site,
            instruction: draft,
          }),
        },
      );
      setStored(nextStored);
      setInstruction(nextStored.instruction);
      setDirty(false);
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : "Не удалось сохранить инструкцию",
      );
    } finally {
      setBusy(null);
    }
  };

  const removeStored = async () => {
    if (!host) return;
    setBusy("delete");
    setSaveError(null);
    try {
      await requestJson(`/api/instructions/${encodeURIComponent(host)}`, {
        method: "DELETE",
      });
      setStored(null);
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : "Не удалось удалить инструкцию",
      );
    } finally {
      setBusy(null);
    }
  };

  const collectProducts = async () => {
    if (!site) return;
    setBusy("parse");
    setProductsError(null);
    setInstructionOpen(true);
    setEditorOpen(true);
    try {
      const payload =
        dirty && instruction
          ? instructionPayload(instruction)
          : instruction && !stored
            ? instructionPayload(instruction)
            : undefined;
      const nextParse = await requestJson<ParseResult>("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: site,
          ...(payload ? { instruction: payload } : {}),
        }),
      });
      setParse(nextParse);
      setProductPage(1);
    } catch (e) {
      setProductsError(
        e instanceof Error ? e.message : "Не удалось собрать товары",
      );
    } finally {
      setBusy(null);
    }
  };

  const saveToCatalog = async (
    categoryId: string,
    productTypeId: string,
    products: ParsedProduct[],
  ) => {
    if (!manufacturer || products.length === 0) {
      throw new Error("Нет товаров для записи");
    }
    const result = await requestJson<SaveProductsResult>("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manufacturer_id: manufacturer.id,
        category_id: categoryId,
        product_type_id: productTypeId,
        products,
      }),
    });
    if (result.created > 0) setCatalogReload((n) => n + 1);
    return result;
  };

  const canParse = Boolean(instruction || stored || summary);

  return (
    <div className="flex w-full flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/"
          className="text-sm text-stone-500 hover:text-teal-800 hover:underline"
        >
          ← К производителям
        </Link>
      </div>

      {loading && !manufacturer ? (
        <p className="text-sm text-stone-500">Загрузка производителя…</p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {manufacturer ? (
        <>
          <header className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-800">
                Производитель
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                {manufacturer.name}
              </h1>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-stone-400">
                  Страна
                </dt>
                <dd className="mt-0.5 text-stone-800">
                  {manufacturer.country_name}
                  {manufacturer.country_code ? (
                    <span className="ml-1 text-stone-400">
                      {manufacturer.country_code}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-stone-400">
                  Сайт
                </dt>
                <dd className="mt-0.5">
                  {site ? (
                    <a
                      href={site}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-teal-800 underline decoration-teal-800/30 hover:text-teal-950"
                    >
                      {manufacturer.website}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              {manufacturer.address ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-stone-400">
                    Адрес
                  </dt>
                  <dd className="mt-0.5 text-stone-800">
                    {manufacturer.address}
                  </dd>
                </div>
              ) : null}
              {manufacturer.description ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-stone-400">
                    Описание
                  </dt>
                  <dd className="mt-0.5 text-stone-800">
                    {manufacturer.description}
                  </dd>
                </div>
              ) : null}
            </dl>
          </header>

          <CatalogProducts
            manufacturerId={manufacturer.id}
            categories={categories}
            productTypes={productTypes}
            reloadToken={catalogReload}
          />

          <CollapsibleSection
            title="Инструкция парсинга"
            description="Сбор с сайта или ручное создание и правка."
            open={instructionOpen}
            onOpenChange={setInstructionOpen}
            actions={
              <>
                {summary ? <SourceBadge source={summary.source} /> : null}
                <IconButton
                  label={
                    busy === "instruction"
                      ? "Собираем инструкцию…"
                      : "Запустить сбор инструкции"
                  }
                  tone="primary"
                  disabled={!site || busy !== null}
                  spinning={busy === "instruction"}
                  onClick={() => void collectInstruction()}
                >
                  <SyncIcon />
                </IconButton>
                <IconButton
                  label={
                    stored || instruction
                      ? "Редактировать инструкцию"
                      : "Создать инструкцию"
                  }
                  disabled={busy !== null}
                  onClick={openEditor}
                >
                  <PencilIcon />
                </IconButton>
                <button
                  type="button"
                  disabled={!site || busy !== null || !canParse}
                  onClick={() => void collectProducts()}
                  className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === "parse"
                    ? "Собираем товары…"
                    : parse
                      ? "Обновить товары"
                      : "Собрать товары"}
                </button>
              </>
            }
          >
            {editorOpen ? (
              <InstructionPanel
                instruction={instruction}
                stored={stored}
                parse={parse}
                productPage={productPage}
                instructionError={instructionError}
                productsError={productsError}
                saveError={saveError}
                categories={categories}
                productTypes={productTypes}
                busy={busy}
                onChange={(next) => {
                  setInstruction(next);
                  setDirty(true);
                }}
                onSave={(next) => void saveManual(next)}
                onDelete={() => void removeStored()}
                onProductPage={setProductPage}
                onSaveToCatalog={(categoryId, productTypeId, products) =>
                  saveToCatalog(categoryId, productTypeId, products)
                }
              />
            ) : (
              <p className="text-sm text-stone-500">
                Нажмите карандаш, чтобы создать или править инструкцию, либо
                синхронизацию — чтобы собрать её с сайта.
              </p>
            )}
          </CollapsibleSection>
        </>
      ) : null}
    </div>
  );
}
