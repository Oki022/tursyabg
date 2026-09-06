import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { LandingView } from "@/components/seo/landing-view";
import { findCategoryBySlug } from "@/lib/geo";
import { fetchMunicipalityBySlug, fetchNeighborhoods } from "@/lib/locations-api";
import { landingH1, landingIntro } from "@/lib/landing-content";
import { municipalityLabel } from "@/lib/locations";
import { breadcrumbLd, clampDescription, seo } from "@/lib/seo";

export const Route = createFileRoute("/city/$city/$category")({
  loader: async ({ params }) => {
    const category = findCategoryBySlug(params.category);
    const municipality = await fetchMunicipalityBySlug(params.city);
    if (!municipality || !category) throw notFound();
    if (municipality.slug !== params.city) {
      throw redirect({
        to: "/city/$city/$category",
        params: { city: municipality.slug, category: category.id },
      });
    }
    const neighborhoods = municipality.hasNeighborhoods
      ? (await fetchNeighborhoods(municipality.id)).map((n) => n.name)
      : [];
    return { municipality, neighborhoods, categoryId: category.id, categoryName: category.name };
  },
  head: ({ params, loaderData }) => {
    const cityName = loaderData?.municipality
      ? municipalityLabel(loaderData.municipality.name, loaderData.municipality.hasNeighborhoods)
      : "България";
    const region = loaderData?.municipality.regionName;
    const catName = loaderData?.categoryName ?? "Задачи";
    const path = `/city/${params.city}/${params.category}`;
    const { meta, links } = seo({
      title: `${catName} в ${cityName}, задачи и работа`,
      description: clampDescription(
        `Търсиш майстор за ${catName.toLowerCase()} в община ${cityName}${region ? `, област ${region}` : ""}? Виж активните задачи, свържи се директно със заявителя и договори цена в евро.`,
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
  const { municipality, neighborhoods, categoryId } = Route.useLoaderData();
  const category = findCategoryBySlug(categoryId)!;
  return (
    <LandingView
      h1={landingH1({ municipality, category })}
      intro={landingIntro({ municipality, neighborhoods, category })}
      municipality={municipality}
      category={category}
    />
  );
}
