# SPA Catalog

Next.js-каталог производителей. Данные берёт из **td-catalog**, инструкции скрейпа и продукты — из **td-parser**.

## Запуск

```bash
cp .env.example .env.local
npm install
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

## Переменные окружения

| Переменная | Назначение | Пример |
|------------|------------|--------|
| `TD_CATALOG_BASE_URL` | Базовый URL td-catalog | `https://dev.toolsdiscont.com/td-catalog` |

Публичный путь — `/td-catalog/api/v1/...`, сам FastAPI слушает `/api/v1/...`. Шлюз должен срезать префикс `/td-catalog`; иначе каталог отвечает 404. SPA повторяет такие запросы.
| `TD_PARSER_BASE_URL` | Базовый URL td-parser | `http://127.0.0.1:8000` |

После смены `.env.local` перезапустите `npm run dev`.

## Как устроен экран

1. Главная страница — пагинированный список производителей со страной.
2. **Получить инструкцию** — `POST {TD_PARSER_BASE_URL}/api/v1/instruction` с сайтом производителя. Ответ показывается на странице. Запрос может идти несколько минут.
3. После инструкции появляется **Получить все продукты** — `POST {TD_PARSER_BASE_URL}/api/v1/parse`.
