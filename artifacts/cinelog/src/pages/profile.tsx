import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { ChevronLeft, LogOut, Edit2, Check, X } from "lucide-react";
import { SpudMascot } from "@/components/spud-mascot";
import { CouchPotatoLogo } from "@/components/couch-potato-logo";
import { useListEntries } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Profile() {
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { user, isLoaded } = useUser();
  const { toast } = useToast();

  const [profile, setProfile] = useState<{ username: string | null; bio: string | null } | null>(null);
  const [editingUsername, setEditingUsername] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [usernameVal, setUsernameVal] = useState("");
  const [bioVal, setBioVal] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: allEntries } = useListEntries({} as any);
  const { data: watching } = useListEntries({ status: "watching" } as any);
  const { data: watchlist } = useListEntries({ status: "plan_to_watch" } as any);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p) => {
        setProfile(p);
        setUsernameVal(p.username ?? "");
        setBioVal(p.bio ?? "");
      })
      .catch(() => {});
  }, []);

  const saveUsername = async () => {
    if (!usernameVal.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameVal.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed");
      }
      const updated = await res.json();
      setProfile(updated);
      setEditingUsername(false);
      toast({ title: "Username saved" });
    } catch (e: any) {
      toast({ title: "Could not save username", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveBio = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: bioVal.trim() || null }),
      });
      const updated = await res.json();
      setProfile(updated);
      setEditingBio(false);
      toast({ title: "Bio saved" });
    } catch {
      toast({ title: "Could not save bio", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const watched = (allEntries ?? []).filter((e: any) => e.status === "completed").length;
  const watchingCount = watching?.length ?? 0;
  const queueCount = watchlist?.length ?? 0;

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

      {/* Avatar + name */}
      <div className="px-5 flex flex-col items-center pb-6">
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={user.fullName ?? "Profile"}
            className="w-24 h-24 rounded-full object-cover border-4"
            style={{ borderColor: "#116149" }}
          />
        ) : (
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold"
            style={{ background: "#EFE4D2", color: "#116149" }}
          >
            {(user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "?").toUpperCase()}
          </div>
        )}
        <h1 className="mt-4 text-xl font-bold" style={{ color: "#111111" }}>
          {user?.fullName ?? user?.emailAddresses?.[0]?.emailAddress ?? "Your Account"}
        </h1>
        {user?.primaryEmailAddress && (
          <p className="text-sm mt-0.5" style={{ color: "#7E7A73" }}>
            {user.primaryEmailAddress.emailAddress}
          </p>
        )}
        {memberSince && (
          <p className="text-xs mt-1" style={{ color: "#7E7A73" }}>
            Member since {memberSince}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="mx-5 mb-5 rounded-2xl p-4" style={{ background: "#116149" }}>
        <div className="grid grid-cols-3 gap-2 text-white text-center">
          <div>
            <p className="text-2xl font-bold">{watched}</p>
            <p className="text-xs opacity-70 mt-0.5">Watched</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{watchingCount}</p>
            <p className="text-xs opacity-70 mt-0.5">Watching</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{queueCount}</p>
            <p className="text-xs opacity-70 mt-0.5">Watchlist</p>
          </div>
        </div>
      </div>

      {/* Username */}
      <div className="mx-5 mb-3 rounded-2xl p-4" style={{ background: "#ffffff", border: "1px solid #E2D9CE" }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#7E7A73" }}>Username</p>
          {!editingUsername && (
            <button onClick={() => setEditingUsername(true)}>
              <Edit2 className="w-4 h-4" style={{ color: "#7E7A73" }} />
            </button>
          )}
        </div>
        {editingUsername ? (
          <div className="flex items-center gap-2 mt-2">
            <input
              value={usernameVal}
              onChange={(e) => setUsernameVal(e.target.value)}
              placeholder="yourhandle"
              className="flex-1 px-3 py-2 rounded-xl text-sm font-semibold focus:outline-none"
              style={{ background: "#FFF3E8", border: "1.5px solid #116149", color: "#111111" }}
              autoFocus
            />
            <button onClick={saveUsername} disabled={saving} className="p-2 rounded-xl" style={{ background: "#116149" }}>
              <Check className="w-4 h-4 text-white" />
            </button>
            <button onClick={() => { setEditingUsername(false); setUsernameVal(profile?.username ?? ""); }} className="p-2 rounded-xl" style={{ background: "#EFE4D2" }}>
              <X className="w-4 h-4" style={{ color: "#7E7A73" }} />
            </button>
          </div>
        ) : (
          <p className="text-sm font-semibold mt-1" style={{ color: profile?.username ? "#111111" : "#7E7A73" }}>
            {profile?.username ? `@${profile.username}` : "No username set yet"}
          </p>
        )}
      </div>

      {/* Bio */}
      <div className="mx-5 mb-5 rounded-2xl p-4" style={{ background: "#ffffff", border: "1px solid #E2D9CE" }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#7E7A73" }}>Bio</p>
          {!editingBio && (
            <button onClick={() => setEditingBio(true)}>
              <Edit2 className="w-4 h-4" style={{ color: "#7E7A73" }} />
            </button>
          )}
        </div>
        {editingBio ? (
          <div className="mt-2">
            <textarea
              value={bioVal}
              onChange={(e) => setBioVal(e.target.value)}
              placeholder="A little about your taste in film and TV…"
              rows={3}
              maxLength={200}
              className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none resize-none"
              style={{ background: "#FFF3E8", border: "1.5px solid #116149", color: "#111111" }}
              autoFocus
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs" style={{ color: "#7E7A73" }}>{bioVal.length}/200</p>
              <div className="flex gap-2">
                <button onClick={saveBio} disabled={saving} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white" style={{ background: "#116149" }}>Save</button>
                <button onClick={() => { setEditingBio(false); setBioVal(profile?.bio ?? ""); }} className="px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: "#EFE4D2", color: "#7E7A73" }}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm mt-1 leading-relaxed" style={{ color: profile?.bio ? "#111111" : "#7E7A73" }}>
            {profile?.bio ?? "No bio yet. Tell the world about your taste."}
          </p>
        )}
      </div>

      {/* Mascot */}
      <div className="flex justify-center mb-4">
        <SpudMascot pose="relaxed" size={80} round={false} />
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
