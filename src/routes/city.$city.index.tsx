import { createFileRoute, notFound } from "@tanstack/react-router";
import { LandingView } from "@/components/seo/landing-view";
import { findCityBySlug } from "@/lib/geo";
import { landingH1, landingIntro } from "@/lib/landing-content";
import { breadcrumbLd, clampDescription, seo } from "@/lib/seo";

export const Route = createFileRoute("/city/$city/")({
  loader: ({ params }) => {
    const city = findCityBySlug(params.city);
    if (!city) throw notFound();
    return { name: city.name };
  },
  head: ({ params, loaderData }) => {
    const name = loaderData?.name ?? "България";
    const path = `/city/${params.city}`;
    const { meta, links } = seo({
      title: `Задачи и майстори в ${name}`,
      description: clampDescription(
        `Виж активните задачи в ${name} — ремонти, почистване, превоз, уроци и още. Публикувай задача безплатно или намери работа като изпълнител в ${name}.`,
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
  const { city: slug } = Route.useParams();
  const city = findCityBySlug(slug)!;
  return <LandingView h1={landingH1({ city })} intro={landingIntro({ city })} city={city} />;
}
