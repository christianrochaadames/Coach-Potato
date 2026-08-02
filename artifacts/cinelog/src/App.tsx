import { useEffect, useRef } from "react";
import { ClerkProvider, Show, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomNav } from "@/components/bottom-nav";
import Home from "@/pages/home";
import MyShows from "@/pages/my-shows";
import Search from "@/pages/search";
import Watchlist from "@/pages/watchlist";
import Stats from "@/pages/stats";
import Profile from "@/pages/profile";
import EntryDetail from "@/pages/entry-detail";
import AddEntry from "@/pages/add-entry";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import Onboarding from "@/pages/onboarding";
import Welcome from "@/pages/welcome";

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
    colorBackground: "#FFF3E8",
    colorInput: "#ffffff",
    colorInputForeground: "#111111",
    colorNeutral: "#E2D9CE",
    fontFamily: "Manrope, system-ui, sans-serif",
    borderRadius: "14px",
  },
  elements: {
    devModeNotice: {
      background: "#4B5563",
      color: "#E5E7EB",
      borderColor: "#6B7280",
    },
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-bold",
    headerSubtitle: "text-sm",
    socialButtonsBlockButtonText: "font-semibold text-sm",
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
    formFieldInput: "rounded-xl border bg-white",
    footerAction: "text-center",
    dividerLine: "bg-gray-200",
    alert: "rounded-xl",
    otpCodeFieldInput: "rounded-xl border",
    formFieldRow: "gap-2",
    main: "gap-4",
  },
};

// Recolors Clerk's orange "Development mode" notice to neutral gray at runtime
function ClerkDevModeNeutralizer() {
  useEffect(() => {
    const gray = "#9CA3AF";
    const neutralize = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        if (node.textContent?.trim().toLowerCase() === "development mode") {
          // Walk up 6 levels, forcing gray with !important on every ancestor
          let el: HTMLElement | null = node.parentElement;
          for (let i = 0; i < 6 && el && el !== document.body; i++) {
            el.style.setProperty("color", gray, "important");
            el.style.setProperty("background", "transparent", "important");
            el.style.setProperty("background-color", "transparent", "important");
            el.style.setProperty("border-color", "#E5E7EB", "important");
            el = el.parentElement;
          }
        }
      }
    };
    neutralize();
    // Retry for 6 s in case Clerk renders asynchronously after mount
    const interval = setInterval(neutralize, 300);
    const cleanup = setTimeout(() => clearInterval(interval), 6000);
    const observer = new MutationObserver(neutralize);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); clearInterval(interval); clearTimeout(cleanup); };
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
          <Route path="/my-shows" component={() => <ProtectedRoute component={MyShows} />} />
          <Route path="/search" component={() => <ProtectedRoute component={Search} />} />
          <Route path="/watchlist" component={() => <ProtectedRoute component={Watchlist} />} />
          <Route path="/stats" component={() => <ProtectedRoute component={Stats} />} />
          <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
          <Route path="/entry/:id" component={() => <ProtectedRoute component={EntryDetail} />} />
          <Route path="/add" component={() => <ProtectedRoute component={AddEntry} />} />
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
