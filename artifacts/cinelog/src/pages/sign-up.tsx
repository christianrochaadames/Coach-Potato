import { SignUp } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignUpPage() {
  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8"
      style={{ background: "#FFF3E8" }}
    >
      {/* Branding: logo left, Spud right */}
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
          src="/spud.png"
          alt="Spud"
          draggable={false}
          style={{ height: 96, width: "auto", objectFit: "contain" }}
        />
      </div>

      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        forceRedirectUrl={`${basePath}/welcome`}
      />
    </div>
  );
}
