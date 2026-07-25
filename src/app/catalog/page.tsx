import { Library } from "lucide-react";
import { Suspense } from "react";
import { CatalogClient } from "./_components/catalog-client";

export const metadata = { title: "Каталог — AniThink" };

export default function CatalogPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
      <h1 className="flex items-center gap-3 font-display text-3xl font-extrabold md:text-4xl">
        <Library className="h-8 w-8 text-accent" />
        Каталог
      </h1>
      <p className="mt-1 text-sm text-muted">
        Все аниме на одной странице с фильтрацией
      </p>

      <Suspense>
        <CatalogClient />
      </Suspense>
    </div>
  );
}