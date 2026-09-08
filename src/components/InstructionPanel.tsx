"use client";

import { useEffect, useState } from "react";
import Pagination, { pageCountOf } from "@/components/Pagination";
import { emptyInstruction, parseInstructionJson } from "@/lib/instruction";
import type {
  Category,
  InstructionSource,
  ParseResult,
  ParsedProduct,
  ProductType,
  SaveProductsResult,
  SiteInstruction,
  StoredInstruction,
} from "@/lib/types";

const PRODUCT_PAGE_SIZE = 20;

const SOURCE_LABEL: Record<string, string> = {
  manual: "manual",
  "agent-llm": "agent-llm",
  "agent-heuristic": "agent-heuristic",
};

export function sourceClass(source: string) {
  if (source === "manual") {
    return "border-stone-300 bg-stone-100 text-stone-700";
  }
  if (source === "agent-llm") {
    return "border-teal-200 bg-teal-50 text-teal-900";
  }
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export function SourceBadge({ source }: { source: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${sourceClass(source)}`}
    >
      {SOURCE_LABEL[source] ?? source}
    </span>
  );
}

export function InstructionPanel({
  instruction,
  stored,
  parse,
  productPage,
  instructionError,
  productsError,
  saveError,
  categories,
  productTypes,
  busy,
  onChange,
  onSave,
  onDelete,
  onProductPage,
  onSaveToCatalog,
}: {
  instruction: SiteInstruction | null;
  stored: StoredInstruction | null;
  parse: ParseResult | null;
  productPage: number;
  instructionError: string | null;
  productsError: string | null;
  saveError: string | null;
  categories: Category[];
  productTypes: ProductType[];
  busy: string | null;
  onChange: (next: SiteInstruction) => void;
  onSave: (instruction: SiteInstruction) => void;
  onDelete: () => void;
  onProductPage: (page: number) => void;
  onSaveToCatalog: (
    categoryId: string,
    productTypeId: string,
    products: ParsedProduct[],
  ) => Promise<SaveProductsResult>;
}) {
  const draft = instruction ?? emptyInstruction();

  return (
    <div className="space-y-4">
      {busy === "instruction" ? (
        <p className="text-sm text-stone-600">
          Обход сайта, может занять минуту.
        </p>
      ) : null}

      {instructionError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {instructionError}
        </p>
      ) : null}

      {saveError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {saveError}
        </p>
      ) : null}

      <InstructionEditor
        instruction={draft}
        stored={stored}
        disabled={busy === "save" || busy === "delete"}
        saving={busy === "save"}
        deleting={busy === "delete"}
        onChange={onChange}
        onSave={onSave}
        onDelete={stored ? onDelete : undefined}
      />

      {busy === "parse" ? (
        <p className="text-sm text-stone-600">
          Собираем товары, может занять минуту.
        </p>
      ) : null}

      {productsError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {productsError}
        </p>
      ) : null}

      {parse ? (
        <ProductsCard
          parse={parse}
          page={productPage}
          onPage={onProductPage}
          categories={categories}
          productTypes={productTypes}
          onSaveToCatalog={onSaveToCatalog}
        />
      ) : null}
    </div>
  );
}

function InstructionEditor({
  instruction,
  stored,
  disabled,
  saving,
  deleting,
  onChange,
  onSave,
  onDelete,
}: {
  instruction: SiteInstruction;
  stored: StoredInstruction | null;
  disabled: boolean;
  saving: boolean;
  deleting: boolean;
  onChange: (next: SiteInstruction) => void;
  onSave: (instruction: SiteInstruction) => void;
  onDelete?: () => void;
}) {
  const source = (stored?.source ?? "") as InstructionSource | string;
  const serialized = JSON.stringify(instruction, null, 2);
  const [jsonDraft, setJsonDraft] = useState(serialized);
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    setJsonDraft(serialized);
    setJsonError(null);
  }, [serialized]);

  const saveJson = () => {
    try {
      const next = parseInstructionJson(jsonDraft);
      setJsonError(null);
      onChange(next);
      onSave(next);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "Невалидный JSON");
    }
  };

  return (
    <div className="rounded-md border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-900">Инструкция</h2>
        {stored ? <SourceBadge source={source} /> : null}
      </div>
      <textarea
        value={jsonDraft}
        disabled={disabled}
        rows={10}
        spellCheck={false}
        placeholder='{ "engine": "html", "url": "/", "links": { "name": "text" } }'
        onChange={(e) => {
          setJsonDraft(e.target.value);
          setJsonError(null);
        }}
        className="mt-3 h-40 max-h-56 min-h-[8rem] w-full resize-y overflow-auto rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-xs leading-5 text-stone-800 outline-none focus:border-teal-800 focus:ring-2 focus:ring-teal-800/20 disabled:opacity-50"
      />
      {jsonError ? (
        <p className="mt-2 text-xs text-red-700">{jsonError}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || !jsonDraft.trim()}
          onClick={saveJson}
          className="rounded-md bg-teal-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
        {onDelete ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onDelete}
            className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting ? "Удаляем…" : "Удалить сохранённую"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ProductsCard({
  parse,
  page,
  onPage,
  categories,
  productTypes,
  onSaveToCatalog,
}: {
  parse: ParseResult;
  page: number;
  onPage: (page: number) => void;
  categories: Category[];
  productTypes: ProductType[];
  onSaveToCatalog: (
    categoryId: string,
    productTypeId: string,
    products: ParsedProduct[],
  ) => Promise<SaveProductsResult>;
}) {
  const products = parse.products ?? [];
  const visible = sliceProducts(products, page);
  const defaultCategoryId = categories[0]?.id ?? "";
  const defaultTypeId = productTypes[0]?.id ?? "";
  const [categoryByUrl, setCategoryByUrl] = useState<Record<string, string>>(
    {},
  );
  const [typeByUrl, setTypeByUrl] = useState<Record<string, string>>({});
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [rowStatus, setRowStatus] = useState<
    Record<string, { ok?: boolean; error?: string }>
  >({});
  const categoryById = new Map(categories.map((item) => [item.id, item]));

  const categoryOf = (url: string) => categoryByUrl[url] || defaultCategoryId;
  const typeOf = (url: string) => typeByUrl[url] || defaultTypeId;

  const saveOne = async (product: ParsedProduct) => {
    const categoryId = categoryOf(product.url);
    const productTypeId = typeOf(product.url);
    if (!categoryId || !productTypeId) return;
    setSavingUrl(product.url);
    setRowStatus((prev) => ({
      ...prev,
      [product.url]: {},
    }));
    try {
      const result = await onSaveToCatalog(categoryId, productTypeId, [
        product,
      ]);
      if (result.created > 0) {
        setRowStatus((prev) => ({
          ...prev,
          [product.url]: { ok: true },
        }));
        return;
      }
      const error =
        result.errors[0]?.error ||
        (result.skipped ? "Пропущен (нет URL или дубликат)" : "Не сохранено");
      setRowStatus((prev) => ({
        ...prev,
        [product.url]: { error },
      }));
    } catch (error) {
      setRowStatus((prev) => ({
        ...prev,
        [product.url]: {
          error:
            error instanceof Error ? error.message : "Не удалось сохранить",
        },
      }));
    } finally {
      setSavingUrl(null);
    }
  };

  return (
    <div className="rounded-md border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-900">Товары</h2>
        <p className="text-xs text-stone-500">
          {parse.total_products} шт. · {parse.pages} стр. · {parse.listings}{" "}
          листингов
        </p>
      </div>
      {products.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">Товары не найдены.</p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="overflow-x-auto rounded-md border border-stone-100">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Имя</th>
                  <th className="px-3 py-2 font-medium">URL</th>
                  <th className="px-3 py-2 font-medium">Категория</th>
                  <th className="px-3 py-2 font-medium">Тип товара</th>
                  <th className="px-3 py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visible.map((product) => {
                  const status = rowStatus[product.url];
                  const saving = savingUrl === product.url;
                  return (
                    <tr key={product.url}>
                      <td className="px-3 py-2 text-stone-800">
                        {product.name || "Без названия"}
                      </td>
                      <td className="px-3 py-2">
                        <a
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-xs text-teal-800 underline decoration-teal-800/30 hover:text-teal-950"
                        >
                          {product.url}
                        </a>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={categoryOf(product.url)}
                          disabled={
                            categories.length === 0 || savingUrl !== null
                          }
                          onChange={(e) =>
                            setCategoryByUrl((prev) => ({
                              ...prev,
                              [product.url]: e.target.value,
                            }))
                          }
                          className="w-full min-w-[10rem] rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800 outline-none focus:border-teal-800 focus:ring-2 focus:ring-teal-800/20 disabled:opacity-50"
                        >
                          {categories.length === 0 ? (
                            <option value="">Нет категорий</option>
                          ) : null}
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {categoryLabel(category, categoryById)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={typeOf(product.url)}
                          disabled={
                            productTypes.length === 0 || savingUrl !== null
                          }
                          onChange={(e) =>
                            setTypeByUrl((prev) => ({
                              ...prev,
                              [product.url]: e.target.value,
                            }))
                          }
                          className="w-full min-w-[8rem] rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800 outline-none focus:border-teal-800 focus:ring-2 focus:ring-teal-800/20 disabled:opacity-50"
                        >
                          {productTypes.length === 0 ? (
                            <option value="">Нет типов</option>
                          ) : null}
                          {productTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <button
                          type="button"
                          disabled={
                            savingUrl !== null ||
                            !categoryOf(product.url) ||
                            !typeOf(product.url)
                          }
                          onClick={() => void saveOne(product)}
                          className="rounded-md bg-teal-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {saving ? "Сохраняем…" : "Сохранить"}
                        </button>
                        {status?.ok ? (
                          <span className="ml-2 text-xs text-teal-800">
                            Сохранено
                          </span>
                        ) : null}
                        {status?.error ? (
                          <p className="mt-1 max-w-[14rem] text-xs text-red-700">
                            {status.error}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

function categoryLabel(category: Category, byId: Map<string, Category>) {
  const parent = category.parent_id ? byId.get(category.parent_id) : null;
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

function sliceProducts(products: ParsedProduct[], page: number) {
  const start = (page - 1) * PRODUCT_PAGE_SIZE;
  return products.slice(start, start + PRODUCT_PAGE_SIZE);
}
