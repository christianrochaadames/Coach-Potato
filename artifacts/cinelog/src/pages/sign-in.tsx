import { useEffect } from "react";
import { SignIn, useSignIn } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignInPage() {
  const { signIn, isLoaded } = useSignIn();

  // Auto-trigger OAuth when the page is reached with ?sso=google or ?sso=apple.
  // This lets the sign-up page's Google/Apple buttons redirect here and have the
  // OAuth fire immediately — avoiding Clerk's sign-up SSO callback issue.
  useEffect(() => {
    if (!isLoaded || !signIn) return;
    const params = new URLSearchParams(window.location.search);
    const sso = params.get("sso");
    if (sso === "google" || sso === "apple") {
      signIn.authenticateWithRedirect({
        strategy: `oauth_${sso}` as "oauth_google" | "oauth_apple",
        redirectUrl: `${basePath}/sign-in/sso-callback`,
        redirectUrlComplete: `${basePath}/`,
      });
    }
  }, [isLoaded, signIn]);

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8"
      style={{ background: "#FFF3E8" }}
    >
      {/* Branding: logo left, Spud (thumbs-up) right */}
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
          src="/spud-thumbsup.png"
          alt="Spud giving a thumbs up"
          draggable={false}
          style={{ height: 110, width: "auto", objectFit: "contain" }}
        />
      </div>

      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/`}
      />
    </div>
  );
}
