import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Search, UserRound } from "lucide-react";

const PAGE_BG = "#0F2D1C";
const CARD_BG = "#1A4A2A";
const ACCENT = "#7EDC5A";
const MUTED = "#A8D4B0";

type BuddyStatus = "none" | "incoming" | "outgoing" | "accepted";
type BuddyPerson = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  avatarId: string | null;
  avatarUrl: string | null;
  bio?: string | null;
  status: BuddyStatus;
};
type BuddyEntry = {
  title: string;
  type: string;
  status: string;
  posterUrl: string | null;
  tmdbId: number;
};
type ShelfStatus = "watching" | "plan_to_watch" | "completed";
type ProfileResponse = {
  person: BuddyPerson;
  status: BuddyStatus;
  favorites?: { tv: { title: string; posterUrl: string | null }[]; movies: { title: string; posterUrl: string | null }[] };
  shelves?: Record<ShelfStatus, { count: number; items: BuddyEntry[] }>;
};
type BuddyMutationResponse =
  | { userId: string; status: "pending" | "accepted"; direction: "outgoing" | "accepted" }
  | { success: true };

const shelfLabels: Record<ShelfStatus, string> = {
  watching: "Watching",
  plan_to_watch: "Watchlist",
  completed: "Completed",
};

function displayName(person: BuddyPerson) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || (person.username ? `@${person.username}` : "Spud member");
}

function Avatar({ person, size = 52 }: { person: BuddyPerson; size?: number }) {
  const src = person.avatarUrl || (person.avatarId ? `${import.meta.env.BASE_URL}spud-avatar-${encodeURIComponent(person.avatarId)}.png` : null);
  return (
    <div className="shrink-0 rounded-full overflow-hidden flex items-center justify-center" style={{ width: size, height: size, background: "#D4F5A0", border: "2px solid #7EDC5A" }}>
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <UserRound style={{ color: "#1A4A2A", width: size * 0.48, height: size * 0.48 }} />}
    </div>
  );
}

