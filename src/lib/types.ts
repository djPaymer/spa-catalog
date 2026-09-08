export type Country = {
  id: string;
  name: string;
  code: string;
};

export type Manufacturer = {
  id: string;
  name: string;
  description: string;
  website: string;
  country_id: string;
  address: string;
  scraped_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ManufacturerRow = Manufacturer & {
  country_name: string;
  country_code: string | null;
};

export type Paginated<T> = {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

export type NameMode = "text" | "title" | "slug";

export type InstructionSource = "manual" | "agent-llm" | "agent-heuristic";

export type LinksSpec = {
  href?: string;
  path?: string;
  class?: string;
  name?: NameMode;
  skip_href?: string;
};

export type CategoriesSpec = {
  href: string;
  max_pages?: number;
};

export type PaginationSpec = {
  param: string;
  declared_count?: string;
};

export type SiteInstruction = {
  engine?: "html";
  url: string;
  links: LinksSpec;
  categories?: CategoriesSpec;
  pagination?: PaginationSpec;
};

export type InstructionSummary = {
  host: string;
  site_url: string;
  source: InstructionSource | string;
  listing: string;
  href?: string | null;
  updated_at: string;
};

export type InstructionMeta = {
  source?: string;
  confidence?: number;
  reason?: string;
  shapes?: string[];
  hits?: number;
  pages_fetched?: number;
  listing_pages?: { url: string; hits: number }[];
};

export type StoredInstruction = {
  host: string;
  site_url: string;
  source: InstructionSource | string;
  instruction: SiteInstruction;
  meta?: InstructionMeta;
  created_at: string;
  updated_at: string;
};

export type ParsedProduct = {
  url: string;
  name: string;
};

export type ParseResult = {
  site: string;
  listing: string;
  listings: number;
  pages: number;
  total_products: number;
  products: ParsedProduct[];
};

export type Category = {
  id: string;
  name: string;
  description: string;
  parent_id: string | null;
};

export type ProductType = {
  id: string;
  name: string;
  description: string;
};

export type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  url: string;
  manufacturer_id: string;
  category_id: string;
  product_type_id: string;
  created_at: string;
  updated_at: string;
};

export type SaveProductsResult = {
  created: number;
  failed: number;
  skipped: number;
  errors: { url: string; error: string }[];
};
