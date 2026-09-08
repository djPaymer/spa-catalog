"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { IconButton, PencilIcon, TrashIcon } from "@/components/Icons";
import ManufacturerFormFields from "@/components/ManufacturerFormFields";
import Pagination, { pageCountOf } from "@/components/Pagination";
import {
  emptyManufacturerFields,
  hrefOf,
  rememberManufacturer,
  requestJson,
  type ManufacturerFields,
} from "@/lib/api";
import type { Country, ManufacturerRow, Paginated } from "@/lib/types";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

function applyCountryNames(
  rows: ManufacturerRow[],
  countries: Country[],
): ManufacturerRow[] {
  if (!countries.length) return rows;
  const byId = new Map(countries.map((country) => [country.id, country]));
  return rows.map((row) => {
    const country = byId.get(row.country_id);
    if (!country) return row;
    return {
      ...row,
      country_name: country.name,
      country_code: country.code,
    };
  });
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return text;

  const parts = text.split(
    new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
  );
  if (parts.length === 1) return text;

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === needle.toLowerCase() ? (
          <mark
            key={`${part}-${index}`}
            className="rounded-sm bg-teal-100 px-0.5 text-teal-950"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function ManufacturerCatalog() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [countryId, setCountryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manufacturers, setManufacturers] = useState<ManufacturerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countriesError, setCountriesError] = useState<string | null>(null);
  const [countriesReload, setCountriesReload] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<ManufacturerFields>(
    emptyManufacturerFields(),
  );
  const [editing, setEditing] = useState<ManufacturerRow | null>(null);
  const [editForm, setEditForm] = useState<ManufacturerFields>(
    emptyManufacturerFields(),
  );
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const offset = (page - 1) * PAGE_SIZE;

  useEffect(() => {
    let cancelled = false;
    async function loadCountries() {
      setCountriesError(null);
      let lastError: string | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const nextCountries = await requestJson<Country[]>("/api/countries");
          if (cancelled) return;
          if (Array.isArray(nextCountries) && nextCountries.length > 0) {
            setCountries(nextCountries);
            setCreateForm((prev) =>
              prev.country_id
                ? prev
                : { ...prev, country_id: nextCountries[0].id },
            );
            return;
          }
          lastError = "Пустой список стран";
        } catch (err) {
          lastError =
            err instanceof Error ? err.message : "Не удалось загрузить страны";
        }
        if (cancelled) return;
        if (attempt < 2) {
          await new Promise((resolve) =>
            window.setTimeout(resolve, 700 * (attempt + 1)),
          );
        }
      }
      if (!cancelled) setCountriesError(lastError);
    }
    void loadCountries();
    return () => {
      cancelled = true;
    };
  }, [countriesReload]);

  const visibleManufacturers = useMemo(
    () => applyCountryNames(manufacturers, countries),
    [manufacturers, countries],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = query.trim().slice(0, 100);
      setAppliedQuery(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          offset: String(offset),
          limit: String(PAGE_SIZE),
        });
        if (appliedQuery) params.set("name", appliedQuery);
        if (countryId) params.set("country_id", countryId);
        const result = await requestJson<Paginated<ManufacturerRow>>(
          `/api/manufacturers?${params.toString()}`,
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

    void load();
    return () => {
      cancelled = true;
    };
  }, [offset, appliedQuery, countryId, reloadToken]);

  const createManufacturer = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const created = await requestJson<ManufacturerRow>("/api/manufacturers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      setCreateForm({
        ...emptyManufacturerFields(),
        country_id: createForm.country_id,
      });
      setQuery(created.name);
      setAppliedQuery(created.name.slice(0, 100));
      setPage(1);
      setReloadToken((n) => n + 1);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Не удалось создать производителя",
      );
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (manufacturer: ManufacturerRow) => {
    setEditing(manufacturer);
    setEditError(null);
    setEditForm({
      name: manufacturer.name,
      website: manufacturer.website,
      country_id: manufacturer.country_id,
      description: manufacturer.description ?? "",
      address: manufacturer.address ?? "",
    });
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await requestJson<ManufacturerRow>(
        `/api/manufacturers/${editing.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        },
      );
      setManufacturers((rows) =>
        rows.map((row) => (row.id === updated.id ? updated : row)),
      );
      setEditing(null);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Не удалось сохранить изменения",
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteManufacturer = async (manufacturer: ManufacturerRow) => {
    if (
      !window.confirm(
        `Удалить производителя «${manufacturer.name}» из td-catalog?`,
      )
    ) {
      return;
    }
    setRemovingId(manufacturer.id);
    setError(null);
    try {
      await requestJson(`/api/manufacturers/${manufacturer.id}`, {
        method: "DELETE",
      });
      if (editing?.id === manufacturer.id) setEditing(null);
      if (manufacturers.length <= 1 && page > 1) {
        setPage(page - 1);
      } else {
        setReloadToken((n) => n + 1);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось удалить производителя",
      );
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="flex w-full flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-800">
            SPA Catalog
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Производители
          </h1>
          <p className="max-w-2xl text-sm text-stone-500">
            Управление карточкой — в списке. Инструкция парсинга — внутри
            производителя.
          </p>
        </div>
        <div className="flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="manufacturer-search" className="sr-only">
              Поиск производителя
            </label>
            <input
              id="manufacturer-search"
              type="search"
              value={query}
              maxLength={100}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию"
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 pr-20 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-teal-800 focus:ring-2 focus:ring-teal-800/20"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700"
              >
                Сбросить
              </button>
            ) : null}
          </div>
          <label className="block shrink-0 text-xs sm:w-64">
            <span className="sr-only">Страна</span>
            <select
              value={countryId}
              onChange={(e) => {
                setCountryId(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-teal-800 focus:ring-2 focus:ring-teal-800/20"
            >
              <option value="">Все страны</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name} ({country.code})
                </option>
              ))}
            </select>
            {countries.length === 0 && !countriesError ? (
              <span className="mt-1 block text-stone-400">Загрузка стран…</span>
            ) : null}
            {countriesError ? (
              <button
                type="button"
                onClick={() => setCountriesReload((n) => n + 1)}
                className="mt-1 text-teal-800 underline decoration-teal-800/30 hover:text-teal-950"
              >
                Не удалось загрузить страны — повторить
              </button>
            ) : null}
          </label>
        </div>
        <details className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium text-stone-800">
            Добавить производителя
          </summary>
          <form className="mt-4 space-y-3" onSubmit={createManufacturer}>
            <ManufacturerFormFields
              value={createForm}
              onChange={setCreateForm}
              countries={countries}
              countriesError={countriesError}
              disabled={creating}
            />
            {createError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={creating || !createForm.country_id}
              className="rounded-md bg-teal-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creating ? "Создаём…" : "Создать производителя"}
            </button>
          </form>
        </details>
      </header>

      {loading && manufacturers.length === 0 && (
        <p className="text-sm text-stone-500">Загрузка производителей…</p>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && !error && manufacturers.length === 0 && (
        <p className="text-sm text-stone-500">
          {appliedQuery
            ? `По запросу «${appliedQuery}» ничего не найдено.`
            : countryId
              ? "В этой стране производители не найдены."
              : "Производители не найдены."}
        </p>
      )}

      {!error && manufacturers.length > 0 && (
        <section className={`space-y-4 ${loading ? "opacity-60" : ""}`}>
          <p className="text-sm text-stone-500">
            {appliedQuery
              ? `Найдено: ${total}`
              : `Всего производителей: ${total}`}
          </p>
          <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Производитель</th>
                  <th className="px-4 py-3 font-medium">Страна</th>
                  <th className="px-4 py-3 font-medium">Сайт</th>
                  <th className="px-4 py-3 font-medium">Управление</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibleManufacturers.map((manufacturer) => {
                  const site = hrefOf(manufacturer.website);
                  const busy = removingId === manufacturer.id;
                  return (
                    <tr
                      key={manufacturer.id}
                      className="align-middle hover:bg-stone-50/80"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/manufacturers/${manufacturer.id}`}
                          onClick={() => rememberManufacturer(manufacturer)}
                          className="font-medium text-stone-900 hover:text-teal-800 hover:underline"
                        >
                          <HighlightedText
                            text={manufacturer.name}
                            query={appliedQuery}
                          />
                        </Link>
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
                        <div className="flex items-center gap-1">
                          <IconButton
                            label="Изменить"
                            disabled={busy}
                            onClick={() => openEdit(manufacturer)}
                          >
                            <PencilIcon />
                          </IconButton>
                          <IconButton
                            label={busy ? "Удаляем…" : "Удалить"}
                            tone="danger"
                            disabled={busy}
                            onClick={() => deleteManufacturer(manufacturer)}
                          >
                            <TrashIcon />
                          </IconButton>
                        </div>
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
        </section>
      )}

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => {
            if (!savingEdit) setEditing(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-manufacturer-title"
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="edit-manufacturer-title"
              className="text-lg font-semibold text-stone-900"
            >
              Изменить производителя
            </h2>
            <form className="mt-4 space-y-3" onSubmit={saveEdit}>
              <ManufacturerFormFields
                value={editForm}
                onChange={setEditForm}
                countries={countries}
                countriesError={countriesError}
                disabled={savingEdit}
              />
              {editError ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {editError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={savingEdit || !editForm.country_id}
                  className="rounded-md bg-teal-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {savingEdit ? "Сохраняем…" : "Сохранить"}
                </button>
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setEditing(null)}
                  className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-40"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
