import ManufacturerDetail from "@/components/ManufacturerDetail";

export default async function ManufacturerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ManufacturerDetail id={id} />;
}
