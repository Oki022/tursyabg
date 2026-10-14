import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { LandingView } from "@/components/seo/landing-view";
import { fetchMunicipalityBySlug, fetchNeighborhoods } from "@/lib/locations-api";
import { landingH1, landingIntro } from "@/lib/landing-content";
import { municipalityLabel } from "@/lib/locations";
import { breadcrumbLd, clampDescription, seo } from "@/lib/seo";

export const Route = createFileRoute("/city/$city/")({
  loader: async ({ params }) => {
    const municipality = await fetchMunicipalityBySlug(params.city);
    if (!municipality) throw notFound();
    // Legacy slugs (e.g. /city/sofia) resolve, then redirect to the canonical URL.
    if (municipality.slug !== params.city) {
      throw redirect({ to: "/city/$city", params: { city: municipality.slug } });
    }
    const neighborhoods = municipality.hasNeighborhoods
      ? (await fetchNeighborhoods(municipality.id)).map((n) => n.name)
      : [];
    return { municipality, neighborhoods };
  },
  head: ({ params, loaderData }) => {
    const name = loaderData?.municipality
      ? municipalityLabel(loaderData.municipality.name, loaderData.municipality.hasNeighborhoods)
      : "България";
    const region = loaderData?.municipality.regionName;
    const path = `/city/${params.city}`;
    const { meta, links } = seo({
      title: `Задачи и изпълнители в ${name}`,
      description: clampDescription(
        `Виж активните задачи в община ${name}${region ? `, област ${region}` : ""}, ремонти, почистване, превоз, уроци и още. Публикувай задача безплатно или намери работа като изпълнител.`,
      ),
      path,
    });
    return {
      meta,
      links,
      scripts: [breadcrumbLd([{ name: "Начало", path: "/" }, { name, path }])],
    };
  },
  component: CityLanding,
});

function CityLanding() {
  const { municipality, neighborhoods } = Route.useLoaderData();
  return (
    <LandingView
      h1={landingH1({ municipality })}
      intro={landingIntro({ municipality, neighborhoods })}
      municipality={municipality}
    />
  );
}
