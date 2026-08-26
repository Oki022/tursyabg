import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { fetchMunicipalityBySlug } from "@/lib/locations-api";

export const Route = createFileRoute("/city/$city")({
  loader: async ({ params }) => {
    const municipality = await fetchMunicipalityBySlug(params.city);
    if (!municipality) throw notFound();
    return { name: municipality.name };
  },
  component: () => <Outlet />,
});
