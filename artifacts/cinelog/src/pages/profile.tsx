import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { ChevronLeft, LogOut, Edit2, Check, X } from "lucide-react";
import { CouchPotatoLogo } from "@/components/couch-potato-logo";
import { useListEntries } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type ProfileData = {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  bio: string | null;
};

type EditField = "name" | "username" | "bio" | null;

export default function Profile() {
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { user, isLoaded } = useUser();
  const { toast } = useToast();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState<EditField>(null);

  const [firstNameVal, setFirstNameVal] = useState("");
  const [lastNameVal,  setLastNameVal]  = useState("");
  const [usernameVal,  setUsernameVal]  = useState("");
  const [bioVal,       setBioVal]       = useState("");
  const [fieldError,   setFieldError]   = useState("");
  const [saving,       setSaving]       = useState(false);

  const { data: allEntries } = useListEntries({} as any);
  const { data: watching }   = useListEntries({ status: "watching" } as any);
  const { data: watchlist }  = useListEntries({ status: "plan_to_watch" } as any);

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(p => {
        setProfile(p);
        setFirstNameVal(p.firstName ?? "");
        setLastNameVal(p.lastName ?? "");
        setUsernameVal(p.username ?? "");
        setBioVal(p.bio ?? "");
      })
      .catch(() => {});
  }, []);

  const startEdit = (field: EditField) => {
    setEditing(field);
    setFieldError("");
  };

  const cancelEdit = () => {
    setEditing(null);
    setFieldError("");
    setFirstNameVal(profile?.firstName ?? "");
    setLastNameVal(profile?.lastName ?? "");
    setUsernameVal(profile?.username ?? "");
    setBioVal(profile?.bio ?? "");
  };

  const save = async (payload: Partial<ProfileData>) => {
    setSaving(true);
    setFieldError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFieldError(data.error ?? "Something went wrong");
        return;
      }
      const updated = await res.json();
      setProfile(updated);
      setEditing(null);
      toast({ title: "Saved ✓" });
    } catch {
      setFieldError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  const saveName = () => {
    if (!firstNameVal.trim()) { setFieldError("First name is required"); return; }
    save({ firstName: firstNameVal.trim(), lastName: lastNameVal.trim() || null });
  };

  const saveUsername = () => {
    if (!usernameVal.trim()) { setFieldError("Username is required"); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(usernameVal.trim())) {
      setFieldError("Only letters, numbers and underscores — no spaces");
      return;
    }
    save({ username: usernameVal.trim().toLowerCase() });
  };

  const saveBio = () => save({ bio: bioVal.trim() || null });

  const watched       = (allEntries ?? []).filter((e: any) => e.status === "completed").length;
  const watchingCount = watching?.length ?? 0;
  const queueCount    = watchlist?.length ?? 0;

  const displayName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.username || "Your Account"
    : user?.fullName ?? "Your Account";

  const initials = (() => {
    const f = profile?.firstName ?? user?.firstName ?? "";
    const l = profile?.lastName  ?? user?.lastName  ?? "";
    return ((f[0] ?? "") + (l[0] ?? "")).toUpperCase() || "?";
  })();

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : null;

  if (!isLoaded) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ background: "#FFF3E8" }}>
        <div className="w-10 h-10 rounded-full animate-pulse" style={{ background: "#EFE4D2" }} />
      </div>
    );
  }

  /* ── Reusable inline editor shell ── */
  const InlineEditor = ({
    label, onSave, onCancel, children,
  }: { label: string; onSave: () => void; onCancel: () => void; children: React.ReactNode }) => (
    <div>
      {children}
      {fieldError && (
        <p className="text-xs font-semibold mt-1.5" style={{ color: "#DC2626" }}>{fieldError}</p>
      )}
      <div className="flex gap-2 mt-3">
        <button
          onClick={onSave} disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
          style={{ background: "#116149" }}
        >
          {saving ? "Saving…" : `Save ${label}`}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "#EFE4D2", color: "#7E7A73" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const inputStyle = (hasError?: boolean) => ({
    width: "100%",
    padding: "10px 14px",
    borderRadius: 12,
    border: `1.5px solid ${hasError ? "#DC2626" : "#116149"}`,
    background: "#FFF3E8",
    color: "#111111",
    fontSize: 14,
    fontWeight: 600,
    outline: "none",
  });

  return (
    <div className="min-h-full pb-24" style={{ background: "#FFF3E8" }}>
      {/* Header */}
      <div className="px-5 pt-8 pb-4 flex items-center justify-between">
        <button onClick={() => setLocation("/")} className="p-2 -ml-2 active:opacity-60">
          <ChevronLeft className="w-6 h-6" style={{ color: "#111111" }} />
        </button>
        <CouchPotatoLogo size="sm" />
        <div className="w-10" />
      </div>

      {/* Avatar initials + name */}
      <div className="px-5 flex flex-col items-center pb-6">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
          style={{ background: "#EFE4D2", color: "#116149" }}
        >
          {initials}
        </div>
        <h1 className="mt-3 text-xl font-bold text-center" style={{ color: "#111111" }}>
          {displayName}
        </h1>
        {user?.primaryEmailAddress && (
          <p className="text-sm mt-0.5" style={{ color: "#7E7A73" }}>
            {user.primaryEmailAddress.emailAddress}
          </p>
        )}
        {memberSince && (
          <p className="text-xs mt-1" style={{ color: "#7E7A73" }}>Member since {memberSince}</p>
        )}
      </div>

      {/* Stats */}
      <div className="mx-5 mb-4 rounded-2xl p-4" style={{ background: "#116149" }}>
        <div className="grid grid-cols-3 gap-2 text-white text-center">
          <div><p className="text-2xl font-bold">{watched}</p><p className="text-xs opacity-70 mt-0.5">Watched</p></div>
          <div><p className="text-2xl font-bold">{watchingCount}</p><p className="text-xs opacity-70 mt-0.5">Watching</p></div>
          <div><p className="text-2xl font-bold">{queueCount}</p><p className="text-xs opacity-70 mt-0.5">Watchlist</p></div>
        </div>
      </div>

      {/* ── Name card ── */}
      <div className="mx-5 mb-3 rounded-2xl p-4" style={{ background: "#ffffff", border: "1px solid #E2D9CE" }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#7E7A73" }}>Name</p>
          {editing !== "name" && (
            <button onClick={() => startEdit("name")}><Edit2 className="w-4 h-4" style={{ color: "#7E7A73" }} /></button>
          )}
        </div>
        {editing === "name" ? (
          <InlineEditor label="name" onSave={saveName} onCancel={cancelEdit}>
            <div className="flex gap-2">
              <input
                value={firstNameVal}
                onChange={e => { setFirstNameVal(e.target.value); setFieldError(""); }}
                placeholder="First name"
                style={{ ...inputStyle(!firstNameVal.trim() && !!fieldError), flex: 1 }}
                autoFocus
              />
              <input
                value={lastNameVal}
                onChange={e => setLastNameVal(e.target.value)}
                placeholder="Last name"
                style={{ ...inputStyle(), flex: 1 }}
              />
            </div>
          </InlineEditor>
        ) : (
          <p className="text-sm font-semibold" style={{ color: displayName !== "Your Account" ? "#111111" : "#7E7A73" }}>
            {[profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Not set yet"}
          </p>
        )}
      </div>

      {/* ── Username card ── */}
      <div className="mx-5 mb-3 rounded-2xl p-4" style={{ background: "#ffffff", border: "1px solid #E2D9CE" }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#7E7A73" }}>Username</p>
          {editing !== "username" && (
            <button onClick={() => startEdit("username")}><Edit2 className="w-4 h-4" style={{ color: "#7E7A73" }} /></button>
          )}
        </div>
        {editing === "username" ? (
          <InlineEditor label="username" onSave={saveUsername} onCancel={cancelEdit}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: "#7E7A73" }}>@</span>
              <input
                value={usernameVal}
                onChange={e => { setUsernameVal(e.target.value.replace(/\s/g, "")); setFieldError(""); }}
                placeholder="yourhandle"
                style={{ ...inputStyle(!!fieldError), paddingLeft: 28 }}
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
              />
            </div>
            <p className="text-xs mt-1" style={{ color: "#7E7A73" }}>Letters, numbers and underscores only</p>
          </InlineEditor>
        ) : (
          <p className="text-sm font-semibold" style={{ color: profile?.username ? "#111111" : "#7E7A73" }}>
            {profile?.username ? `@${profile.username}` : "No username set yet"}
          </p>
        )}
      </div>

      {/* ── Bio card ── */}
      <div className="mx-5 mb-5 rounded-2xl p-4" style={{ background: "#ffffff", border: "1px solid #E2D9CE" }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#7E7A73" }}>Bio</p>
          {editing !== "bio" && (
            <button onClick={() => startEdit("bio")}><Edit2 className="w-4 h-4" style={{ color: "#7E7A73" }} /></button>
          )}
        </div>
        {editing === "bio" ? (
          <InlineEditor label="bio" onSave={saveBio} onCancel={cancelEdit}>
            <textarea
              value={bioVal}
              onChange={e => setBioVal(e.target.value)}
              placeholder="A little about your taste in film and TV…"
              rows={3}
              maxLength={200}
              style={{ ...inputStyle(), resize: "none", lineHeight: 1.5 }}
              autoFocus
            />
            <p className="text-xs mt-1 text-right" style={{ color: "#7E7A73" }}>{bioVal.length}/200</p>
          </InlineEditor>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: profile?.bio ? "#111111" : "#7E7A73" }}>
            {profile?.bio ?? "Nothing here yet."}
          </p>
        )}
      </div>

      {/* Sign out */}
      <div className="px-5">
        <button
          onClick={() => signOut({ redirectUrl: basePath || "/" })}
          className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:opacity-70"
          style={{ background: "#EFE4D2", color: "#111111" }}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
