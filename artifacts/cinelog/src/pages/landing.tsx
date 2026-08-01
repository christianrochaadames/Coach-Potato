import { useLocation } from "wouter";

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col items-center" style={{ background: "#FFF3E8" }}>

      {/* ── Logo ── */}
      <div className="pt-10 pb-2 flex justify-center">
        <img
          src="/logo.jpeg"
          alt="Couch Potato"
          draggable={false}
          style={{
            height: 120,
            width: "auto",
            objectFit: "contain",
            mixBlendMode: "multiply",
          }}
        />
      </div>

      {/* ── Mascot ── */}
      <img
        src="/spud.png"
        alt="Spud"
        draggable={false}
        style={{ width: 130, height: 130, objectFit: "contain" }}
      />

      {/* ── Staggered text boxes ── */}
      <div className="w-full px-5 mt-6 flex flex-col gap-4">

        {/* Left — purple */}
        <div className="flex justify-start">
          <div
            className="rounded-2xl px-6 py-4"
            style={{ background: "#6B46C1", maxWidth: "68%" }}
          >
            <p className="text-white font-bold text-lg leading-snug">
              Everything you're watching
            </p>
          </div>
        </div>

        {/* Right — hot pink */}
        <div className="flex justify-end">
          <div
            className="rounded-2xl px-6 py-4"
            style={{ background: "#FF4BAE", maxWidth: "68%" }}
          >
            <p className="text-white font-bold text-lg leading-snug">
              What you've already seen
            </p>
          </div>
        </div>

        {/* Left — bright blue */}
        <div className="flex justify-start">
          <div
            className="rounded-2xl px-6 py-4"
            style={{ background: "#4A78FF", maxWidth: "68%" }}
          >
            <p className="text-white font-bold text-lg leading-snug">
              What you'll watch next
            </p>
          </div>
        </div>
      </div>

      {/* ── "All in one place" ── */}
      <div className="mt-7 px-6 text-center">
        <p className="text-4xl font-bold leading-tight">
          <span style={{ color: "#116149" }}>All </span>
          <span style={{ color: "#6B46C1" }}>in </span>
          <span style={{ color: "#FF4BAE" }}>one </span>
          <span style={{ color: "#4A78FF" }}>place.</span>
        </p>
      </div>

      {/* ── CTAs ── */}
      <div className="w-full px-6 mt-10 flex flex-col items-center gap-4">
        <button
          onClick={() => setLocation("/sign-up")}
          className="w-full py-4 rounded-full font-bold text-base border-2 active:opacity-80 transition-opacity"
          style={{ borderColor: "#116149", color: "#116149", background: "transparent" }}
        >
          Get started free
        </button>
        <button
          onClick={() => setLocation("/sign-in")}
          className="text-sm font-semibold active:opacity-60"
          style={{ color: "#7E7A73" }}
        >
          Sign in
        </button>
      </div>

      <div className="pb-10" />
    </div>
  );
}
