import type { ManufacturerFields } from "@/lib/api";
import type { Country } from "@/lib/types";

export default function ManufacturerFormFields({
  value,
  onChange,
  countries,
  countriesError,
  disabled,
}: {
  value: ManufacturerFields;
  onChange: (next: ManufacturerFields) => void;
  countries: Country[];
  countriesError: string | null;
  disabled?: boolean;
}) {
  const field =
    "mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-800 outline-none focus:border-teal-800 focus:ring-2 focus:ring-teal-800/20 disabled:opacity-50";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs">
        <span className="font-medium text-stone-700">Название</span>
        <input
          required
          maxLength={200}
          disabled={disabled}
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          className={field}
        />
      </label>
      <label className="block text-xs">
        <span className="font-medium text-stone-700">Сайт</span>
        <input
          required
          maxLength={100}
          disabled={disabled}
          placeholder="https://example.com"
          value={value.website}
          onChange={(e) => onChange({ ...value, website: e.target.value })}
          className={field}
        />
      </label>
      <label className="block text-xs">
        <span className="font-medium text-stone-700">Страна</span>
        <select
          required
          disabled={disabled}
          value={value.country_id}
          onChange={(e) => onChange({ ...value, country_id: e.target.value })}
          className={field}
        >
          {countries.length === 0 ? (
            <option value="">
              {countriesError ? "Страны не загружены" : "Загрузка стран…"}
            </option>
          ) : null}
          {countries.map((country) => (
            <option key={country.id} value={country.id}>
              {country.name} ({country.code})
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs">
        <span className="font-medium text-stone-700">Адрес</span>
        <input
          disabled={disabled}
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          className={field}
        />
      </label>
      <label className="block text-xs sm:col-span-2">
        <span className="font-medium text-stone-700">Описание</span>
        <textarea
          rows={2}
          disabled={disabled}
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          className={field}
        />
      </label>
    </div>
  );
}
