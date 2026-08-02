import { useState } from "react";
import { useLocation } from "wouter";
import { CouchPotatoLogo } from "@/components/couch-potato-logo";

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

  const field = (label: string, value: string, setter: (v: string) => void, key: string, opts?: {
    placeholder?: string; hint?: string; prefix?: string
  }) => (
    <div className="space-y-1.5">
      <label className="text-sm font-bold" style={{ color: "#111111" }}>{label}</label>
      {opts?.hint && <p className="text-xs" style={{ color: "#7E7A73" }}>{opts.hint}</p>}
      <div className="relative">
        {opts?.prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: "#7E7A73" }}>
            {opts.prefix}
          </span>
        )}
        <input
          value={value}
          onChange={e => { setter(e.target.value); setErrors(prev => ({ ...prev, [key]: "" })); }}
          placeholder={opts?.placeholder ?? ""}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold focus:outline-none transition-colors"
          style={{
            paddingLeft: opts?.prefix ? 32 : 16,
            paddingRight: 16,
            border: errors[key] ? "2px solid #DC2626" : "2px solid #E2D9CE",
            background: "#ffffff",
            color: "#111111",
          }}
          onFocus={e => { if (!errors[key]) e.target.style.borderColor = "#116149"; }}
          onBlur={e => { if (!errors[key]) e.target.style.borderColor = "#E2D9CE"; }}
          autoCapitalize={key === "username" ? "none" : "words"}
          autoCorrect="off"
        />
      </div>
      {errors[key] && (
        <p className="text-xs font-semibold" style={{ color: "#DC2626" }}>{errors[key]}</p>
      )}
    </div>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: "#FFF3E8" }}>
      {/* Header */}
      <div className="px-6 pt-10 pb-2 flex items-center gap-3">
        <img src="/spud.png" alt="Spud" draggable={false}
          style={{ width: 56, height: 56, objectFit: "contain", flexShrink: 0 }} />
        <CouchPotatoLogo size="md" />
      </div>

      {/* Greeting */}
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-3xl font-bold leading-tight" style={{ color: "#116149" }}>
          {getGreeting()}
        </h1>
        <p className="text-base mt-2 leading-relaxed" style={{ color: "#555" }}>
          Let's set up your profile before we dive in.
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pt-5 pb-4 flex flex-col gap-4">
        {field("First name", firstName, setFirstName, "firstName", { placeholder: "Christian" })}
        {field("Last name", lastName, setLastName, "lastName", { placeholder: "Smith", hint: "Optional" })}
        {field("Username", username, setUsername, "username", {
          placeholder: "christiansmith",
          prefix: "@",
          hint: "Letters, numbers, underscores only — no spaces",
        })}

        {apiError && (
          <div className="px-4 py-3 rounded-2xl" style={{ background: "#FEF2F2", border: "1.5px solid #FECACA" }}>
            <p className="text-sm font-semibold" style={{ color: "#DC2626" }}>{apiError}</p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-6 pb-12 pt-2">
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
  );
}
