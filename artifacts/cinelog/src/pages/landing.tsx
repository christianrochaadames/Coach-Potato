import { useLocation } from "wouter";

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: "#FFF3E8", overflow: "hidden" }}
    >
      {/* ── Logo — left-aligned, flush so JPEG whitespace aligns with text px-6 ── */}
      <div className="pt-10 flex justify-start">
        <img
          src="/logo.jpeg"
          alt="Couch Potato"
          draggable={false}
          style={{
            height: 128,
            width: "auto",
            objectFit: "contain",
            mixBlendMode: "multiply",
          }}
        />
      </div>

      {/* ── Hero: text left / Spud right ── */}
      <div className="relative flex-1 mt-10" style={{ minHeight: 380 }}>

        {/* Spud — smaller, tucked into bottom-right corner */}
        <img
          src="/spud.png"
          alt="Spud"
          draggable={false}
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: 220,
            objectFit: "contain",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />

        {/* Text — left-aligned, all dark green, even spacing */}
        <div
          className="relative flex flex-col px-6"
          style={{ gap: 22, zIndex: 1, maxWidth: "65%" }}
        >
          <p
            className="leading-snug"
            style={{ color: "#116149", fontSize: 22, fontWeight: 500 }}
          >
            Everything you're watching
          </p>
          <p
            className="leading-snug"
            style={{ color: "#116149", fontSize: 22, fontWeight: 500 }}
          >
            What you've already seen
          </p>
          <p
            className="leading-snug"
            style={{ color: "#116149", fontSize: 22, fontWeight: 500 }}
          >
            What you'll watch next
          </p>
          <p
            className="font-bold leading-snug"
            style={{ color: "#116149", fontSize: 22 }}
          >
            All in one place.
          </p>
        </div>
      </div>

      {/* ── CTAs — both pill boxes, smaller, at bottom ── */}
      <div className="w-full px-6 pb-12 pt-6 flex flex-col gap-3">
        <button
          onClick={() => setLocation("/sign-up")}
          className="w-full py-3 rounded-full font-bold text-sm active:opacity-75 transition-opacity"
          style={{
            border: "2px solid #116149",
            color: "#ffffff",
            background: "#116149",
          }}
        >
          Get started free
        </button>
        <button
          onClick={() => setLocation("/sign-in")}
          className="w-full py-3 rounded-full font-bold text-sm active:opacity-75 transition-opacity"
          style={{
            border: "2px solid #116149",
            color: "#116149",
            background: "transparent",
          }}
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
