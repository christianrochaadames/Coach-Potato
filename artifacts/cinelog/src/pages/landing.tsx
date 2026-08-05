import { useLocation } from "wouter";

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: "#FFF3E8", overflow: "hidden" }}
    >
      {/* ── Logo — transparent PNG. marginLeft nudges out the PNG's internal padding
           so the visible letter edge aligns exactly with the text below (px-6). ── */}
      <div className="pt-10 px-6 flex justify-start">
        <img
          src="/spud-logo.png"
          alt="Spud"
          draggable={false}
          style={{
            height: 100,
            width: "auto",
            objectFit: "contain",
            mixBlendMode: "multiply",
          }}
        />
      </div>

      {/* ── Hero: text left / Spud right ── */}
      <div className="relative flex-1 mt-2" style={{ minHeight: 380 }}>

        {/* Spud — tucked into bottom-right corner */}
        <img
          src="/spud.png"
          alt="Spud"
          draggable={false}
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: 228,
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
            style={{ color: "#116149", fontSize: 22, fontWeight: 400 }}
          >
            The TV shows and movies you're <strong>watching</strong>
          </p>
          <p
            className="leading-snug"
            style={{ color: "#116149", fontSize: 22, fontWeight: 400 }}
          >
            The ones you've already <strong>watched</strong>
          </p>
          <p
            className="leading-snug"
            style={{ color: "#116149", fontSize: 22, fontWeight: 400 }}
          >
            And what you'll <strong>watch</strong> next
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
