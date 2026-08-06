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
    border: hasError ? "2px solid #DC2626" : "2px solid #3A7A50",
    background: "#1A4A2A",
    color: "#D4F5A0",
    fontSize: 15,
    fontWeight: 600,
    outline: "none",
  });

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: "#0F2D1C" }}
    >
      {/* ── TOP rounded box ── */}
      <div
        style={{
          background: "#1A4A2A",
          borderRadius: 24,
          margin: "16px 16px 0",
          padding: "20px 20px 0",
          overflow: "hidden",
          position: "relative",
          minHeight: 140,
        }}
      >
        {/* Logo top-left */}
        <img
          src="/spud-logo.png"
          alt="Spud"
          draggable={false}
          style={{
            height: 80,
            width: "auto",
            objectFit: "contain",
            position: "relative",
            zIndex: 1,
          }}
        />
        {/* Walking Spud hero — right side, bleeds out of box slightly */}
        <img
          src="/spud-hero.png"
          alt=""
          aria-hidden
          draggable={false}
          style={{
            position: "absolute",
            right: -8,
            bottom: 0,
            height: 190,
            width: "auto",
            objectFit: "contain",
          }}
        />
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col px-6 pt-7">
        <h1
          className="font-black leading-none mb-1"
          style={{ color: "#7EDC5A", fontSize: 48, letterSpacing: -1 }}
        >
          Welcome!
        </h1>
        <h2
          className="font-bold mb-5"
          style={{ color: "#D4F5A0", fontSize: 26 }}
        >
          I'm Spud.
        </h2>
        <p
          className="leading-relaxed"
          style={{ color: "#A8D4B0", fontSize: 15, maxWidth: 340 }}
        >
          I'm here to help you keep track of every Movie and TV Show you've
          watched, so next time someone asks what you've been watching lately,
          you'll know exactly where to look.
        </p>

        {/* ── Couch Spud in profile-style lime box ── */}
        <div className="flex justify-center mt-6">
          <div
            style={{
              background: "#D4F5A0",
              border: "3px solid #7EDC5A",
              borderRadius: 24,
              padding: "12px 16px 0",
              display: "inline-flex",
              alignItems: "flex-end",
              justifyContent: "center",
              overflow: "hidden",
              width: 210,
              height: 170,
            }}
          >
            <img
              src="/spud-couch.png"
              alt=""
              aria-hidden
              draggable={false}
              style={{
                width: 196,
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── BOTTOM rounded box ── */}
      <div
        style={{
          background: "#1A4A2A",
          borderRadius: 24,
          margin: "20px 16px 16px",
          padding: "24px",
        }}
      >
        <button
          onClick={() => setShowForm(true)}
          className="w-full font-bold text-base active:opacity-80 transition-opacity"
          style={{
            background: "#7EDC5A",
            color: "#0F2D1C",
            borderRadius: 9999,
            padding: "16px 0",
            border: "none",
          }}
        >
          Let's get comfy
        </button>
      </div>

      {/* ── Profile form bottom-sheet ── */}
      {showForm && (
        <>
          <div
            className="fixed inset-0 z-20"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={() => setShowForm(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl px-6 pt-5 pb-10"
            style={{ background: "#1A4A2A", maxHeight: "88dvh", overflowY: "auto" }}
          >
            <div className="flex justify-center mb-5">
              <div className="w-12 h-1.5 rounded-full" style={{ background: "#3A7A50" }} />
            </div>

            <h2 className="text-2xl font-bold mb-1" style={{ color: "#7EDC5A" }}>
              Tell me about yourself
            </h2>
            <p className="text-sm mb-6" style={{ color: "#A8D4B0" }}>
              Just a few details to set up your profile.
            </p>

            <div className="flex flex-col gap-4">
              {/* First name */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#7EDC5A" }}>
                  First name <span style={{ color: "#FF6B6B" }}>*</span>
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
                  <p className="text-xs font-semibold" style={{ color: "#FF6B6B" }}>{errors.firstName}</p>
                )}
              </div>

              {/* Last name */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#7EDC5A" }}>
                  Last name{" "}
                  <span className="text-xs font-normal normal-case" style={{ color: "#A8D4B0" }}>(optional)</span>
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
                <div className="px-4 py-3 rounded-2xl" style={{ background: "#2D1515", border: "1.5px solid #FF6B6B" }}>
                  <p className="text-sm font-semibold" style={{ color: "#FF6B6B" }}>{apiError}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full font-bold text-base active:opacity-80 transition-opacity disabled:opacity-60"
                style={{ background: "#7EDC5A", color: "#0F2D1C", borderRadius: 9999, padding: "18px 0", border: "none" }}
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
