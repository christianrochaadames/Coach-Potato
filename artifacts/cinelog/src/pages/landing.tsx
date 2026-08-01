import { useLocation } from "wouter";
import { CouchPotatoLogo } from "@/components/couch-potato-logo";
import { SpudMascot } from "@/components/spud-mascot";

const features = [
  { icon: "🎬", title: "Log everything", desc: "Movies, shows, episodes — keep a complete record of what you've watched." },
  { icon: "⭐", title: "Rate & review", desc: "Give star ratings, write notes, and track how your taste evolves over time." },
  { icon: "📊", title: "See your stats", desc: "Monthly breakdowns, genre trends, platform habits — your watch life visualised." },
  { icon: "🔮", title: "Smart picks", desc: "Recommendations weighted by your ratings and what you've watched recently." },
];

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: "#FFF3E8" }}>
      {/* Nav */}
      <div className="px-5 pt-8 flex items-center justify-between">
        <CouchPotatoLogo size="lg" />
        <button
          onClick={() => setLocation("/sign-in")}
          className="px-4 py-2 rounded-full text-sm font-bold border-2 transition-opacity active:opacity-70"
          style={{ borderColor: "#116149", color: "#116149" }}
        >
          Sign in
        </button>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <SpudMascot pose="relaxed" size={120} round={false} />
        <h1
          className="text-4xl font-bold mt-6 mb-3 leading-tight"
          style={{ color: "#111111" }}
        >
          Your entire watch history.<br />One cosy place.
        </h1>
        <p className="text-base max-w-sm mb-8" style={{ color: "#7E7A73" }}>
          Log movies & TV shows, rate what you love, and get smart picks based on your real taste.
        </p>

        {/* CTAs */}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => setLocation("/sign-up")}
            className="w-full py-4 rounded-2xl font-bold text-base text-white active:opacity-80 transition-opacity"
            style={{ background: "#116149" }}
          >
            Get started free
          </button>
          <button
            onClick={() => setLocation("/sign-in")}
            className="w-full py-4 rounded-2xl font-bold text-base active:opacity-80 transition-opacity"
            style={{ background: "#EFE4D2", color: "#111111" }}
          >
            I already have an account
          </button>
        </div>
      </div>

      {/* Features */}
      <div className="px-5 pb-12">
        <div className="grid grid-cols-2 gap-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl p-4"
              style={{ background: "#ffffff", border: "1px solid #E2D9CE" }}
            >
              <p className="text-2xl mb-2">{f.icon}</p>
              <p className="font-bold text-sm mb-1" style={{ color: "#111111" }}>{f.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "#7E7A73" }}>{f.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-xs mt-6" style={{ color: "#7E7A73" }}>
          Free forever · No ads · Your data stays yours
        </p>
      </div>
    </div>
  );
}