function PageFrame({ children, title, back = "/profile" }: { children: React.ReactNode; title: string; back?: string }) {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-full pb-24" style={{ background: PAGE_BG, color: "#ffffff" }}>
      <div className="px-5 pt-8 pb-5 flex items-center gap-2">
        <button data-testid="button-buddies-back" onClick={() => setLocation(back)} className="p-2 -ml-2 rounded-full" aria-label="Back">
          <ArrowLeft className="w-5 h-5" style={{ color: MUTED }} />
        </button>
        <h1 className="text-lg font-bold" data-testid="text-buddies-title">{title}</h1>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function PersonCard({ person, onOpen }: { person: BuddyPerson; onOpen: () => void }) {
  return (
    <button data-testid={`button-person-${person.userId}`} onClick={onOpen} className="w-full flex items-center gap-3 rounded-2xl p-3 text-left" style={{ background: CARD_BG }}>
      <Avatar person={person} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold truncate" data-testid={`text-person-name-${person.userId}`}>{displayName(person)}</span>
        {person.username && <span className="block text-xs mt-0.5 truncate" style={{ color: MUTED }}>@{person.username}</span>}
      </span>
      <span className="text-xs font-semibold" style={{ color: ACCENT }}>{person.status === "accepted" ? "Buddy" : person.status === "incoming" ? "Request" : person.status === "outgoing" ? "Pending" : "View"}</span>
    </button>
  );
}

export function BuddyDirectory() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BuddyPerson[]>([]);
  const [accepted, setAccepted] = useState<BuddyPerson[]>([]);
  const [incoming, setIncoming] = useState<BuddyPerson[]>([]);
  const [outgoing, setOutgoing] = useState<BuddyPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<{ accepted: BuddyPerson[]; incoming: BuddyPerson[]; outgoing: BuddyPerson[] }>("/api/buddies")
      .then(data => { if (active) { setAccepted(data.accepted); setIncoming(data.incoming); setOutgoing(data.outgoing); } })
      .catch(err => { if (active) setError(err.message || "Could not load buddies."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      api<{ results: BuddyPerson[] }>(`/api/buddies/search?q=${encodeURIComponent(term)}`)
        .then(data => { if (active) { setResults(data.results); setError(""); } })
        .catch(err => { if (active) setError(err.message || "Could not search for buddies."); })
        .finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  const personRow = (person: BuddyPerson) => <PersonCard key={person.userId} person={person} onOpen={() => setLocation(`/buddies/${encodeURIComponent(person.userId)}`)} />;
  return (
    <PageFrame title="Spud Buddies">
      <label className="flex items-center gap-3 rounded-2xl px-4 mb-5" style={{ background: CARD_BG, border: "1px solid #2B6840" }}>
        <Search className="w-5 h-5 shrink-0" style={{ color: MUTED }} />
        <input data-testid="input-buddy-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or username" className="w-full py-4 bg-transparent outline-none text-sm" style={{ color: "#fff" }} />
      </label>
      {error && <p data-testid="status-buddy-error" className="rounded-xl p-3 mb-4 text-sm" style={{ background: "#4A1E1E", color: "#FFC4B8" }}>{error}</p>}
      {query.trim().length >= 2 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Search results</h2>
          {searching ? <p className="text-sm py-4" style={{ color: MUTED }}>Searching…</p> : results.length ? results.map(personRow) : <p className="text-sm py-3" style={{ color: MUTED }}>No people found.</p>}
        </section>
      ) : loading ? <p data-testid="status-buddies-loading" className="py-4 text-sm" style={{ color: MUTED }}>Loading buddies…</p> : (
        <div className="space-y-6">
          {[
            ["Incoming requests", incoming],
            ["Sent requests", outgoing],
            ["Your buddies", accepted],
          ].map(([label, people]) => (
            <section key={label as string} className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT }}>{label as string} <span style={{ color: MUTED }}>({(people as BuddyPerson[]).length})</span></h2>
              {(people as BuddyPerson[]).length ? (people as BuddyPerson[]).map(personRow) : <p className="text-sm" style={{ color: MUTED }}>Nothing here yet.</p>}
            </section>
          ))}
        </div>
      )}
    </PageFrame>
  );
}

function PosterRow({ items }: { items: { title: string; posterUrl: string | null }[] }) {
  if (!items.length) return <p className="text-sm" style={{ color: MUTED }}>No titles to show yet.</p>;
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} className="w-24 shrink-0" data-testid={`card-buddy-title-${index}`}>
          <div className="w-24 h-36 rounded-xl overflow-hidden flex items-center justify-center" style={{ background: "#245A35" }}>
            {item.posterUrl ? <img src={item.posterUrl} alt="" loading="lazy" className="w-full h-full object-cover" /> : <span className="px-2 text-center text-xs" style={{ color: MUTED }}>Poster unavailable</span>}
          </div>
          <p className="mt-1.5 text-xs font-semibold line-clamp-2">{item.title}</p>
        </div>
      ))}
    </div>
  );
}

