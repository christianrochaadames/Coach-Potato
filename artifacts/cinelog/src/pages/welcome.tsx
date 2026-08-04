import { useState } from "react";
import { useLocation } from "wouter";

const PASTEL_MINT = "#E2F5EC";
const GREEN = "#116149";

export default function Welcome() {
  const [, setLocation] = useLocation();
  const [showForm, setShowForm]   = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [username, setUsername]   = useState("");
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [saving, setSaving]       = useState(false);
  const [apiError, setApiError]   = useState("");

  const validate = () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = "First name is required";
    if (!username.trim()) {
      e.username = "Username is required";
    } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      e.username = "Only letters, numbers and underscores — no spaces";
    } else if (username.trim().length < 2) {
      e.username = "Must be at least 2 characters";
    }
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setApiError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim() || null,
          username: username.trim().toLowerCase(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setApiError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setLocation("/onboarding");
    } catch {
      setApiError("Network error — please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = (hasError?: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: hasError ? "2px solid #DC2626" : "2px solid rgba(17,97,73,0.2)",
    background: "#ffffff",
    color: "#111111",
    fontSize: 15,
    fontWeight: 600,
    outline: "none",
  });

  return (
    <div
      className="min-h-[100dvh] flex flex-col overflow-hidden"
      style={{ background: PASTEL_MINT }}
    >

      {/* ═══════════════════════════════════════════════════════════════
          HERO SECTION — Logo (top-left) + large Spud-walk (top-right)
          Fixed height container; Spud allowed to bleed slightly right.
      ════════════════════════════════════════════════════════════════ */}
      <div className="relative flex-shrink-0" style={{ height: 300 }}>

        {/* Logo — upper-left, generous breathing room from edges */}
        <img
          src="/logo-text.png"
          alt="Couch Potato"
          draggable={false}
          style={{
            position: "absolute",
            top: 44,
            left: 14,
            height: 104,
            width: "auto",
            objectFit: "contain",
          }}
        />

        {/* Spud hero — nudged down so he sits clear of the logo */}
        <img
          src="/spud-hero.png"
          alt=""
          aria-hidden
          draggable={false}
          style={{
            position: "absolute",
            top: 44,
            right: -10,
            height: 246,
            width: "auto",
            objectFit: "contain",
          }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TEXT CONTENT — nudged up by reducing top margin
      ════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col px-7" style={{ gap: 0, marginTop: 20 }}>

        {/* "Welcome!" — dominant heading */}
        <h1
          className="font-extrabold leading-none"
          style={{ color: GREEN, fontSize: 52, letterSpacing: -1 }}
        >
          Welcome!
        </h1>

        {/* "I'm Spud." — secondary heading */}
        <h2
          className="font-bold"
          style={{ color: GREEN, fontSize: 28, marginTop: 6 }}
        >
          I'm Spud.
        </h2>

        {/* Body copy */}
        <p
          className="leading-relaxed"
          style={{ color: "#0e4f3a", fontSize: 16, fontWeight: 500, marginTop: 20 }}
        >
          I'm your personal TV and movie sidekick. I'll help you keep track of
          every movie and series you've watched, so you'll never forget a great
          recommendation again.
        </p>

        {/* Personality line */}
        <p
          className="font-semibold leading-relaxed"
          style={{ color: GREEN, fontSize: 16, marginTop: 16 }}
        >
          Next time someone asks what you've been watching lately, you'll know
          exactly where to look.
        </p>
      </div>

      {/* Flexible spacer — pushes button + bottom illustrations down */}
      <div style={{ height: 6 }} />

      {/* ═══════════════════════════════════════════════════════════════
          BOTTOM — couch Spud left, small pill button in the empty
          space to its right. No overlap between button and illustration.
      ════════════════════════════════════════════════════════════════ */}
      {/* Container tall enough to show the full couch image without clipping the hat */}
      <div
        className="relative flex-shrink-0"
        style={{ height: 224, marginBottom: 28 }}
      >
        {/* Couch Spud — left edge aligned with logo/text margin */}
        <img
          src="/spud-couch.png"
          alt=""
          aria-hidden
          draggable={false}
          style={{
            position: "absolute",
            bottom: 0,
            left: 14,
            width: 212,
            height: "auto",
            objectFit: "contain",
            opacity: 0.9,
            mixBlendMode: "multiply",
          }}
        />

        {/* Pill button — centred on the vertical midpoint of the couch illustration */}
        <button
          onClick={() => setShowForm(true)}
          className="font-bold text-white active:opacity-80 transition-opacity"
          style={{
            position: "absolute",
            right: 20,
            top: "54%",
            transform: "translateY(-50%)",
            background: GREEN,
            borderRadius: 9999,
            fontSize: 14,
            padding: "11px 24px",
            whiteSpace: "nowrap",
          }}
        >
          Let's get comfy
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          PROFILE FORM — bottom-sheet, slides up on "Let's get comfy"
      ════════════════════════════════════════════════════════════════ */}
      {showForm && (
        <>
          <div
            className="fixed inset-0 z-20"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => setShowForm(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl px-6 pt-5 pb-10"
            style={{ background: "#ffffff", maxHeight: "88dvh", overflowY: "auto" }}
          >
            <div className="flex justify-center mb-5">
              <div className="w-12 h-1.5 rounded-full" style={{ background: "#E2D9CE" }} />
            </div>

            <h2 className="text-2xl font-bold mb-1" style={{ color: GREEN }}>
              Tell me about yourself
            </h2>
            <p className="text-sm mb-6" style={{ color: "#7E7A73" }}>
              Just a few details to set up your profile.
            </p>

            <div className="flex flex-col gap-4">
              {/* First name */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: GREEN }}>
                  First name <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  value={firstName}
                  onChange={e => { setFirstName(e.target.value); setErrors(p => ({ ...p, firstName: "" })); }}
                  placeholder="Spud"
                  style={inputStyle(!!errors.firstName)}
                  autoCapitalize="words"
                  autoCorrect="off"
                  autoFocus
                />
                {errors.firstName && (
                  <p className="text-xs font-semibold" style={{ color: "#DC2626" }}>{errors.firstName}</p>
                )}
              </div>

              {/* Last name */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: GREEN }}>
                  Last name{" "}
                  <span className="text-xs font-normal normal-case" style={{ color: "#7E7A73" }}>(optional)</span>
                </label>
                <input
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="The Potato"
                  style={inputStyle()}
                  autoCapitalize="words"
                  autoCorrect="off"
                />
              </div>

              {/* Username */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: GREEN }}>
                  Username <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <div className="relative">
                  <span
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold"
                    style={{ color: GREEN }}
                  >
                    @
                  </span>
                  <input
                    value={username}
                    onChange={e => { setUsername(e.target.value.replace(/\s/g, "")); setErrors(p => ({ ...p, username: "" })); }}
                    placeholder="SpudThePotato"
                    style={{ ...inputStyle(!!errors.username), paddingLeft: 32 }}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
                {errors.username ? (
                  <p className="text-xs font-semibold" style={{ color: "#DC2626" }}>{errors.username}</p>
                ) : (
                  <p className="text-xs" style={{ color: "#7E7A73" }}>Letters, numbers and underscores only</p>
                )}
              </div>

              {apiError && (
                <div className="px-4 py-3 rounded-2xl" style={{ background: "#FEF2F2", border: "1.5px solid #FECACA" }}>
                  <p className="text-sm font-semibold" style={{ color: "#DC2626" }}>{apiError}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full font-bold text-base text-white active:opacity-80 transition-opacity disabled:opacity-60"
                style={{ background: GREEN, borderRadius: 9999, padding: "18px 0" }}
              >
                {saving ? "Saving…" : "Let's go →"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
