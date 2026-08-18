import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, Briefcase, MapPin, Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/auth";
import { usePublicProfile, usePublicReviews } from "@/lib/reviews-api";
import { ReviewList } from "@/components/reviews/review-list";
import { Stars } from "@/components/reviews/stars";
import { ReportContentDialog } from "@/components/moderation/report-content-dialog";
import type { ReviewDirection } from "@/services/reviews";
import { fetchProfileSeo } from "@/lib/seo-loaders";
import { breadcrumbLd, clampDescription, jsonLd, seo } from "@/lib/seo";
import { absoluteUrl, BRAND } from "@/lib/brand";

export const Route = createFileRoute("/user/$id")({
  loader: ({ params }) => fetchProfileSeo(params.id),
  head: ({ params, loaderData }) => {
    const path = `/user/${params.id}`;
    if (!loaderData) {
      return seo({ title: "Профилът не е намерен", description: "Този профил не съществува.", path, noindex: true });
    }
    const p = loaderData;
    const ratingText = p.rating ? `Рейтинг ${p.rating}/5 от ${p.reviewCount} отзива` : "Нов потребител без отзиви";
    const { meta, links } = seo({
      title: clampDescription(`${p.name}, отзиви и рейтинг`, 58),
      description: clampDescription(
        `${p.name}${p.city ? ` от ${p.city}` : ""} в ${BRAND}. ${ratingText}. Завършени задачи: ${p.completedJobs}. Виж публичните отзиви от клиенти и изпълнители.`,
      ),
      path,
      type: "profile",
    });
    return {
      meta,
      links,
      scripts: [
        jsonLd({
          "@context": "https://schema.org",
          "@type": "Person",
          name: p.name,
          url: absoluteUrl(path),
          ...(p.city ? { address: { "@type": "PostalAddress", addressLocality: p.city, addressCountry: "BG" } } : {}),
          ...(p.rating && p.reviewCount > 0
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: p.rating,
                  reviewCount: p.reviewCount,
                  bestRating: 5,
                  worstRating: 1,
                },
              }
            : {}),
        }),
        breadcrumbLd([
          { name: "Начало", path: "/" },
          { name: p.name, path },
        ]),
      ],
    };
  },
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { id } = Route.useParams();
  const { data: profile, isLoading } = usePublicProfile(id);
  const [direction, setDirection] = useState<ReviewDirection>("client_to_pro");
  const [page, setPage] = useState(0);
  const reviews = usePublicReviews(id, direction, page);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <div className="h-32 w-full animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Профилът не е намерен</h1>
        <Button asChild className="mt-4">
          <Link to="/tasks">Към задачите</Link>
        </Button>
      </div>
    );
  }

  const asPro = profile.ratingAsPro && profile.reviewCountAsPro > 0;
  const asClient = profile.ratingAsClient && profile.reviewCountAsClient > 0;
  const overallCount = profile.reviewCountAsPro + profile.reviewCountAsClient;
  const overall =
    overallCount > 0
      ? ((profile.ratingAsPro ?? 0) * profile.reviewCountAsPro +
          (profile.ratingAsClient ?? 0) * profile.reviewCountAsClient) /
        overallCount
      : null;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
      <section className="min-w-0 rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-7">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="h-16 w-16 shrink-0 border border-border">
            <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
              {getInitials(profile.fullName ?? "Потребител")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight md:text-2xl">
              {profile.fullName ?? "Потребител"}
            </h1>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {profile.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {profile.city}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" /> {profile.completedJobs} завършени задачи
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex min-w-0 flex-wrap items-center gap-3 rounded-2xl bg-secondary/60 px-4 py-3">
          {overall ? (
            <>
              <span className="text-2xl font-bold text-foreground">
                {overall.toFixed(1).replace(".", ",")}
              </span>
              <Stars value={overall} size={18} />
              <span className="text-xs text-muted-foreground">
                {overallCount} {overallCount === 1 ? "отзив" : "отзива"}
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <BadgeCheck className="h-4 w-4 text-primary" /> Нов потребител, още няма отзиви
            </span>
          )}
        </div>

        <div className="mt-3 flex justify-end">
          <ReportContentDialog contentType="profile" contentId={profile.id} />
        </div>
      </section>

      <section className="mt-6 min-w-0">
        <Tabs
          value={direction}
          onValueChange={(v) => {
            setDirection(v as ReviewDirection);
            setPage(0);
          }}
        >
          <TabsList className="flex h-auto w-full max-w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="client_to_pro" className="shrink-0 rounded-lg px-3 py-1.5 text-xs md:text-sm">
              Като изпълнител ({profile.reviewCountAsPro})
            </TabsTrigger>
            <TabsTrigger value="pro_to_client" className="shrink-0 rounded-lg px-3 py-1.5 text-xs md:text-sm">
              Като клиент ({profile.reviewCountAsClient})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="client_to_pro" className="mt-4">
            <RatingSummary
              label="Рейтинг като изпълнител"
              rating={asPro ? profile.ratingAsPro : null}
              count={profile.reviewCountAsPro}
            />
            <ReviewList
              reviews={reviews.data ?? []}
              isLoading={reviews.isLoading}
              page={page}
              onPage={setPage}
              emptyText="Още няма отзиви като изпълнител."
            />
          </TabsContent>
          <TabsContent value="pro_to_client" className="mt-4">
            <RatingSummary
              label="Рейтинг като клиент"
              rating={asClient ? profile.ratingAsClient : null}
              count={profile.reviewCountAsClient}
            />
            <ReviewList
              reviews={reviews.data ?? []}
              isLoading={reviews.isLoading}
              page={page}
              onPage={setPage}
              emptyText="Още няма отзиви като клиент."
            />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

function RatingSummary({
  label,
  rating,
  count,
}: {
  label: string;
  rating: number | null | undefined;
  count: number;
}) {
  return (
    <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      {rating ? (
        <>
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            {rating.toFixed(1).replace(".", ",")}
          </span>
          <span className="text-xs text-muted-foreground">({count})</span>
        </>
      ) : (
        <span className="text-muted-foreground">Нов потребител</span>
      )}
    </div>
  );
}