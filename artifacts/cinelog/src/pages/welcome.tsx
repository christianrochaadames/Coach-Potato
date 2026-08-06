import { useState, useEffect } from "react";
import { useLocation } from "wouter";

export default function Welcome() {
  const [, setLocation] = useLocation();
  const [showForm, setShowForm]   = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [saving, setSaving]       = useState(false);
  const [apiError, setApiError]   = useState("");

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

  const validate = () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = "First name is required";
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
    border: hasError ? "2px solid #DC2626" : "2px solid rgba(17,97,73,0.25)",
    background: "#ffffff",
    color: "#111111",
    fontSize: 15,
    fontWeight: 600,
    outline: "none",
  });

  return (
    /* Outer shell — dark green, peeking at top + bottom */
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: "#0F2D1C", padding: "20px 12px" }}
    >
      {/* ── Big light-green card ── */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{ background: "#D4F5A0", borderRadius: 28 }}
      >
        {/* Hero: logo left + walking Spud right */}
        <div className="relative flex-shrink-0" style={{ height: 220 }}>
          <img
            src="/spud-logo.png"
            alt="Spud"
            draggable={false}
            style={{
              position: "absolute",
              top: 28,
              left: 10,
              height: 84,
              width: "auto",
              objectFit: "contain",
            }}
          />
          <img
            src="/spud-hero.png"
            alt=""
            aria-hidden
            draggable={false}
            style={{
              position: "absolute",
              top: 20,
              right: -8,
              height: 200,
              width: "auto",
              objectFit: "contain",
            }}
          />
        </div>

        {/* Text content */}
        <div className="flex flex-col px-7" style={{ gap: 0 }}>
          <h1
            className="font-extrabold leading-none"
            style={{ color: "#116149", fontSize: 52, letterSpacing: -1 }}
          >
            Welcome!
          </h1>
          <h2
            className="font-bold"
            style={{ color: "#7EDC5A", fontSize: 28, marginTop: 6 }}
          >
            I'm Spud.
          </h2>
          <p
            className="leading-relaxed"
            style={{ color: "#2D6A4F", fontSize: 16, fontWeight: 500, marginTop: 18 }}
          >
            I'm here to help you keep track of every Movie and TV Show you've
            watched, so next time someone asks what you've been watching lately,
            you'll know exactly where to look.
          </p>
        </div>

        {/* Flexible spacer */}
        <div className="flex-1" />

        {/* Bottom: couch Spud left, button right */}
        <div
          className="relative flex-shrink-0"
          style={{ height: 200, marginBottom: 28 }}
        >
          <img
            src="/spud-couch.png"
            alt=""
            aria-hidden
            draggable={false}
            style={{
              position: "absolute",
              bottom: 0,
              left: 10,
              width: 210,
              height: "auto",
              objectFit: "contain",
              mixBlendMode: "multiply",
            }}
          />
          <button
            onClick={() => setShowForm(true)}
            className="font-bold active:opacity-80 transition-opacity"
            style={{
              position: "absolute",
              right: 20,
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              borderRadius: 9999,
              fontSize: 14,
              padding: "12px 26px",
              whiteSpace: "nowrap",
              border: "2px solid #7EDC5A",
              color: "#7EDC5A",
            }}
          >
            Let's get comfy
          </button>
        </div>
      </div>

      {/* ── Profile form bottom-sheet ── */}
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
            <h2 className="text-2xl font-bold mb-1" style={{ color: "#116149" }}>
              Tell me about yourself
            </h2>
            <p className="text-sm mb-6" style={{ color: "#7E7A73" }}>
              Just a few details to set up your profile.
            </p>
            <div className="flex flex-col gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#116149" }}>
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
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#116149" }}>
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
              {apiError && (
                <div className="px-4 py-3 rounded-2xl" style={{ background: "#FEF2F2", border: "1.5px solid #FECACA" }}>
                  <p className="text-sm font-semibold" style={{ color: "#DC2626" }}>{apiError}</p>
                </div>
              )}
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full font-bold text-base text-white active:opacity-80 transition-opacity disabled:opacity-60"
                style={{ background: "#116149", borderRadius: 9999, padding: "18px 0", border: "none" }}
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
