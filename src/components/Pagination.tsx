"use client";

type PaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export default function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: PaginationProps) {
  if (total === 0 || pageCount <= 1) {
    return null;
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-stone-500">
      <p>
        {from}–{to} из {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-stone-700 disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-stone-50"
        >
          Назад
        </button>
        <span className="tabular-nums text-stone-600">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-stone-700 disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-stone-50"
        >
          Вперёд
        </button>
      </div>
    </div>
  );
}

export function pageCountOf(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}
