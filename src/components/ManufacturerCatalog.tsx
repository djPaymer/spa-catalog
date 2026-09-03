"use client";

import { useCallback, useEffect, useState } from "react";
import Pagination, { pageCountOf } from "@/components/Pagination";
import type {
  ManufacturerRow,
  Paginated,
  ParsedProduct,
  ParseResult,
  SiteInstruction,
} from "@/lib/types";

const PAGE_SIZE = 20;
const PRODUCT_PAGE_SIZE = 20;

type RowState = {
  open: boolean;
  instructionLoading: boolean;
  instructionError: string | null;
  instruction: SiteInstruction | null;
  productsLoading: boolean;
  productsError: string | null;
  parse: ParseResult | null;
  productPage: number;
};

const emptyRow = (): RowState => ({
  open: false,
  instructionLoading: false,
  instructionError: null,
  instruction: null,
  productsLoading: false,
  productsError: null,
  parse: null,
  productPage: 1,
});

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `Ошибка запроса ${url}`);
  }
  return body;
}

function hrefOf(website: string) {
  if (!website.trim()) return null;
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

function sliceProducts(products: ParsedProduct[], page: number) {
  const start = (page - 1) * PRODUCT_PAGE_SIZE;
  return products.slice(start, start + PRODUCT_PAGE_SIZE);
}

export default function ManufacturerCatalog() {
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manufacturers, setManufacturers] = useState<ManufacturerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Record<string, RowState>>({});

  const offset = (page - 1) * PAGE_SIZE;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await requestJson<Paginated<ManufacturerRow>>(
          `/api/manufacturers?offset=${offset}&limit=${PAGE_SIZE}`,
        );
        if (cancelled) return;
        setManufacturers(result.data);
        setTotal(result.total);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Неизвестная ошибка");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [offset]);

  const patchRow = useCallback((id: string, patch: Partial<RowState>) => {
    setRows((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyRow()), ...patch },
    }));
  }, []);

  const getInstruction = async (manufacturer: ManufacturerRow) => {
    const site = hrefOf(manufacturer.website);
    if (!site) {
      patchRow(manufacturer.id, {
        open: true,
        instructionError: "У производителя нет сайта",
      });
      return;
    }

    patchRow(manufacturer.id, {
      open: true,
      instructionLoading: true,
      instructionError: null,
      productsError: null,
    });

    try {
      const instruction = await requestJson<SiteInstruction>(
        "/api/instruction",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: site }),
        },
      );
      patchRow(manufacturer.id, {
        instructionLoading: false,
        instruction,
        parse: null,
        productPage: 1,
      });
    } catch (e) {
      patchRow(manufacturer.id, {
        instructionLoading: false,
        instructionError:
          e instanceof Error ? e.message : "Не удалось получить инструкцию",
      });
    }
  };

  const getProducts = async (manufacturer: ManufacturerRow) => {
    const state = rows[manufacturer.id] ?? emptyRow();
    const site = hrefOf(manufacturer.website);
    if (!state.instruction || !site) return;

    patchRow(manufacturer.id, {
      productsLoading: true,
      productsError: null,
    });

    try {
      const parse = await requestJson<ParseResult>("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: site,
          instruction: state.instruction,
        }),
      });
      patchRow(manufacturer.id, {
        productsLoading: false,
        parse,
        productPage: 1,
      });
    } catch (e) {
      patchRow(manufacturer.id, {
        productsLoading: false,
        productsError:
          e instanceof Error ? e.message : "Не удалось получить продукты",
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-800">
          SPA Catalog
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Производители
        </h1>
        <p className="max-w-2xl text-sm text-stone-500">
          Список из td-catalog. Для каждого производителя можно запросить
          инструкцию скрейпа в td-parser, а затем собрать все продукты с его
          сайта.
        </p>
      </header>

      {loading && <p className="text-sm text-stone-500">Загрузка производителей…</p>}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && !error && manufacturers.length === 0 && (
        <p className="text-sm text-stone-500">Производители не найдены.</p>
      )}

      {!loading && !error && manufacturers.length > 0 && (
        <section className="space-y-4">
          <p className="text-sm text-stone-500">
            Всего производителей: {total}
          </p>
          <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Производитель</th>
                  <th className="px-4 py-3 font-medium">Страна</th>
                  <th className="px-4 py-3 font-medium">Сайт</th>
                  <th className="px-4 py-3 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {manufacturers.map((manufacturer) => {
                  const state = rows[manufacturer.id] ?? emptyRow();
                  const site = hrefOf(manufacturer.website);
                  return (
                    <ManufacturerRowView
                      key={manufacturer.id}
                      manufacturer={manufacturer}
                      site={site}
                      state={state}
                      onToggle={() =>
                        patchRow(manufacturer.id, { open: !state.open })
                      }
                      onInstruction={() => getInstruction(manufacturer)}
                      onProducts={() => getProducts(manufacturer)}
                      onProductPage={(next) =>
                        patchRow(manufacturer.id, { productPage: next })
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageCount={pageCountOf(total, PAGE_SIZE)}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </section>
      )}
    </div>
  );
}

function ManufacturerRowView({
  manufacturer,
  site,
  state,
  onToggle,
  onInstruction,
  onProducts,
  onProductPage,
}: {
  manufacturer: ManufacturerRow;
  site: string | null;
  state: RowState;
  onToggle: () => void;
  onInstruction: () => void;
  onProducts: () => void;
  onProductPage: (page: number) => void;
}) {
  const canOpenDetails =
    state.open ||
    state.instruction ||
    state.instructionLoading ||
    state.instructionError;

  return (
    <>
      <tr className="align-top hover:bg-stone-50/80">
        <td className="px-4 py-3">
          <div className="font-medium text-stone-900">{manufacturer.name}</div>
          {manufacturer.description ? (
            <p className="mt-1 line-clamp-2 max-w-md text-xs text-stone-500">
              {manufacturer.description}
            </p>
          ) : null}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-stone-600">
          {manufacturer.country_name}
          {manufacturer.country_code ? (
            <span className="ml-1 text-xs text-stone-400">
              {manufacturer.country_code}
            </span>
          ) : null}
        </td>
        <td className="px-4 py-3">
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
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              disabled={!site || state.instructionLoading}
              onClick={onInstruction}
              className="rounded-md bg-teal-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {state.instructionLoading
                ? "Получаем инструкцию…"
                : state.instruction
                  ? "Обновить инструкцию"
                  : "Получить инструкцию"}
            </button>
            {state.instruction ? (
              <button
                type="button"
                disabled={state.productsLoading}
                onClick={onProducts}
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {state.productsLoading
                  ? "Собираем продукты…"
                  : state.parse
                    ? "Обновить продукты"
                    : "Получить все продукты"}
              </button>
            ) : null}
            {canOpenDetails ? (
              <button
                type="button"
                onClick={onToggle}
                className="text-xs text-stone-500 underline hover:text-stone-800"
              >
                {state.open ? "Скрыть детали" : "Показать детали"}
              </button>
            ) : null}
          </div>
        </td>
      </tr>
      {state.open ? (
        <tr className="bg-stone-50/70">
          <td colSpan={4} className="px-4 py-4">
            <RowDetails
              state={state}
              onProductPage={onProductPage}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function RowDetails({
  state,
  onProductPage,
}: {
  state: RowState;
  onProductPage: (page: number) => void;
}) {
  if (state.instructionLoading) {
    return (
      <p className="text-sm text-stone-600">
        Запрос инструкции в td-parser. Это может занять несколько минут: модель
        обходит сайт производителя.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {state.instructionError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.instructionError}
        </p>
      ) : null}

      {state.instruction ? (
        <InstructionCard instruction={state.instruction} />
      ) : !state.instructionError ? (
        <p className="text-sm text-stone-500">Инструкция ещё не получена.</p>
      ) : null}

      {state.productsLoading ? (
        <p className="text-sm text-stone-600">
          Собираем продукты по инструкции. Обход каталога тоже может занять
          несколько минут.
        </p>
      ) : null}

      {state.productsError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.productsError}
        </p>
      ) : null}

      {state.parse ? (
        <ProductsCard parse={state.parse} page={state.productPage} onPage={onProductPage} />
      ) : null}
    </div>
  );
}

function InstructionCard({ instruction }: { instruction: SiteInstruction }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-stone-900">Инструкция</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <Info label="Движок" value={instruction.engine || "html"} />
        <Info label="Каталог" value={instruction.url || "/"} />
        <Info label="Regex ссылок" value={instruction.links?.href || "—"} />
        <Info label="Имя товара" value={instruction.links?.name || "text"} />
        <Info
          label="Пагинация"
          value={instruction.pagination?.param ?? "нет"}
        />
        {instruction.links?.class ? (
          <Info label="CSS-класс" value={instruction.links.class} />
        ) : null}
      </dl>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-stone-500 hover:text-stone-800">
          JSON инструкции
        </summary>
        <pre className="mt-2 overflow-x-auto rounded bg-stone-900 p-3 text-xs leading-5 text-stone-100">
          {JSON.stringify(instruction, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function ProductsCard({
  parse,
  page,
  onPage,
}: {
  parse: ParseResult;
  page: number;
  onPage: (page: number) => void;
}) {
  const products = parse.products ?? [];
  const visible = sliceProducts(products, page);

  return (
    <div className="rounded-md border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-900">Продукты</h2>
        <p className="text-xs text-stone-500">
          {parse.total_products} шт. · {parse.pages} стр. каталога ·{" "}
          {parse.listings} листингов
        </p>
      </div>
      {products.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">Продукты не найдены.</p>
      ) : (
        <div className="mt-3 space-y-3">
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-md border border-stone-100">
            {visible.map((product) => (
              <li
                key={product.url}
                className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm text-stone-800">
                  {product.name || "Без названия"}
                </span>
                <a
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-xs text-teal-800 underline decoration-teal-800/30 hover:text-teal-950"
                >
                  {product.url}
                </a>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            pageCount={pageCountOf(products.length, PRODUCT_PAGE_SIZE)}
            total={products.length}
            pageSize={PRODUCT_PAGE_SIZE}
            onPageChange={onPage}
          />
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-stone-400">{label}</dt>
      <dd className="mt-0.5 break-all font-mono text-xs text-stone-800">
        {value}
      </dd>
    </div>
  );
}
