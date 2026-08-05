import { useEffect } from "react";
import { SignIn, useSignIn } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignInPage() {
  const { signIn, isLoaded } = useSignIn();

  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    const main = document.querySelector("main") as HTMLElement | null;
    const wrapper = main?.parentElement as HTMLElement | null;
    const prevWrapper = wrapper?.style.background ?? "";
    document.documentElement.style.background = "#C5B8FF";
    document.body.style.background = "#C5B8FF";
    if (wrapper) wrapper.style.background = "#C5B8FF";
    return () => {
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
      if (wrapper) wrapper.style.background = prevWrapper;
    };
  }, []);

  // Read an optional ?returnTo=<path> set by the session-expiry handler so
  // we can restore the user to the page they were on before their session expired.
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo") ?? null;
  // forceRedirectUrl makes Clerk always land on the saved path after sign-in.
  // Only set it when returnTo is present — otherwise fall back to the default.
  const forceRedirectUrl = returnTo ?? undefined;

  // Auto-trigger OAuth when the page is reached with ?sso=google or ?sso=apple.
  // This lets the sign-up page's Google/Apple buttons redirect here and have the
  // OAuth fire immediately — avoiding Clerk's sign-up SSO callback issue.
  useEffect(() => {
    if (!isLoaded || !signIn) return;
    const sso = params.get("sso");
    if (sso === "google" || sso === "apple" || sso === "facebook") {
      signIn.authenticateWithRedirect({
        strategy: `oauth_${sso}` as "oauth_google" | "oauth_apple" | "oauth_facebook",
        redirectUrl: `${basePath}/sign-in/sso-callback`,
        // Honour the saved return path for OAuth sign-ins too
        redirectUrlComplete: returnTo ?? `${basePath}/`,
      });
    }
  }, [isLoaded, signIn]);

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8"
      style={{ background: "#C5B8FF" }}
    >
      {/* Branding: transparent logo left-aligned, Spud right */}
      <div
        className="flex items-center justify-between mb-4"
        style={{ width: "100%", maxWidth: 440 }}
      >
        <img
          src="/spud-logo.png"
          alt="Spud"
          draggable={false}
          style={{
            height: 101,
            width: "auto",
            objectFit: "contain",
            mixBlendMode: "multiply",
            marginLeft: -8,
          }}
        />
        <img
          src="/spud-thumbsup.png"
          alt="Spud giving a thumbs up"
          draggable={false}
          style={{ height: 124, width: "auto", objectFit: "contain" }}
        />
      </div>

      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/`}
        forceRedirectUrl={forceRedirectUrl}
        appearance={{
          elements: {
            formButtonPrimary: {
              backgroundColor: '#5B50D0',
              '&:hover': { backgroundColor: '#4A3FC0' },
              '&:focus': { backgroundColor: '#4A3FC0' },
            },
          },
        }}
      />
    </div>
  );
}
