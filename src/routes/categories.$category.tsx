import { createFileRoute, notFound } from "@tanstack/react-router";
import { LandingView } from "@/components/seo/landing-view";
import { findCategoryBySlug } from "@/lib/geo";
import { landingH1, landingIntro } from "@/lib/landing-content";
import { breadcrumbLd, clampDescription, seo } from "@/lib/seo";

export const Route = createFileRoute("/categories/$category")({
  loader: ({ params }) => {
    const category = findCategoryBySlug(params.category);
    if (!category) throw notFound();
    return { name: category.name, id: category.id };
  },
  head: ({ params, loaderData }) => {
    const name = loaderData?.name ?? "Задачи";
    const path = `/categories/${params.category}`;
    const { meta, links } = seo({
      title: `${name}, обяви за задачи в България`,
      description: clampDescription(
        `Актуални задачи в категория ${name} от цяла България. Публикувай безплатно или намери клиенти като изпълнител, с реални отзиви и бюджет в евро.`,
      ),
      path,
    });
    return {
      meta,
      links,
      scripts: [breadcrumbLd([{ name: "Начало", path: "/" }, { name, path }])],
    };
  },
  component: CategoryLanding,
});

function CategoryLanding() {
  const { category: slug } = Route.useParams();
  const category = findCategoryBySlug(slug)!;
  return (
    <LandingView
      h1={landingH1({ category })}
      intro={landingIntro({ category })}
      category={category}
    />
  );
}
