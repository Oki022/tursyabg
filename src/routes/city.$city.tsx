import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { findCityBySlug } from "@/lib/geo";

export const Route = createFileRoute("/city/$city")({
  loader: ({ params }) => {
    const city = findCityBySlug(params.city);
    if (!city) throw notFound();
    return { name: city.name };
  },
  component: () => <Outlet />,
});
