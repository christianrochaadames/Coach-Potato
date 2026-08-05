import { useEffect, useRef } from "react";
import { ClerkProvider, Show, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/bottom-nav";
import Home from "@/pages/home";
import Search from "@/pages/search";
import Watchlist from "@/pages/watchlist";
import Stats from "@/pages/stats";
import Profile from "@/pages/profile";
import EntryDetail from "@/pages/entry-detail";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import Onboarding from "@/pages/onboarding";
import Welcome from "@/pages/welcome";
import Privacy from "@/pages/privacy";

const queryClient = new QueryClient();

// REQUIRED — copy verbatim per Clerk skill
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim per Clerk skill. Empty in dev (intentional), auto-set in prod.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  layout: {
    unsafe_disableDevelopmentModeWarnings: true,
  },
  options: {
    logoPlacement: "none" as const,
  },
  variables: {
    colorPrimary: "#116149",
    colorForeground: "#111111",
    colorMutedForeground: "#7E7A73",
    colorDanger: "#DC2626",
    colorBackground: "#ffffff",   // White so form card is visually distinct from page bg
    colorInput: "#ffffff",
    colorInputForeground: "#111111",
    colorNeutral: "#D1D5DB",      // Slightly darker for clearly visible input borders
    fontFamily: "Manrope, system-ui, sans-serif",
    borderRadius: "14px",
  },
  elements: {
    // Hide dev-mode banner entirely — inline style beats all CSS, including Clerk's own
    devModeNotice: { display: "none" } as React.CSSProperties,
    // Force the footer area fully white via inline styles so it never reverts to the page cream
    footer:      { backgroundColor: "#ffffff", backgroundImage: "none" } as React.CSSProperties,
    footerPages: { backgroundColor: "#ffffff", backgroundImage: "none" } as React.CSSProperties,
    footerAction: { backgroundColor: "#ffffff", textAlign: "center" } as React.CSSProperties,

    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-sm",
    card: "!shadow-none !border-0 !bg-white !rounded-none",
    // Hide Clerk's built-in "Sign in to <App>" title — our custom pages provide their own Spud branding
    headerTitle: { display: "none" } as React.CSSProperties,
    headerSubtitle: { display: "none" } as React.CSSProperties,
    formFieldLabel: "font-medium text-sm",
    footerActionLink: "font-semibold",
    footerActionText: "text-sm",
    dividerText: "text-sm",
    identityPreviewEditButton: "font-semibold",
    formFieldSuccessText: "text-sm",
    alertText: "text-sm",
    logoBox: "flex justify-center mb-1",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border rounded-xl bg-white !text-gray-900",
    socialButtonsBlockButtonText: "font-semibold text-sm !text-gray-900",
    formButtonPrimary: "rounded-xl font-bold",
    formFieldInput: "rounded-xl border-2 bg-white",
    dividerLine: "bg-gray-200",
    alert: "rounded-xl",
    otpCodeFieldInput: "rounded-xl border-2",
    formFieldRow: "gap-2",
    main: "gap-4",
    // "Last used" pill → bright blue so it stands out
    badge: "!bg-blue-500 !text-white !border-0",
  },
};

// Recolors Clerk's orange "Development mode" notice to neutral gray at runtime
function ClerkDevModeNeutralizer() {
  useEffect(() => {
    // 1. Inject a <style> tag that bypasses CSS layers entirely.
    //    Uses both the standard class-substring selector AND attribute selectors
    //    so it matches regardless of Clerk's hashed suffix on class names.
    const style = document.createElement("style");
    style.dataset.clerkFix = "1";
    style.innerHTML = `
      /* Hide the dev-mode banner completely */
      [class*="cl-devModeNotice"] { display: none !important; }
      /* Force every part of the Clerk footer white */
      [class*="cl-footer"],
      [class*="cl-footer"] > *,
      [class*="cl-footerPages"],
      [class*="cl-footerAction"],
      [class*="cl-footerActionText"],
      [class*="cl-footerActionLink"] {
        background-color: #ffffff !important;
        background-image: none !important;
      }
      /* White card body throughout */
      [class*="cl-card"] {
        background-color: #ffffff !important;
        background-image: none !important;
      }
    `;
    if (!document.querySelector("[data-clerk-fix]")) {
      document.head.appendChild(style);
    }

    // 2. querySelector sweep: find every element whose *own trimmed text* is
    //    exactly "development mode" and hide it plus up to 2 wrapper ancestors
    //    that still contain only that text (so we grab the whole banner row
    //    without accidentally hiding the "Don't have an account?" link above it).
    const hideDevMode = () => {
      document.querySelectorAll<HTMLElement>("*").forEach((el) => {
        // Only consider elements with no element children (or 1 icon child)
        if (el.children.length > 2) return;
        const own = (el.textContent ?? "").trim().toLowerCase();
        if (own !== "development mode") return;

        // Walk up and hide the highest ancestor that still contains ONLY the dev-mode text
        let target: HTMLElement = el;
        for (let i = 0; i < 4; i++) {
          const parent = target.parentElement;
          if (!parent || parent === document.body) break;
          const parentOwn = (parent.textContent ?? "").trim().toLowerCase();
          // Keep climbing while the parent's full text is still just the dev-mode notice
          if (parentOwn === "development mode" || parentOwn.replace(/\s/g, "") === "developmentmode") {
            target = parent;
          } else {
            break;
          }
        }
        target.style.setProperty("display", "none", "important");
      });
    };
    hideDevMode();
    const interval = setInterval(hideDevMode, 500);
    const cleanup = setTimeout(() => clearInterval(interval), 10000);
    const observer = new MutationObserver(hideDevMode);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      clearInterval(interval);
      clearTimeout(cleanup);
      style.remove();
    };
  }, []);
  return null;
}

