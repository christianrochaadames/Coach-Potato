import { SignUp } from "@clerk/react";
import { useLocation } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Hide Clerk's built-in OAuth buttons — we use our own below that route through
// the sign-in page (where OAuth is proven to work in Clerk's dev environment).
const hideBuiltinSocial = {
  elements: {
    socialButtonsRoot: { display: "none" as const },
    dividerRow: { display: "none" as const },
  },
};

export default function SignUpPage() {
  const [, setLocation] = useLocation();

  // Navigate to sign-in with an SSO intent query param.
  // The sign-in page detects the param and auto-triggers OAuth immediately —
  // single tap, no extra click needed. New Google/Apple accounts are created
  // automatically by Clerk when a new identity signs in for the first time.
  const handleOAuth = (provider: "google" | "apple") => {
    setLocation(`/sign-in?sso=${provider}`);
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8"
      style={{ background: "#FFF3E8" }}
    >
      {/* Branding: logo left, Spud (clapping) right */}
      <div
        className="flex items-center justify-between mb-5"
        style={{ width: "100%", maxWidth: 440 }}
      >
        <img
          src="/logo.jpeg"
          alt="Couch Potato"
          draggable={false}
          style={{
            height: 96,
            width: "auto",
            objectFit: "contain",
            mixBlendMode: "multiply",
          }}
        />
        <img
          src="/spud-clapping.png"
          alt="Spud clapping"
          draggable={false}
          style={{ height: 110, width: "auto", objectFit: "contain" }}
        />
      </div>

      {/* Custom OAuth buttons — navigate to sign-in which auto-fires the OAuth */}
      <div style={{ width: "100%", maxWidth: 440 }} className="mb-3 space-y-2">

        {/* Google — white with border */}
        <button
          onClick={() => handleOAuth("google")}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-semibold text-sm transition-opacity active:opacity-70 cursor-pointer"
          style={{
            border: "1.5px solid #E2D9CE",
            background: "#ffffff",
            color: "#111111",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          Continue with Google
        </button>

        {/* Apple — black per Apple HIG */}
        <button
          onClick={() => handleOAuth("apple")}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-semibold text-sm transition-opacity active:opacity-70 cursor-pointer"
          style={{
            border: "1.5px solid #000000",
            background: "#000000",
            color: "#ffffff",
          }}
        >
          <svg width="16" height="18" viewBox="0 0 814 1000" aria-hidden fill="currentColor">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.3-150.3-109.7C27.8 735.7 1 588.7 1 446.8c0-236.5 154.4-360.8 305.7-360.8 76 0 139.4 47.4 187.1 47.4 45.5 0 117.1-50.3 204.8-50.3zm-135.5-252c34.8-41.1 61.1-98.5 61.1-155.9 0-8.1-.6-16.3-1.9-23.4-57.5 2.1-125.4 38.3-166.3 83.9-31.5 36.4-61.1 99-61.1 157.6 0 9 1.3 18 1.9 20.9 3.2.6 8.4 1.3 13.6 1.3 51.6 0 115.5-33.6 152.7-84.4z"/>
          </svg>
          Continue with Apple
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px" style={{ background: "#E2D9CE" }} />
          <span className="text-xs font-medium" style={{ color: "#7E7A73" }}>or</span>
          <div className="flex-1 h-px" style={{ background: "#E2D9CE" }} />
        </div>
      </div>

      {/* Clerk SignUp — email/password only */}
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        appearance={hideBuiltinSocial}
      />
    </div>
  );
}
