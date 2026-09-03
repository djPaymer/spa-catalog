function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Не задана переменная окружения ${name}`);
  }
  return value.replace(/\/$/, "");
}

export function getCatalogBaseUrl() {
  return requiredEnv("TD_CATALOG_BASE_URL");
}

export function getParserBaseUrl() {
  return requiredEnv("TD_PARSER_BASE_URL");
}
