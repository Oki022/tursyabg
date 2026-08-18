import { createFileRoute, notFound } from "@tanstack/react-router";
import { LandingView } from "@/components/seo/landing-view";
import { findCategoryBySlug, findCityBySlug } from "@/lib/geo";
import { landingH1, landingIntro } from "@/lib/landing-content";
import { breadcrumbLd, clampDescription, seo } from "@/lib/seo";

export const Route = createFileRoute("/city/$city/$category")({
  loader: ({ params }) => {
    const city = findCityBySlug(params.city);
    const category = findCategoryBySlug(params.category);
    if (!city || !category) throw notFound();
    return { city: city.name, category: category.name };
  },
  head: ({ params, loaderData }) => {
    const cityName = loaderData?.city ?? "България";
    const catName = loaderData?.category ?? "Задачи";
    const path = `/city/${params.city}/${params.category}`;
    const { meta, links } = seo({
      title: `${catName} в ${cityName}, обяви за задачи`,
      description: clampDescription(
        `Търсиш майстор за ${catName.toLowerCase()} в ${cityName}? Виж активните задачи по квартали, свържи се директно със заявителя и договори цена в евро.`,
      ),
      path,
    });
    return {
      meta,
      links,
      scripts: [
        breadcrumbLd([
          { name: "Начало", path: "/" },
          { name: cityName, path: `/city/${params.city}` },
          { name: catName, path },
        ]),
      ],
    };
  },
  component: CityCategoryLanding,
});

function CityCategoryLanding() {
  const { city: citySlug, category: catSlug } = Route.useParams();
  const city = findCityBySlug(citySlug)!;
  const category = findCategoryBySlug(catSlug)!;
  return (
    <LandingView
      h1={landingH1({ city, category })}
      intro={landingIntro({ city, category })}
      city={city}
      category={category}
    />
  );
}
