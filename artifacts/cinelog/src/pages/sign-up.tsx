import { SignUp } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignUpPage() {
  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8"
      style={{ background: "#FFF3E8" }}
    >
      {/* Real branding above the Clerk card */}
      <div className="flex flex-col items-center mb-4">
        <img
          src="/spud.png"
          alt="Spud mascot"
          style={{ width: 110, height: 110, objectFit: "contain" }}
          draggable={false}
        />
        <img
          src="/logo.jpeg"
          alt="Couch Potato"
          draggable={false}
          style={{
            height: 64,
            width: "auto",
            objectFit: "contain",
            mixBlendMode: "multiply",
            marginTop: 4,
          }}
        />
      </div>

      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/onboarding`}
      />
    </div>
  );
}
