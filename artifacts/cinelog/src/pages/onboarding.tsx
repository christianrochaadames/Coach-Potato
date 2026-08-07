import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { useLocation } from "wouter";
import { CouchPotatoLogo } from "@/components/couch-potato-logo";
import { useCreateEntry, getListEntriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface TmdbItem {
  tmdbId: number;
  title: string;
  type: "movie" | "show";
  year: number | null;
  posterUrl: string | null;
}

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<TmdbItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const createEntry = useCreateEntry();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    // Check if onboarding already completed
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p) => {
        if (p.onboardingCompleted) setLocation("/");
      })
      .catch(() => {});

    // Load curated recent picks for onboarding
    fetch("/api/tmdb/top-rated")
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((data) => {
        setItems((data.items ?? []).slice(0, 16));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleContinue = async () => {
    setSubmitting(true);
    const today = `${new Date().getFullYear()}-01-01`;
    const toAdd = items.filter((item) => selected.has(item.tmdbId));

    try {
      // Create entries for selected titles
      await Promise.all(
        toAdd.map((item) =>
          createEntry.mutateAsync({
            data: {
              title: item.title,
              type: item.type,
              status: "completed",
              dateWatched: today,
              posterUrl: item.posterUrl ?? undefined,
              tmdbId: item.tmdbId,
              year: item.year ?? undefined,
            } as any,
          })
        )
      );

      // Mark onboarding completed
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingCompleted: true }),
      });

      queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });

      if (toAdd.length > 0) {
        toast({ title: `Added ${toAdd.length} titles to your collection!` });
      }
      setLocation("/");
    } catch {
      toast({ title: "Error", description: "Could not save selections", variant: "destructive" });
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingCompleted: true }),
    }).catch(() => {});
    setLocation("/");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: "#FFF3E8" }}>
      {/* Header */}
      <div className="px-5 pt-8 pb-4">
        <CouchPotatoLogo size="lg" />
        <div className="mt-5">
          <h1 className="text-2xl font-bold" style={{ color: "#111111" }}>
            Let's get acquainted.
          </h1>
          <p className="text-sm mt-1" style={{ color: "#7E7A73" }}>
            Tap anything you've already watched. I'll handle the recommendations.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 px-5 pb-4">
        {loading ? (
          <div className="grid grid-cols-4 gap-2">
            {[...Array(16)].map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl animate-pulse" style={{ background: "#EFE4D2" }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {items.map((item) => {
              const isSelected = selected.has(item.tmdbId);
              return (
                <button
                  key={item.tmdbId}
                  onClick={() => toggle(item.tmdbId)}
                  className="relative aspect-[2/3] rounded-xl overflow-hidden transition-all active:scale-95"
                  style={{
                    outline: isSelected ? "3px solid #116149" : "none",
                    outlineOffset: "2px",
                  }}
                >
                  {item.posterUrl ? (
                    <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: "#EFE4D2" }}>
                      <span className="text-xs font-bold text-center px-1" style={{ color: "#116149" }}>
                        {item.title}
                      </span>
                    </div>
                  )}
                  {isSelected && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: "rgba(17, 97, 73, 0.45)" }}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#116149" }}>
                        <Check className="w-5 h-5 text-white" strokeWidth={3} />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-8 pt-2 space-y-3">
        {selected.size > 0 && (
          <p className="text-center text-sm font-semibold" style={{ color: "#116149" }}>
            {selected.size} title{selected.size !== 1 ? "s" : ""} selected
          </p>
        )}
        <button
          onClick={handleContinue}
          disabled={submitting}
          className="w-full py-4 rounded-2xl font-bold text-base text-white disabled:opacity-50"
          style={{ background: "#6B46C1" }}
        >
          {submitting ? "Saving…" : selected.size > 0 ? `Add ${selected.size} title${selected.size !== 1 ? "s" : ""} & continue` : "Continue"}
        </button>
        <button
          onClick={handleSkip}
          disabled={submitting}
          className="w-full text-center text-sm font-semibold py-2"
          style={{ color: "#7E7A73" }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
