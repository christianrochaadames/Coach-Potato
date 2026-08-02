import { useState } from "react";
import { useLocation } from "wouter";
import { CouchPotatoLogo } from "@/components/couch-potato-logo";

const MINT = "#A9EDCA";

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning!";
  if (h >= 12 && h < 18) return "Good afternoon!";
  return "Good evening!";
}

export default function Welcome() {
  const [, setLocation] = useLocation();

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

  const inputStyle = (hasError?: boolean) => ({
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
      className="min-h-[100dvh] relative flex flex-col overflow-hidden"
      style={{ background: MINT }}
    >
      {/* ── Decorative Spud illustrations ── */}

      {/* Spud with phone — top right, large, peeking in */}
      <img
        src="/spud-phone.png"
        alt=""
        aria-hidden
        draggable={false}
        style={{
          position: "absolute",
          top: -20,
          right: -30,
          width: 200,
          opacity: 0.9,
          pointerEvents: "none",
          userSelect: "none",
          transform: "rotate(8deg)",
          mixBlendMode: "multiply",
        }}
      />

      {/* Spud walking with snacks — left side, mid */}
      <img
        src="/spud-walk.png"
        alt=""
        aria-hidden
        draggable={false}
        style={{
          position: "absolute",
          top: 260,
          left: -28,
          width: 150,
          opacity: 0.85,
          pointerEvents: "none",
          userSelect: "none",
          transform: "rotate(-6deg)",
          mixBlendMode: "multiply",
        }}
      />

      {/* Spud scared/excited — small, right side near form */}
      <img
        src="/spud-scared.png"
        alt=""
        aria-hidden
        draggable={false}
        style={{
          position: "absolute",
          top: 330,
          right: -14,
          width: 110,
          opacity: 0.8,
          pointerEvents: "none",
          userSelect: "none",
          transform: "rotate(5deg) scaleX(-1)",
          mixBlendMode: "multiply",
        }}
      />

      {/* Spud lounging on couch — bottom, full width feel */}
      <img
        src="/spud-couch.png"
        alt=""
        aria-hidden
        draggable={false}
        style={{
          position: "absolute",
          bottom: 72,
          right: -20,
          width: 220,
          opacity: 0.7,
          pointerEvents: "none",
          userSelect: "none",
          transform: "rotate(-3deg)",
          mixBlendMode: "multiply",
        }}
      />

      {/* Spud pizza — tiny accent, bottom-left */}
      <img
        src="/spud-pizza.png"
        alt=""
        aria-hidden
        draggable={false}
        style={{
          position: "absolute",
          bottom: 80,
          left: -22,
          width: 120,
          opacity: 0.65,
          pointerEvents: "none",
          userSelect: "none",
          transform: "rotate(10deg)",
          mixBlendMode: "multiply",
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col flex-1 px-6">

        {/* Logo */}
        <div className="pt-12 mb-6">
          <CouchPotatoLogo size="md" />
        </div>

        {/* Greeting */}
        <div className="mb-7">
          <h1 className="text-3xl font-bold leading-tight" style={{ color: "#116149" }}>
            {getGreeting()} 👋
          </h1>
          <p className="text-base mt-2 leading-relaxed font-medium" style={{ color: "#0e4f3a" }}>
            Quick — tell Spud who you are so we can set up your profile.
          </p>
        </div>

        {/* Form card */}
        <div
          className="rounded-3xl p-5 flex flex-col gap-4"
          style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)" }}
        >
          {/* First name */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#116149" }}>
              First name <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input
              value={firstName}
              onChange={e => { setFirstName(e.target.value); setErrors(p => ({ ...p, firstName: "" })); }}
              placeholder="Christian"
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
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#116149" }}>
              Last name <span className="text-xs font-normal normal-case" style={{ color: "#7E7A73" }}>(optional)</span>
            </label>
            <input
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Smith"
              style={inputStyle()}
              autoCapitalize="words"
              autoCorrect="off"
            />
          </div>

          {/* Username */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#116149" }}>
              Username <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <div className="relative">
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold"
                style={{ color: "#116149" }}
              >
                @
              </span>
              <input
                value={username}
                onChange={e => { setUsername(e.target.value.replace(/\s/g, "")); setErrors(p => ({ ...p, username: "" })); }}
                placeholder="christiansmith"
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
        </div>

        {/* CTA */}
        <div className="mt-5 mb-10">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-4 rounded-2xl font-bold text-base text-white active:opacity-80 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: "#116149" }}
          >
            {saving ? "Saving…" : "Let's go →"}
          </button>
        </div>
      </div>
    </div>
  );
}
