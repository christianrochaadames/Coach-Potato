import { useLocation } from "wouter";
import { CouchPotatoLogo } from "@/components/couch-potato-logo";
import { SpudMascot } from "@/components/spud-mascot";

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
          className="text-4xl font-bold mt-6 mb-4 leading-tight"
          style={{ color: "#111111" }}
        >
          Everything you've watched,<br />are watching,<br />and will watch next —<br />all in one place.
        </h1>

        {/* CTAs */}
        <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
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

        <p className="text-xs mt-8" style={{ color: "#7E7A73" }}>
          Free forever · No ads · Your data stays yours
        </p>
      </div>
    </div>
  );
}
