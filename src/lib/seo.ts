import { BRAND, absoluteUrl, pageTitle } from "@/lib/brand";

export type SeoInput = {
  /** Page title without the brand suffix. */
  title?: string;
  description: string;
  /** Site-relative path, used for canonical + og:url. */
  path: string;
  image?: string | null;
  type?: "website" | "article" | "profile";
  noindex?: boolean;
};

export type MetaTag = Record<string, string>;

/** Full per-page metadata: title, description, canonical, Open Graph, Twitter card. */
export function seo({ title, description, path, image, type = "website", noindex }: SeoInput) {
  const fullTitle = pageTitle(title);
  const url = absoluteUrl(path);
  const meta: MetaTag[] = [
    { title: fullTitle },
    { name: "description", content: description },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:url", content: url },
    { property: "og:site_name", content: BRAND },
    { property: "og:locale", content: "bg_BG" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: description },
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
  ];
  if (image) {
    meta.push({ property: "og:image", content: image });
    meta.push({ name: "twitter:image", content: image });
  }
  if (noindex) meta.push({ name: "robots", content: "noindex, nofollow" });

  return {
    meta,
    links: noindex ? [] : [{ rel: "canonical", href: url }],
  };
}

/** Meta for private/authenticated pages: keep them out of the index. */
export function noindexSeo(title: string, description = "Лична страница в " + BRAND) {
  return seo({ title, description, path: "/", noindex: true });
}

export function jsonLd(data: unknown) {
  return { type: "application/ld+json", children: JSON.stringify(data) };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  });
}

/** Trim a description to the 140–160 character sweet spot. */
export function clampDescription(text: string, max = 158) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/[\s,.;:–-]+$/, "")}…`;
}