// Clears React Query cache when the signed-in user changes
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

// Wraps any page that requires authentication.
// Uses useAuth() instead of <Show> so the loading state never renders blank —
// <Show when="signed-in"> renders nothing while Clerk is initialising, which
// causes the blank white page after OAuth redirects.
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div
        className="min-h-[100dvh] flex items-center justify-center"
        style={{ background: "#FFF3E8" }}
      >
        <div
          className="w-8 h-8 rounded-full animate-pulse"
          style={{ background: "#E2D9CE" }}
        />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Redirect to="/sign-in" />;
  }

  return <Component />;
}

// Intercepts 401 events fired by customFetch.  On expiry it:
//   1. Shows a "Session expired" toast.
//   2. Signs the user out.
//   3. Redirects to /sign-in?returnTo=<current-path> so the SignIn page
//      can pass the saved destination as Clerk's forceRedirectUrl — letting
//      Clerk's own redirect machinery handle the return, which is more
//      reliable than any post-sign-in listener approach.
function SessionExpiryHandler() {
  const { signOut } = useClerk();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const handlingRef = useRef(false);

  useEffect(() => {
    const handle = () => {
      if (handlingRef.current) return; // ignore duplicate 401 bursts
      handlingRef.current = true;

      const returnPath = window.location.pathname + window.location.search;
      const signInPath = `${basePath}/sign-in`;

      toast({
        title: "Session expired",
        description: "Please sign in again to continue.",
        variant: "destructive",
      });

      signOut().then(() => {
        // Include the saved path in the URL so the sign-in page can pass it
        // to Clerk's forceRedirectUrl — survives the full OAuth/callback cycle.
        if (!returnPath.startsWith(signInPath)) {
          setLocation(`/sign-in?returnTo=${encodeURIComponent(returnPath)}`);
        } else {
          setLocation("/sign-in");
        }
        handlingRef.current = false;
      });
    };

    window.addEventListener("auth:unauthorized", handle);
    return () => window.removeEventListener("auth:unauthorized", handle);
  }, [signOut, toast, setLocation]);

  return null;
}

// Home: shows landing for guests, app for signed-in users
function HomeRoute() {
  return (
    <>
      <Show when="signed-in">
        <Home />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function Router() {
  return (
    <div className="flex flex-col min-h-[100dvh]" style={{ background: "#FFF3E8" }}>
      <main className="flex-1 pb-20 overflow-y-auto">
        <Switch>
          <Route path="/" component={HomeRoute} />
          {/* REQUIRED — copy verbatim: /*? optional wildcard matches OAuth sub-paths */}
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/welcome" component={() => <ProtectedRoute component={Welcome} />} />
          <Route path="/onboarding" component={() => <ProtectedRoute component={Onboarding} />} />
          <Route path="/search" component={() => <ProtectedRoute component={Search} />} />
          <Route path="/watchlist" component={() => <ProtectedRoute component={Watchlist} />} />
          <Route path="/stats" component={() => <ProtectedRoute component={Stats} />} />
          <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
          <Route path="/entry/:id" component={() => <ProtectedRoute component={EntryDetail} />} />
          <Route path="/privacy" component={Privacy} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Show when="signed-in">
        <BottomNav />
      </Show>
    </div>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      afterSignInUrl={`${basePath}/`}
      afterSignUpUrl={`${basePath}/welcome`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkDevModeNeutralizer />
        <ClerkQueryClientCacheInvalidator />
        <SessionExpiryHandler />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}
