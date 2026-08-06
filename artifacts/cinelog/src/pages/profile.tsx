import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { ChevronLeft, LogOut, Edit2, Camera, ZoomIn, ZoomOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// All 14 Spud avatar variants (numbers match spud-avatar-N.png filenames)
const SPUD_AVATARS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const PREVIEW_SIZE = 256; // px — size of the crop circle preview

// ── Interactive crop modal ──────────────────────────────────────────────────
function CropModal({
  imageSrc,
  onConfirm,
  onCancel,
}: {
  imageSrc: string;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const [scale, setScale]             = useState(1);
  const [dragX, setDragX]             = useState(0);
  const [dragY, setDragY]             = useState(0);
  const [dragging, setDragging]       = useState(false);
  const [nat, setNat]                 = useState<{ w: number; h: number } | null>(null);
  const lastPos                       = useRef<{ x: number; y: number } | null>(null);
  const imgRef                        = useRef<HTMLImageElement>(null);

  // clamp drag so the image never shows empty space inside the circle
  const clamp = (next: number, axis: "x" | "y", sc: number) => {
    if (!nat) return next;
    const base = Math.max(PREVIEW_SIZE / nat.w, PREVIEW_SIZE / nat.h);
    const total = base * sc;
    const half = (axis === "x" ? nat.w * total - PREVIEW_SIZE : nat.h * total - PREVIEW_SIZE) / 2;
    return Math.max(-half, Math.min(half, next));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !lastPos.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setDragX(prev => clamp(prev + dx, "x", scale));
    setDragY(prev => clamp(prev + dy, "y", scale));
  };
  const onPointerUp = () => { setDragging(false); lastPos.current = null; };

  const onScaleChange = (next: number) => {
    setScale(next);
    // re-clamp offsets when zooming out (image might no longer cover)
    setDragX(prev => clamp(prev, "x", next));
    setDragY(prev => clamp(prev, "y", next));
  };

  const confirm = () => {
    if (!nat || !imgRef.current) return;
    const OUTPUT = 400;
    const base  = Math.max(OUTPUT / nat.w, OUTPUT / nat.h);
    const total = base * scale;
    const ratio = OUTPUT / PREVIEW_SIZE;
    const x = (OUTPUT - nat.w * total) / 2 + dragX * ratio;
    const y = (OUTPUT - nat.h * total) / 2 + dragY * ratio;
    const canvas = document.createElement("canvas");
    canvas.width  = OUTPUT;
    canvas.height = OUTPUT;
    canvas.getContext("2d")!.drawImage(imgRef.current, x, y, nat.w * total, nat.h * total);
    onConfirm(canvas.toDataURL("image/jpeg", 0.9));
  };

  // computed image dimensions for the preview
  const imgStyle: React.CSSProperties = nat ? (() => {
    const base  = Math.max(PREVIEW_SIZE / nat.w, PREVIEW_SIZE / nat.h);
    const total = base * scale;
    return {
      position: "absolute",
      width:  nat.w * total,
      height: nat.h * total,
      left: (PREVIEW_SIZE - nat.w * total) / 2 + dragX,
      top:  (PREVIEW_SIZE - nat.h * total) / 2 + dragY,
      maxWidth: "none",
      maxHeight: "none",
      userSelect: "none",
      pointerEvents: "none" as const,
    };
  })() : { width: "100%", height: "100%", objectFit: "cover" as const };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center pb-6 px-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: "#1A4A2A" }}>
        <div className="px-6 pt-6 pb-2">
          <p className="text-sm font-bold text-center mb-1" style={{ color: "#ffffff" }}>
            Position your photo
          </p>
          <p className="text-xs text-center mb-4" style={{ color: "#A8D4B0" }}>
            Drag to reposition · Slide to zoom
          </p>

          {/* Circle crop preview */}
          <div className="flex justify-center mb-4">
            <div
              style={{
                width: PREVIEW_SIZE,
                height: PREVIEW_SIZE,
                borderRadius: "50%",
                overflow: "hidden",
                position: "relative",
                cursor: dragging ? "grabbing" : "grab",
                border: "3px solid #7EDC5A",
                flexShrink: 0,
                touchAction: "none",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="crop"
                draggable={false}
                onLoad={e => {
                  const i = e.currentTarget;
                  setNat({ w: i.naturalWidth, h: i.naturalHeight });
                }}
                style={imgStyle}
              />
            </div>
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-3 mx-2 mb-5">
            <ZoomOut className="w-4 h-4 flex-shrink-0" style={{ color: "#A8D4B0" }} />
            <input
              type="range"
              min={1} max={3} step={0.02}
              value={scale}
              onChange={e => onScaleChange(Number(e.target.value))}
              className="flex-1"
              style={{ accentColor: "#7EDC5A" }}
            />
            <ZoomIn className="w-4 h-4 flex-shrink-0" style={{ color: "#A8D4B0" }} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={confirm}
            className="flex-1 py-3 rounded-2xl text-sm font-bold"
            style={{ background: "#7EDC5A", color: "#0F2D1C" }}
          >
            Use this photo
          </button>
          <button
            onClick={onCancel}
            className="px-5 py-3 rounded-2xl text-sm font-semibold"
            style={{ background: "#1E5530", color: "#A8D4B0" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Hoisted outside Profile so React never unmounts/remounts inputs on re-render ── */
function InlineEditor({
  label, onSave, onCancel, children, fieldError, saving,
}: {
  label: string;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
  fieldError: string;
  saving: boolean;
}) {
  return (
    <div>
      {children}
      {fieldError && (
        <p className="text-xs font-semibold mt-1.5" style={{ color: "#DC2626" }}>{fieldError}</p>
      )}
      <div className="flex gap-2 mt-3">
        <button
          onClick={onSave} disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60"
          style={{ background: "#7EDC5A", color: "#0F2D1C" }}
        >
          {saving ? "Saving…" : `Save ${label}`}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "#1E5530", color: "#A8D4B0" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

type ProfileData = {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  bio: string | null;
  avatarId: string | null;
  avatarUrl: string | null;
};

type FriendProfile = {
  userId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarId: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

type FriendsResult = {
  friends: FriendProfile[];
  status: "ok" | "not_connected" | "no_friends" | "fb_error" | "error";
};

// Small avatar for a friend card (same precedence logic as main profile)
function FriendAvatar({ friend }: { friend: FriendProfile }) {
  const initials = (() => {
    const f = friend.firstName?.[0] ?? "";
    const l = friend.lastName?.[0] ?? "";
    return ((f + l).toUpperCase()) || friend.username?.[0]?.toUpperCase() || "?";
  })();
  return (
    <div
      className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
      style={{ background: "#1E5530" }}
    >
      {friend.avatarUrl ? (
        <img src={friend.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
      ) : friend.avatarId ? (
        <img
          src={`/spud-avatar-${friend.avatarId}.png`}
          alt="Spud avatar"
          className="w-full h-full object-contain p-0.5"
        />
      ) : (
        <span className="text-sm font-bold" style={{ color: "#7EDC5A" }}>{initials}</span>
      )}
    </div>
  );
}

type EditField = "name" | "bio" | null;

export default function Profile() {
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState<EditField>(null);

  const [firstNameVal, setFirstNameVal] = useState("");
  const [lastNameVal,  setLastNameVal]  = useState("");
  const [bioVal,       setBioVal]       = useState("");
  const [fieldError,   setFieldError]   = useState("");
  const [saving,       setSaving]       = useState(false);

  // Avatar state
  const [avatarId,    setAvatarId]    = useState<string | null>(null);
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [cropSrc,     setCropSrc]     = useState<string | null>(null);

  // Friends discovery
  const [friendsResult, setFriendsResult] = useState<FriendsResult | null>(null);
  const [friendsLoading, setFriendsLoading] = useState(true);


  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(p => {
        setProfile(p);
        setFirstNameVal(p.firstName ?? "");
        setLastNameVal(p.lastName ?? "");
        setBioVal(p.bio ?? "");
        setAvatarId(p.avatarId ?? null);
        setAvatarUrl(p.avatarUrl ?? null);
      })
      .catch(() => {});
  }, []);

  // Load friends once after sign-in (non-blocking)
  useEffect(() => {
    if (!isLoaded) return;
    fetch("/api/profile/friends")
      .then(r => r.json())
      .then((data: FriendsResult) => setFriendsResult(data))
      .catch(() => setFriendsResult({ friends: [], status: "error" }))
      .finally(() => setFriendsLoading(false));
  }, [isLoaded]);

  const startEdit = (field: EditField) => { setEditing(field); setFieldError(""); };
  const cancelEdit = () => {
    setEditing(null);
    setFieldError("");
    setFirstNameVal(profile?.firstName ?? "");
    setLastNameVal(profile?.lastName ?? "");
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
      // Sync name to Clerk only after a successful app DB save
      if (payload.firstName !== undefined || payload.lastName !== undefined) {
        user?.update({
          firstName: payload.firstName ?? user?.firstName ?? "",
          lastName:  payload.lastName  ?? user?.lastName  ?? "",
        }).catch((e) => console.warn("[Clerk sync] name update failed:", e));
      }
    } catch {
      setFieldError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  const saveName     = () => {
    if (!firstNameVal.trim()) { setFieldError("First name is required"); return; }
    save({ firstName: firstNameVal.trim(), lastName: lastNameVal.trim() || null });
  };
  const saveBio = () => save({ bio: bioVal.trim() || null });

  const resetRecommendationHistory = async () => {
    try {
      const res = await fetch("/api/recommendations/history", { method: "DELETE" });
      if (res.ok) {
        toast({ title: "✓ Fresh picks ready", description: "Your recommendation history has been cleared." });
      } else {
        toast({ title: "Couldn't reset history — please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error — please try again", variant: "destructive" });
    } finally {
      // no-op
    }
  };

  // ── Avatar save ──
  const saveAvatar = async (patch: { avatarId: string | null; avatarUrl: string | null }) => {
    setSavingAvatar(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = await res.json();
        setAvatarId(updated.avatarId ?? null);
        setAvatarUrl(updated.avatarUrl ?? null);
        toast({ title: "Photo saved ✓" });
        // Sync to Clerk only after the app DB save succeeded
        if (patch.avatarUrl) {
          // Custom cropped photo — convert data URL to File
          fetch(patch.avatarUrl)
            .then(r => r.blob())
            .then(blob => user?.setProfileImage({ file: new File([blob], "avatar.jpg", { type: "image/jpeg" }) }))
            .catch(e => console.warn("[Clerk sync] photo upload failed:", e));
        } else if (patch.avatarId) {
          // Spud preset — fetch the PNG and push it to Clerk so both systems match
          fetch(`/spud-avatar-${patch.avatarId}.png`)
            .then(r => r.blob())
            .then(blob => user?.setProfileImage({ file: new File([blob], `spud-${patch.avatarId}.png`, { type: "image/png" }) }))
            .catch(e => console.warn("[Clerk sync] spud avatar sync failed:", e));
        }
      } else {
        toast({ title: "Could not save your photo — please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error — could not save photo", variant: "destructive" });
    } finally {
      setSavingAvatar(false);
    }
  };

  // ── Photo upload: open the crop modal instead of auto-saving ──
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCropSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropConfirm = (dataUrl: string) => {
    setCropSrc(null);
    // saveAvatar handles both the DB save and the Clerk sync in order
    saveAvatar({ avatarId: null, avatarUrl: dataUrl });
  };


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

  const inputStyle = (hasError?: boolean) => ({
    width: "100%",
    padding: "10px 14px",
    borderRadius: 12,
    border: `1.5px solid ${hasError ? "#DC2626" : "#7EDC5A"}`,
    background: "#1A4A2A",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    outline: "none",
  });

  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    const main = document.querySelector("main") as HTMLElement | null;
    const wrapper = main?.parentElement as HTMLElement | null;
    const prevWrapper = wrapper?.style.background ?? "";
    document.documentElement.style.background = "#0F2D1C";
    document.body.style.background = "#0F2D1C";
    if (wrapper) wrapper.style.background = "#0F2D1C";
    return () => {
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
      if (wrapper) wrapper.style.background = prevWrapper;
    };
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ background: "#0F2D1C" }}>
        <div className="w-10 h-10 rounded-full animate-pulse" style={{ background: "#1A4A2A" }} />
      </div>
    );
  }

  return (
    <div className="min-h-full pb-24" style={{ background: "#0F2D1C" }}>
      {/* ── Interactive crop modal ── */}
      {cropSrc && (
        <CropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* ── Header: back button only, no logo ── */}
      <div className="px-5 pt-8 pb-4 flex items-center">
        <button onClick={() => setLocation("/")} className="p-2 -ml-2 active:opacity-60">
          <ChevronLeft className="w-6 h-6" style={{ color: "#A8D4B0" }} />
        </button>
        <h1 className="text-base font-bold ml-2" style={{ color: "#ffffff" }}>My Profile</h1>
      </div>

      {/* ── Avatar circle + name ── */}
      <div className="px-5 flex flex-col items-center pb-6">
        <div
          className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
          style={{ background: "#D4F5A0", border: "3px solid #7EDC5A" }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile photo" className="w-full h-full object-cover" />
          ) : avatarId ? (
            <img
              src={`/spud-avatar-${avatarId}.png`}
              alt="Spud avatar"
              className="w-full h-full object-contain p-1"
            />
          ) : (
            <span className="text-3xl font-bold" style={{ color: "#7EDC5A" }}>{initials}</span>
          )}
        </div>
        <h2 className="mt-3 text-xl font-bold text-center" style={{ color: "#ffffff" }}>
          {displayName}
        </h2>
        {user?.primaryEmailAddress && (
          <p className="text-sm mt-0.5" style={{ color: "#A8D4B0" }}>
            {user.primaryEmailAddress.emailAddress}
          </p>
        )}
        {memberSince && (
          <p className="text-xs mt-1" style={{ color: "#A8D4B0" }}>Member since {memberSince}</p>
        )}
      </div>

      {/* ── Avatar picker ── */}
      <div className="mx-5 mb-4 rounded-2xl p-4" style={{ background: "#82C97E" }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#0F2D1C" }}>
          Choose your Spud or upload your picture.
        </p>

        {/* Grid: 14 Spud variants + 1 photo upload button */}
        <div className="grid grid-cols-5 gap-2">
          {SPUD_AVATARS.map((id) => (
            <button
              key={id}
              onClick={() => saveAvatar({ avatarId: String(id), avatarUrl: null })}
              disabled={savingAvatar}
              style={{
                aspectRatio: "1",
                borderRadius: "50%",
                overflow: "hidden",
                background: "#D4F5A0",
                border: avatarId === String(id) && !avatarUrl
                  ? "3px solid #7EDC5A"
                  : "2.5px solid transparent",
                padding: 0,
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
            >
              <img
                src={`/spud-avatar-${id}.png`}
                alt={`Spud ${id}`}
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />
            </button>
          ))}

          {/* Upload your own photo */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={savingAvatar}
            style={{
              aspectRatio: "1",
              borderRadius: "50%",
              background: avatarUrl ? "#D4F5A0" : "#1A4A2A",
              border: avatarUrl ? "3px solid #7EDC5A" : "2.5px dashed #7EDC5A",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              gap: 2,
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Your photo" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
            ) : (
              <>
                <Camera style={{ width: 18, height: 18, color: "#7EDC5A" }} />
                <span style={{ fontSize: 8, fontWeight: 700, color: "#7EDC5A", lineHeight: 1 }}>Photo</span>
              </>
            )}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoUpload}
        />

        {savingAvatar && (
          <p className="text-xs text-center mt-2" style={{ color: "#2A6B30" }}>Saving avatar…</p>
        )}
      </div>

      {/* ── Name card ── */}
      <div className="mx-5 mb-3 rounded-2xl p-4" style={{ background: "#1A4A2A" }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#7EDC5A" }}>Name</p>
          {editing !== "name" && (
            <button onClick={() => startEdit("name")}><Edit2 className="w-4 h-4" style={{ color: "#A8D4B0" }} /></button>
          )}
        </div>
        {editing === "name" ? (
          <InlineEditor label="name" onSave={saveName} onCancel={cancelEdit} fieldError={fieldError} saving={saving}>
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
          <p className="text-sm font-semibold" style={{ color: displayName !== "Your Account" ? "#ffffff" : "#A8D4B0" }}>
            {[profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Not set yet"}
          </p>
        )}
      </div>

      {/* ── Bio card ── */}
      <div className="mx-5 mb-5 rounded-2xl p-4" style={{ background: "#1A4A2A" }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#7EDC5A" }}>Bio</p>
          {editing !== "bio" && (
            <button onClick={() => startEdit("bio")}><Edit2 className="w-4 h-4" style={{ color: "#A8D4B0" }} /></button>
          )}
        </div>
        {editing === "bio" ? (
          <InlineEditor label="bio" onSave={saveBio} onCancel={cancelEdit} fieldError={fieldError} saving={saving}>
            <textarea
              value={bioVal}
              onChange={e => setBioVal(e.target.value)}
              placeholder="A little about your taste in film and TV…"
              rows={3}
              maxLength={200}
              style={{ ...inputStyle(), resize: "none", lineHeight: 1.5 }}
              autoFocus
            />
            <p className="text-xs mt-1 text-right" style={{ color: "#A8D4B0" }}>{bioVal.length}/200</p>
          </InlineEditor>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: profile?.bio ? "#ffffff" : "#A8D4B0" }}>
            {profile?.bio ?? "Nothing here yet."}
          </p>
        )}
      </div>

      {/* ── Friends on Spud ── */}
      <div className="mx-5 mb-5 rounded-2xl p-4" style={{ background: "#1A4A2A" }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#7EDC5A" }}>
          Friends on Spud
        </p>

        {friendsLoading ? (
          /* Loading shimmer */
          <div className="space-y-3">
            {[0, 1].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full animate-pulse" style={{ background: "#1E5530" }} />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded-full animate-pulse" style={{ background: "#1E5530", width: "55%" }} />
                  <div className="h-2.5 rounded-full animate-pulse" style={{ background: "#1E5530", width: "35%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : friendsResult?.status === "not_connected" ? (
          /* Facebook not connected */
          <div className="text-center py-3">
            <p className="text-2xl mb-1">👥</p>
            <p className="text-sm font-semibold" style={{ color: "#ffffff" }}>Connect Facebook to find friends</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "#A8D4B0" }}>
              Sign in with Facebook to see which of your friends are already on Spud.
            </p>
          </div>
        ) : friendsResult?.friends && friendsResult.friends.length > 0 ? (
          /* Friend list */
          <div className="space-y-3">
            {friendsResult.friends.map(friend => {
              const name = [friend.firstName, friend.lastName].filter(Boolean).join(" ")
                || friend.username
                || "Spud User";
              return (
                <div key={friend.userId} className="flex items-center gap-3">
                  <FriendAvatar friend={friend} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: "#ffffff" }}>{name}</p>
                    {friend.username && (
                      <p className="text-xs" style={{ color: "#A8D4B0" }}>@{friend.username}</p>
                    )}
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: "#7EDC5A", color: "#0F2D1C" }}
                  >
                    🥔 Here
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          /* No friends found yet (or permission pending) */
          <div className="text-center py-3">
            <p className="text-2xl mb-1">🍿</p>
            <p className="text-sm font-semibold" style={{ color: "#ffffff" }}>No friends here yet</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "#A8D4B0" }}>
              None of your Facebook friends have joined Spud yet — invite them!
            </p>
          </div>
        )}
      </div>

      {/* ── Sign out ── */}
      <div className="px-5">
        <button
          onClick={() => signOut({ redirectUrl: basePath || "/" })}
          className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:opacity-70"
          style={{ background: "#1A4A2A", color: "#7EDC5A", border: "1.5px solid #7EDC5A" }}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
