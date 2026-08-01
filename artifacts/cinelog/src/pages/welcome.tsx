import { useLocation } from "wouter";

export default function Welcome() {
  const [, setLocation] = useLocation();

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: "#FFF3E8" }}
    >
      {/* ── Mascot hero area — illustrations go here ── */}
      <div
        className="flex flex-col items-center justify-center pt-12 pb-6 px-6"
        style={{ minHeight: 260 }}
      >
        {/* Main mascot */}
        <img
          src="/spud.png"
          alt="Spud"
          draggable={false}
          style={{ width: 180, height: 180, objectFit: "contain" }}
        />
        {/* TODO: swap in motion illustration once assets are provided */}
      </div>

      {/* ── Welcome text ── */}
      <div className="flex-1 px-7 pb-4">
        <h1
          className="text-3xl font-bold mb-5"
          style={{ color: "#116149" }}
        >
          Welcome! I'm Spud.
        </h1>

        <p className="text-base leading-relaxed mb-5" style={{ color: "#333333" }}>
          I'm here to help you{" "}
          <span className="font-bold" style={{ color: "#6B46C1" }}>remember every show you've loved</span>
          , keep track of{" "}
          <span className="font-bold" style={{ color: "#FF4BAE" }}>what you're watching</span>
          {" "}and discover your{" "}
          <span className="font-bold" style={{ color: "#4A78FF" }}>next obsession</span>.
        </p>

        <p className="text-base leading-relaxed mb-5" style={{ color: "#333333" }}>
          So the next time someone asks,{" "}
          <span className="font-bold italic" style={{ color: "#116149" }}>
            "What should I watch?"
          </span>
          , you'll always have an answer.
        </p>

        <p className="text-base font-bold" style={{ color: "#116149" }}>
          Happy couch potatoing! 🥔
        </p>
      </div>

      {/* ── Next button ── */}
      <div className="px-6 pb-12">
        <button
          onClick={() => setLocation("/onboarding")}
          className="w-full py-4 rounded-2xl font-bold text-base text-white active:opacity-80 transition-opacity flex items-center justify-center gap-2"
          style={{ background: "#116149" }}
        >
          Next
          <span className="text-xl">→</span>
        </button>
      </div>
    </div>
  );
}
