import { useState } from "react";
import { useLocation } from "wouter";

const PASTEL_MINT = "#E2F5EC";

export default function Welcome() {
  const [, setLocation] = useLocation();
  const [showForm, setShowForm]     = useState(false);
  const [firstName, setFirstName]   = useState("");
  const [lastName, setLastName]     = useState("");
  const [username, setUsername]     = useState("");
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState(false);
  const [apiError, setApiError]     = useState("");

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
      {/* ── Page content ── */}
      <div className="relative z-10 flex flex-col flex-1 px-6">

        {/* ── TOP ROW: Logo left + Spud-walk (chocolates) right, tucked against logo ── */}
        <div className="pt-10 flex items-end justify-between">
          <img
            src="/logo-text.png"
            alt="Couch Potato"
            draggable={false}
            style={{
              height: 96,
              width: "auto",
              objectFit: "contain",
              marginLeft: -10,
            }}
          />
          <img
            src="/spud-walk.png"
            alt=""
            aria-hidden
            draggable={false}
            style={{
              height: 200,
              width: "auto",
              objectFit: "contain",
              opacity: 0.9,
              mixBlendMode: "multiply",
              marginRight: -16,
            }}
          />
        </div>

        {/* ── WELCOME COPY — below the logo row, no illustrations nearby ── */}
        <div className="mt-7 mb-6">
          <h1
            className="font-bold leading-tight mb-1"
            style={{ color: "#116149", fontSize: 38 }}
          >
            Welcome!
          </h1>
          <h2
            className="font-bold mb-5"
            style={{ color: "#116149", fontSize: 24 }}
          >
            I'm Spud.
          </h2>
          <p
            className="leading-relaxed"
            style={{ color: "#0e4f3a", fontSize: 16, fontWeight: 500 }}
          >
            Think of me as your personal TV and movie sidekick. I'll help you
            remember what you've watched, keep track of what you're watching and
            discover what to watch next.
          </p>
          <p
            className="mt-4 font-semibold leading-snug"
            style={{ color: "#116149", fontSize: 16 }}
          >
            Now grab the remote… and let's get comfy.
          </p>
        </div>

        <div className="flex-1" />

        {/* ── CTA BUTTON ── */}
        <div className="mb-5">
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-4 rounded-2xl font-bold text-base text-white active:opacity-80 transition-opacity"
            style={{ background: "#116149" }}
          >
            Get started
          </button>
        </div>

        {/* ── BOTTOM ILLUSTRATION ROW: spud-phone left, spud-couch right ── */}
        {/* Placed below the button so they never sit behind any text ── */}
        <div
          className="flex justify-between items-end -mx-6 overflow-hidden"
          style={{ height: 145 }}
        >
          <img
            src="/spud-phone.png"
            alt=""
            aria-hidden
            draggable={false}
            style={{
              width: 120,
              height: "auto",
              objectFit: "contain",
              opacity: 0.9,
              mixBlendMode: "multiply",
              marginLeft: -14,
              alignSelf: "flex-end",
            }}
          />
          <img
            src="/spud-couch.png"
            alt=""
            aria-hidden
            draggable={false}
            style={{
              width: 170,
              height: "auto",
              objectFit: "contain",
              opacity: 0.9,
              mixBlendMode: "multiply",
              marginRight: -14,
              alignSelf: "flex-end",
            }}
          />
        </div>

      </div>

      {/* ── Profile form — bottom-sheet modal ── */}
      {showForm && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-20"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => setShowForm(false)}
          />

          {/* Sheet */}
          <div
            className="fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl px-6 pt-5 pb-10"
            style={{ background: "#ffffff", maxHeight: "88dvh", overflowY: "auto" }}
          >
            {/* Drag handle */}
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

              {/* First name */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#116149" }}>
                  First name <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  value={firstName}
                  onChange={e => { setFirstName(e.target.value); setErrors(p => ({ ...p, firstName: "" })); }}
                  placeholder="Spot"
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
                  Last name{" "}
                  <span className="text-xs font-normal normal-case" style={{ color: "#7E7A73" }}>
                    (optional)
                  </span>
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
                    placeholder="SpotThePotato"
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
                className="w-full py-4 rounded-2xl font-bold text-base text-white active:opacity-80 transition-opacity disabled:opacity-60"
                style={{ background: "#116149" }}
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