export function BuddyProfile({ params }: { params: { userId: string } }) {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [dataUserId, setDataUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const userId = decodeURIComponent(params.userId);
  const currentUserId = useRef(userId);
  currentUserId.current = userId;

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setDataUserId("");
    setError("");
    setLoading(true);
    setBusy(false);
    api<ProfileResponse>(`/api/buddies/${encodeURIComponent(userId)}`, { signal: controller.signal })
      .then(profile => {
        if (!controller.signal.aborted) {
          setData(profile);
          setDataUserId(userId);
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) setError(err.message || "Could not load this profile.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [userId, refreshKey]);

  const mutate = async (action: "request" | "accept" | "reject" | "cancel" | "remove") => {
    setBusy(true);
    setError("");
    try {
      const method = action === "request" || action === "accept" ? "POST" : "DELETE";
      const routeAction = action === "reject" || action === "cancel" || action === "remove" ? "" : `/${action}`;
      const result = await api<BuddyMutationResponse>(`/api/buddies/${encodeURIComponent(userId)}${routeAction}`, { method });
      if (action === "request" || action === "accept") {
        const expectedStatus = action === "request" ? "pending" : "accepted";
        const expectedDirection = action === "request" ? "outgoing" : "accepted";
        if (
          !("status" in result)
          || result.userId !== userId
          || result.status !== expectedStatus
          || result.direction !== expectedDirection
        ) {
          throw new Error("Unexpected buddy relationship response.");
        }
      } else if (!("success" in result) || !result.success) {
        throw new Error("Could not update buddy request.");
      }
      if (currentUserId.current !== userId) return;
      if (action === "remove") {
        setData(current => current ? {
          person: { ...current.person, bio: null },
          status: "none",
        } : current);
      }
      setRefreshKey(key => key + 1);
    } catch (err) {
      if (currentUserId.current === userId) setError(err instanceof Error ? err.message : "Could not update buddy request.");
    } finally {
      if (currentUserId.current === userId) setBusy(false);
    }
  };

  const currentData = dataUserId === userId ? data : null;
  if (loading || (!currentData && !error)) return <PageFrame title="Spud Buddy"><p data-testid="status-buddy-profile-loading" style={{ color: MUTED }}>Loading profile…</p></PageFrame>;
  if (!currentData) return <PageFrame title="Spud Buddy">{error && <p data-testid="status-buddy-profile-error" style={{ color: "#FFC4B8" }}>{error}</p>}</PageFrame>;
  const accepted = currentData.status === "accepted";
  const action = currentData.status === "incoming" ? "accept" : currentData.status === "outgoing" ? "cancel" : currentData.status === "accepted" ? "remove" : "request";
  const actionLabel = { accept: "Accept request", cancel: "Cancel request", remove: "Remove buddy", request: "Send buddy request" }[action];
  return (
    <PageFrame title="Spud Buddy" back="/buddies">
      <div className="rounded-2xl p-5 flex flex-col items-center text-center" style={{ background: CARD_BG }}>
        <Avatar person={currentData.person} size={88} />
        <h2 className="mt-3 text-xl font-bold" data-testid="text-buddy-profile-name">{displayName(currentData.person)}</h2>
        {currentData.person.username && <p className="mt-1 text-sm" style={{ color: MUTED }}>@{currentData.person.username}</p>}
        {accepted && currentData.person.bio && <p className="mt-3 text-sm leading-relaxed" style={{ color: MUTED }}>{currentData.person.bio}</p>}
        <button data-testid={`button-buddy-${action}`} disabled={busy} onClick={() => mutate(action)} className="mt-4 px-5 py-3 rounded-xl text-sm font-bold disabled:opacity-60" style={{ background: action === "remove" ? "#245A35" : ACCENT, color: "#0F2D1C", border: action === "remove" ? "1px solid #7EDC5A" : undefined }}>
          {busy ? "Updating…" : actionLabel}
        </button>
        {currentData.status === "incoming" && <button data-testid="button-buddy-reject" disabled={busy} onClick={() => mutate("reject")} className="mt-3 text-sm font-semibold" style={{ color: MUTED }}>Decline request</button>}
        {error && <p data-testid="status-buddy-profile-error" className="mt-3 text-sm" style={{ color: "#FFC4B8" }}>{error}</p>}
      </div>
      {accepted && (
        <div className="mt-6 space-y-6">
          {currentData.favorites && <section className="space-y-4">
            <h2 className="text-base font-bold">Favorites</h2>
            <div><h3 className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT }}>TV</h3><PosterRow items={currentData.favorites.tv} /></div>
            <div><h3 className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Movies</h3><PosterRow items={currentData.favorites.movies} /></div>
          </section>}
          {currentData.shelves && (["watching", "plan_to_watch", "completed"] as ShelfStatus[]).map(status => {
            const shelf = currentData.shelves?.[status];
            if (!shelf) return null;
            return <section key={status} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">{shelfLabels[status]} <span className="text-sm font-normal" style={{ color: MUTED }}>({shelf.count})</span></h2>
                {shelf.count > 0 && <button data-testid={`button-see-all-${status}`} onClick={() => setLocation(`/buddies/${encodeURIComponent(userId)}/entries?status=${status}`)} className="text-xs font-bold" style={{ color: ACCENT }}>See all</button>}
              </div>
              <PosterRow items={shelf.items} />
            </section>;
          })}
        </div>
      )}
    </PageFrame>
  );
}

export function BuddyEntries({ params }: { params: { userId: string } }) {
  const [, setLocation] = useLocation();
  const userId = decodeURIComponent(params.userId);
  const requestedStatus = new URLSearchParams(window.location.search).get("status") as ShelfStatus | null;
  const status: ShelfStatus = requestedStatus && requestedStatus in shelfLabels ? requestedStatus : "watching";
  const [items, setItems] = useState<BuddyEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const [errorKey, setErrorKey] = useState("");
  const limit = 30;
  const requestKey = `${userId}:${status}:${offset}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setItems([]);
    setTotal(0);
    setError("");
    setErrorKey("");
    api<{ total: number; items: BuddyEntry[] }>(`/api/buddies/${encodeURIComponent(userId)}/entries?status=${status}&limit=${limit}&offset=${offset}`, { signal: controller.signal })
      .then(data => {
        if (!controller.signal.aborted) {
          setItems(data.items);
          setTotal(data.total);
          setLoadedKey(requestKey);
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setItems([]);
          setTotal(0);
          setError(err.message || "Could not load titles.");
          setErrorKey(requestKey);
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [userId, status, offset, requestKey]);

  const currentError = errorKey === requestKey ? error : "";
  const currentPageLoaded = loadedKey === requestKey;

  return (
    <PageFrame title={shelfLabels[status]} back={`/buddies/${encodeURIComponent(userId)}`}>
      {currentError ? <p data-testid="status-buddy-entries-error" style={{ color: "#FFC4B8" }}>{currentError}</p> : loading || !currentPageLoaded ? <p data-testid="status-buddy-entries-loading" style={{ color: MUTED }}>Loading titles…</p> : (
        <>
          <p className="mb-4 text-sm" style={{ color: MUTED }}>{total} titles</p>
          {items.length ? <div className="grid grid-cols-2 gap-3">
            {items.map((entry, index) => <div key={`${entry.tmdbId}-${index}`} className="rounded-2xl p-3" style={{ background: CARD_BG }}>
              <div className="h-52 rounded-xl overflow-hidden flex items-center justify-center" style={{ background: "#245A35" }}>
                {entry.posterUrl ? <img src={entry.posterUrl} alt="" loading="lazy" className="w-full h-full object-cover" /> : <span className="text-xs" style={{ color: MUTED }}>Poster unavailable</span>}
              </div>
              <p className="mt-2 text-sm font-bold" data-testid={`text-buddy-entry-${entry.tmdbId}`}>{entry.title}</p>
              <p className="mt-1 text-xs capitalize" style={{ color: MUTED }}>{entry.type}</p>
            </div>)}
          </div> : <p className="text-sm" style={{ color: MUTED }}>No titles to show.</p>}
          <div className="flex justify-between mt-5">
            <button data-testid="button-buddy-entries-previous" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40" style={{ background: CARD_BG, color: ACCENT }}>Previous</button>
            <button data-testid="button-buddy-entries-next" disabled={offset + items.length >= total} onClick={() => setOffset(offset + limit)} className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40" style={{ background: CARD_BG, color: ACCENT }}>Next</button>
          </div>
        </>
      )}
    </PageFrame>
  );
}