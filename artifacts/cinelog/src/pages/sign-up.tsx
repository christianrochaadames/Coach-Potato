import { SignUp } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignUpPage() {
  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center px-4 py-8"
      style={{ background: "#FFF3E8" }}
    >
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/onboarding`}
      />
    </div>
  );
}
