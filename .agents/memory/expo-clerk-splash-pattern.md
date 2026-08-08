---
name: Expo + Clerk splash/auth pattern
description: How to correctly wire Clerk auth with expo-splash-screen and expo-router so the app never hits the iOS watchdog kill and never shows a white flash.
---

## The pattern that works

**Do NOT use `ClerkLoaded` as a gate around the Stack.**

`ClerkLoaded` renders nothing until Clerk completes a network round-trip. If that takes too long, `SplashScreen.hideAsync()` is never called, iOS's 20-second launch watchdog kills the process — looks like a "crash" from the user's perspective.

### Root layout (`_layout.tsx`)
- Call `SplashScreen.preventAutoHideAsync()` at module level.
- Wrap everything in `<ClerkProvider>` with no `<ClerkLoaded>` inside.
- Return `null` from `RootLayout` while fonts load (splash covers it).
- Render `<Stack>` immediately once fonts are ready.
- `useAuth()` works anywhere inside `<ClerkProvider>` regardless of `ClerkLoaded`.

### Tabs layout (`(tabs)/_layout.tsx`)
- `const { isLoaded, isSignedIn } = useAuth();`
- `useEffect(() => { if (isLoaded && isSignedIn) SplashScreen.hideAsync(); }, [isLoaded, isSignedIn]);`
- **Safety timeout**: `useEffect(() => { const t = setTimeout(() => SplashScreen.hideAsync(), 8000); return () => clearTimeout(t); }, []);`
- `if (!isLoaded) return null;` — holds blank (splash covers it) until auth state is known.
- `if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;`

### Sign-in screen (`(auth)/sign-in.tsx`)
- `useEffect(() => { SplashScreen.hideAsync(); }, []);` — hides splash once sign-in is painted (signed-out path).
- `SplashScreen.hideAsync()` is safe to call multiple times.

### ErrorBoundary
- Must be placed INSIDE `<SafeAreaProvider>` so `ErrorFallback` can use `useSafeAreaInsets()`.
- `ErrorFallback` should also call `SplashScreen.hideAsync()` so splash doesn't freeze on error.

## Why `errors.fields` needs optional chaining

`useSignIn()` / `useSignUp()` from `@clerk/expo` v4 returns `errors` whose `.fields` property can be `undefined` before Clerk hydrates. Always use `errors?.fields?.identifier` etc.

**Why:** Accessing `errors.fields.x` when `fields` is undefined throws, which before the ErrorBoundary position fix caused a secondary crash (ErrorFallback outside SafeAreaProvider threw again → unhandled).
