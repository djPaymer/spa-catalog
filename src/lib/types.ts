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

export type LinksSpec = {
  href?: string | null;
  path?: string | null;
  class?: string | null;
  name?: string;
  skip_href?: string | null;
};

export type PaginationSpec = {
  param: string;
  declared_count?: string | null;
};

export type SiteInstruction = {
  engine: string;
  url: string;
  links: LinksSpec;
  pagination?: PaginationSpec | null;
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
