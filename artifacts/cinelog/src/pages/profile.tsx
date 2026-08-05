import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { ChevronLeft, LogOut, Edit2, Camera, ZoomIn, ZoomOut } from "lucide-react";
import { useListEntries } from "@workspace/api-client-react";
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
      <div className="w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: "#ffffff" }}>
        <div className="px-6 pt-6 pb-2">
          <p className="text-sm font-bold text-center mb-1" style={{ color: "#111111" }}>
            Position your photo
          </p>
          <p className="text-xs text-center mb-4" style={{ color: "#7E7A73" }}>
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
                border: "3px solid #116149",
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
            <ZoomOut className="w-4 h-4 flex-shrink-0" style={{ color: "#7E7A73" }} />
            <input
              type="range"
              min={1} max={3} step={0.02}
              value={scale}
              onChange={e => onScaleChange(Number(e.target.value))}
              className="flex-1"
              style={{ accentColor: "#116149" }}
            />
            <ZoomIn className="w-4 h-4 flex-shrink-0" style={{ color: "#7E7A73" }} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={confirm}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white"
            style={{ background: "#116149" }}
          >
            Use this photo
          </button>
          <button
            onClick={onCancel}
            className="px-5 py-3 rounded-2xl text-sm font-semibold"
            style={{ background: "#EFE4D2", color: "#7E7A73" }}
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
}

type ProfileData = {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  bio: string | null;
  avatarId: string | null;
  avatarUrl: string | null;
};

type EditField = "name" | "username" | "bio" | null;

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
  const [usernameVal,  setUsernameVal]  = useState("");
  const [bioVal,       setBioVal]       = useState("");
  const [fieldError,   setFieldError]   = useState("");
  const [saving,       setSaving]       = useState(false);

  // Avatar state
  const [avatarId,    setAvatarId]    = useState<string | null>(null);
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [cropSrc,     setCropSrc]     = useState<string | null>(null);

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
        setAvatarId(p.avatarId ?? null);
        setAvatarUrl(p.avatarUrl ?? null);
      })
      .catch(() => {});
  }, []);

  const startEdit = (field: EditField) => { setEditing(field); setFieldError(""); };
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
  const saveUsername = () => {
    if (!usernameVal.trim()) { setFieldError("Username is required"); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(usernameVal.trim())) {
      setFieldError("Only letters, numbers and underscores — no spaces");
      return;
    }
    save({ username: usernameVal.trim().toLowerCase() });
  };
  const saveBio = () => save({ bio: bioVal.trim() || null });

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

  if (!isLoaded) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ background: "#FFF3E8" }}>
        <div className="w-10 h-10 rounded-full animate-pulse" style={{ background: "#EFE4D2" }} />
      </div>
    );
  }

  return (
    <div className="min-h-full pb-24" style={{ background: "#FFF3E8" }}>
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
          <ChevronLeft className="w-6 h-6" style={{ color: "#111111" }} />
        </button>
        <h1 className="text-base font-bold ml-2" style={{ color: "#111111" }}>My Profile</h1>
      </div>

      {/* ── Avatar circle + name ── */}
      <div className="px-5 flex flex-col items-center pb-6">
        <div
          className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
          style={{ background: "#EFE4D2" }}
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
            <span className="text-3xl font-bold" style={{ color: "#116149" }}>{initials}</span>
          )}
        </div>
        <h2 className="mt-3 text-xl font-bold text-center" style={{ color: "#111111" }}>
          {displayName}
        </h2>
        {user?.primaryEmailAddress && (
          <p className="text-sm mt-0.5" style={{ color: "#7E7A73" }}>
            {user.primaryEmailAddress.emailAddress}
          </p>
        )}
        {memberSince && (
          <p className="text-xs mt-1" style={{ color: "#7E7A73" }}>Member since {memberSince}</p>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="mx-5 mb-4 rounded-2xl p-4" style={{ background: "#116149" }}>
        <div className="grid grid-cols-3 gap-2 text-white text-center">
          <div><p className="text-2xl font-bold">{watched}</p><p className="text-xs opacity-70 mt-0.5">Watched</p></div>
          <div><p className="text-2xl font-bold">{watchingCount}</p><p className="text-xs opacity-70 mt-0.5">Watching</p></div>
          <div><p className="text-2xl font-bold">{queueCount}</p><p className="text-xs opacity-70 mt-0.5">Watchlist</p></div>
        </div>
      </div>

      {/* ── Avatar picker ── */}
      <div className="mx-5 mb-4 rounded-2xl p-4" style={{ background: "#ffffff", border: "1px solid #E2D9CE" }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#7E7A73" }}>
          Choose your avatar
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
                background: "#EFE4D2",
                border: avatarId === String(id) && !avatarUrl
                  ? "3px solid #116149"
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
              background: avatarUrl ? "#EFE4D2" : "#F5F0EB",
              border: avatarUrl ? "3px solid #116149" : "2.5px dashed #C4B9AD",
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
                <Camera style={{ width: 18, height: 18, color: "#7E7A73" }} />
                <span style={{ fontSize: 8, fontWeight: 700, color: "#7E7A73", lineHeight: 1 }}>Photo</span>
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
          <p className="text-xs text-center mt-2" style={{ color: "#7E7A73" }}>Saving avatar…</p>
        )}
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
          <InlineEditor label="username" onSave={saveUsername} onCancel={cancelEdit} fieldError={fieldError} saving={saving}>
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
            <p className="text-xs mt-1 text-right" style={{ color: "#7E7A73" }}>{bioVal.length}/200</p>
          </InlineEditor>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: profile?.bio ? "#111111" : "#7E7A73" }}>
            {profile?.bio ?? "Nothing here yet."}
          </p>
        )}
      </div>

      {/* ── Sign out ── */}
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
