"use client";

import { LANDING_COPY } from "@/constants/copy";
import { useRouter } from "next/navigation";

export function PopularKeywords() {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-center text-sm font-semibold">
        {LANDING_COPY.popularLabel}
      </p>
      <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2">
        {LANDING_COPY.keywords.map((keyword) => (
          <button
            key={keyword}
            type="button"
            className="border-input bg-card text-foreground hover:border-primary hover:bg-accent min-h-11 rounded-full border px-4 py-2 text-sm transition-colors"
            onClick={() => router.push(`/map?q=${encodeURIComponent(keyword)}`)}
          >
            {keyword}
          </button>
        ))}
      </div>
    </div>
  );
}
