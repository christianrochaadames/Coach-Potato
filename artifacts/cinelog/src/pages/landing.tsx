import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Landing() {
  const [, setLocation] = useLocation();

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
          padding: "24px 24px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <img
          src="/spud-logo.png"
          alt="Spud"
          draggable={false}
          style={{ height: 72, width: "auto", objectFit: "contain" }}
        />
        {/* decorative lime dot cluster */}
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#7EDC5A", opacity: 0.9 }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#7EDC5A", opacity: 0.5 }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#7EDC5A", opacity: 0.25 }} />
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col px-6 pt-8">
        <h1
          className="font-black leading-none mb-1"
          style={{ color: "#7EDC5A", fontSize: 40 }}
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
          className="leading-relaxed mb-8"
          style={{ color: "#A8D4B0", fontSize: 15, maxWidth: 320 }}
        >
          I'm here to help you keep track of every Movie and TV Show you've
          watched, so next time someone asks what you've been watching lately,
          you'll know exactly where to look.
        </p>

        {/* ── Spud mascot — same D4F5A0 circle as profile avatar ── */}
        <div className="flex justify-center">
          <div
            style={{
              background: "#D4F5A0",
              border: "3px solid #7EDC5A",
              borderRadius: 24,
              padding: "12px 20px 0",
              display: "inline-flex",
              alignItems: "flex-end",
              justifyContent: "center",
              overflow: "hidden",
              width: 200,
              height: 200,
            }}
          >
            <img
              src="/spud.png"
              alt="Spud"
              draggable={false}
              style={{
                width: 176,
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── BOTTOM rounded box — CTAs ── */}
      <div
        style={{
          background: "#1A4A2A",
          borderRadius: 24,
          margin: "24px 16px 16px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <button
          onClick={() => setLocation("/sign-up")}
          className="w-full py-3.5 rounded-full font-bold text-sm active:opacity-80 transition-opacity"
          style={{ background: "#7EDC5A", color: "#0F2D1C", border: "none" }}
        >
          Get started free
        </button>
        <button
          onClick={() => setLocation("/sign-in")}
          className="w-full py-3.5 rounded-full font-bold text-sm active:opacity-80 transition-opacity"
          style={{
            background: "transparent",
            color: "#D4F5A0",
            border: "2px solid #3A7A50",
          }}
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
