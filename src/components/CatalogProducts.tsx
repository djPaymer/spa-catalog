"use client";

import { useEffect, useState, type FormEvent } from "react";
import CollapsibleSection from "@/components/CollapsibleSection";
import { IconButton, TrashIcon } from "@/components/Icons";
import Pagination, { pageCountOf } from "@/components/Pagination";
import { requestJson } from "@/lib/api";
import type {
  CatalogProduct,
  Category,
  Paginated,
  ProductType,
} from "@/lib/types";

const PAGE_SIZE = 20;

type Draft = {
  name: string;
  url: string;
  description: string;
  category_id: string;
  product_type_id: string;
};

function draftOf(product: CatalogProduct): Draft {
  return {
    name: product.name,
    url: product.url,
    description: product.description ?? "",
    category_id: product.category_id,
    product_type_id: product.product_type_id,
  };
}

function dirtyOf(product: CatalogProduct, draft: Draft) {
  return (
    draft.name !== product.name ||
    draft.url !== product.url ||
    draft.description !== (product.description ?? "") ||
    draft.category_id !== product.category_id ||
    draft.product_type_id !== product.product_type_id
  );
}

function categoryLabel(category: Category, byId: Map<string, Category>) {
  const parent = category.parent_id ? byId.get(category.parent_id) : null;
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

function emptyDraft(
  categories: Category[],
  productTypes: ProductType[],
  previous?: Draft,
): Draft {
  return {
    name: "",
    url: "",
    description: "",
    category_id: previous?.category_id || categories[0]?.id || "",
    product_type_id: previous?.product_type_id || productTypes[0]?.id || "",
  };
}

export default function CatalogProducts({
  manufacturerId,
  categories,
  productTypes,
  reloadToken,
}: {
  manufacturerId: string;
  categories: Category[];
  productTypes: ProductType[];
  reloadToken: number;
}) {
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [createForm, setCreateForm] = useState<Draft>(() =>
    emptyDraft(categories, productTypes),
  );
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const offset = (page - 1) * PAGE_SIZE;
  const categoryById = new Map(categories.map((item) => [item.id, item]));
  const busy = savingId !== null || creating;

  useEffect(() => {
    setPage(1);
    setCreateError(null);
    setCreateForm(emptyDraft(categories, productTypes));
    // Reset only when switching manufacturer; taxonomy fills in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manufacturerId]);

  useEffect(() => {
    setCreateForm((prev) => ({
      ...prev,
      category_id: prev.category_id || categories[0]?.id || "",
      product_type_id: prev.product_type_id || productTypes[0]?.id || "",
    }));
  }, [categories, productTypes]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          manufacturer_id: manufacturerId,
          offset: String(offset),
          limit: String(PAGE_SIZE),
        });
        const result = await requestJson<Paginated<CatalogProduct>>(
          `/api/products?${params.toString()}`,
        );
        if (cancelled) return;
        setProducts(result.data ?? []);
        setTotal(result.total);
        setDrafts((prev) => {
          const next = { ...prev };
          for (const product of result.data ?? []) {
            if (!next[product.id]) next[product.id] = draftOf(product);
          }
          return next;
        });
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Не удалось загрузить товары",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [manufacturerId, offset, reloadToken]);

  const patchDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => {
      const existing =
        prev[id] ??
        (products.find((item) => item.id === id)
          ? draftOf(products.find((item) => item.id === id) as CatalogProduct)
          : null);
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, ...patch } };
    });
    setRowError((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const saveProduct = async (product: CatalogProduct) => {
    const draft = drafts[product.id] ?? draftOf(product);
    setSavingId(product.id);
    setRowError((prev) => {
      const next = { ...prev };
      delete next[product.id];
      return next;
    });
    try {
      const updated = await requestJson<CatalogProduct>(
        `/api/products/${product.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      setProducts((rows) =>
        rows.map((row) => (row.id === updated.id ? updated : row)),
      );
      setDrafts((prev) => ({ ...prev, [updated.id]: draftOf(updated) }));
    } catch (e) {
      setRowError((prev) => ({
        ...prev,
        [product.id]:
          e instanceof Error ? e.message : "Не удалось сохранить товар",
      }));
    } finally {
      setSavingId(null);
    }
  };

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const created = await requestJson<CatalogProduct>("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manufacturer_id: manufacturerId,
          name: createForm.name,
          url: createForm.url,
          description: createForm.description,
          category_id: createForm.category_id,
          product_type_id: createForm.product_type_id,
        }),
      });
      setCreateForm(emptyDraft(categories, productTypes, createForm));
      setDrafts((prev) => ({ ...prev, [created.id]: draftOf(created) }));
      setTotal((n) => n + 1);
      if (page === 1) {
        setProducts((rows) =>
          [created, ...rows.filter((row) => row.id !== created.id)].slice(
            0,
            PAGE_SIZE,
          ),
        );
      } else {
        setPage(1);
      }
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Не удалось создать товар",
      );
    } finally {
      setCreating(false);
    }
  };

  const removeProduct = async (product: CatalogProduct) => {
    if (!window.confirm(`Удалить товар «${product.name}» из td-catalog?`)) {
      return;
    }
    setSavingId(product.id);
    try {
      await requestJson(
        `/api/products/${product.id}?manufacturer_id=${manufacturerId}`,
        { method: "DELETE" },
      );
      if (products.length <= 1 && page > 1) {
        setPage(page - 1);
      } else {
        setProducts((rows) => rows.filter((row) => row.id !== product.id));
        setTotal((n) => Math.max(0, n - 1));
      }
    } catch (e) {
      setRowError((prev) => ({
        ...prev,
        [product.id]:
          e instanceof Error ? e.message : "Не удалось удалить товар",
      }));
    } finally {
      setSavingId(null);
    }
  };

  const field =
    "w-full min-w-[8rem] rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800 outline-none focus:border-teal-800 focus:ring-2 focus:ring-teal-800/20 disabled:opacity-50";

  return (
    <CollapsibleSection
      title="Товары в td-catalog"
      description="Существующие товары производителя: добавить вручную, править или удалить."
      badge={
        !loading || total > 0 ? (
          <span className="text-xs font-normal text-stone-400">
            {total}
          </span>
        ) : null
      }
    >

      <details className="rounded-md border border-stone-100 bg-stone-50/70 p-3">
        <summary className="cursor-pointer text-sm font-medium text-stone-800">
          Добавить товар вручную
        </summary>
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={submitCreate}>
          <label className="block text-xs text-stone-500">
            Название
            <input
              value={createForm.name}
              maxLength={200}
              required
              disabled={busy}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className={`${field} mt-1`}
            />
          </label>
          <label className="block text-xs text-stone-500">
            URL
            <input
              value={createForm.url}
              maxLength={500}
              required
              disabled={busy}
              placeholder="https://"
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, url: e.target.value }))
              }
              className={`${field} mt-1`}
            />
          </label>
          <label className="block text-xs text-stone-500 sm:col-span-2">
            Описание
            <input
              value={createForm.description}
              disabled={busy}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className={`${field} mt-1`}
            />
          </label>
          <label className="block text-xs text-stone-500">
            Категория
            <select
              value={createForm.category_id}
              required
              disabled={busy || categories.length === 0}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  category_id: e.target.value,
                }))
              }
              className={`${field} mt-1`}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {categoryLabel(category, categoryById)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-stone-500">
            Тип товара
            <select
              value={createForm.product_type_id}
              required
              disabled={busy || productTypes.length === 0}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  product_type_id: e.target.value,
                }))
              }
              className={`${field} mt-1`}
            >
              {productTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          {createError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
              {createError}
            </p>
          ) : null}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={
                busy ||
                !createForm.category_id ||
                !createForm.product_type_id
              }
              className="rounded-md bg-teal-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creating ? "Создаём…" : "Создать товар"}
            </button>
          </div>
        </form>
      </details>

      {loading && products.length === 0 ? (
        <p className="text-sm text-stone-500">Загрузка товаров…</p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!loading && !error && products.length === 0 ? (
        <p className="text-sm text-stone-500">В каталоге пока нет товаров.</p>
      ) : null}

      {products.length > 0 ? (
        <div className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
          <div className="overflow-x-auto rounded-md border border-stone-100">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Название</th>
                  <th className="px-3 py-2 font-medium">URL</th>
                  <th className="px-3 py-2 font-medium">Категория</th>
                  <th className="px-3 py-2 font-medium">Тип</th>
                  <th className="px-3 py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {products.map((product) => {
                  const draft = drafts[product.id] ?? draftOf(product);
                  const dirty = dirtyOf(product, draft);
                  const rowBusy = savingId === product.id;
                  return (
                    <tr key={product.id}>
                      <td className="px-3 py-2 align-top">
                        <input
                          value={draft.name}
                          maxLength={200}
                          disabled={busy}
                          onChange={(e) =>
                            patchDraft(product.id, { name: e.target.value })
                          }
                          className={field}
                        />
                        <input
                          value={draft.description}
                          disabled={busy}
                          placeholder="Описание"
                          onChange={(e) =>
                            patchDraft(product.id, {
                              description: e.target.value,
                            })
                          }
                          className={`${field} mt-1 text-stone-500`}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          value={draft.url}
                          maxLength={500}
                          disabled={busy}
                          onChange={(e) =>
                            patchDraft(product.id, { url: e.target.value })
                          }
                          className={field}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          value={draft.category_id}
                          disabled={busy || categories.length === 0}
                          onChange={(e) =>
                            patchDraft(product.id, {
                              category_id: e.target.value,
                            })
                          }
                          className={field}
                        >
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {categoryLabel(category, categoryById)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          value={draft.product_type_id}
                          disabled={busy || productTypes.length === 0}
                          onChange={(e) =>
                            patchDraft(product.id, {
                              product_type_id: e.target.value,
                            })
                          }
                          className={field}
                        >
                          {productTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-top">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={busy || !dirty}
                            onClick={() => void saveProduct(product)}
                            className="rounded-md bg-teal-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {rowBusy ? "Сохраняем…" : "Сохранить"}
                          </button>
                          <IconButton
                            label="Удалить"
                            tone="danger"
                            disabled={busy}
                            onClick={() => void removeProduct(product)}
                          >
                            <TrashIcon />
                          </IconButton>
                        </div>
                        {rowError[product.id] ? (
                          <p className="mt-1 max-w-[14rem] text-xs text-red-700">
                            {rowError[product.id]}
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
            pageCount={pageCountOf(total, PAGE_SIZE)}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </CollapsibleSection>
  );
}
