import { createServer } from "node:http";
import { spawn } from "node:child_process";

const healthPort = Number(process.env.PORT || 8099);
const expoPort = Number(process.env.EXPO_GO_PORT || 8098);
const configuredClerkKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const configuredDomain = process.env.EXPO_PUBLIC_DOMAIN;
const clerkKey =
  configuredClerkKey && !configuredClerkKey.startsWith("$")
    ? configuredClerkKey
    : process.env.CLERK_PUBLISHABLE_KEY ||
      process.env.VITE_CLERK_PUBLISHABLE_KEY ||
      "";
const apiDomain =
  configuredDomain && !configuredDomain.startsWith("$")
    ? configuredDomain
    : process.env.REPLIT_DEV_DOMAIN || "";
const expoEnv = {
  ...process.env,
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey,
  EXPO_PUBLIC_DOMAIN: apiDomain,
};

const healthServer = createServer((request, response) => {
  response.statusCode = 200;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(
    JSON.stringify({
      status: "ok",
      service: "spud-expo-go",
      expoPort,
    }),
  );
});

const expoProcess = spawn(
  "pnpm",
  ["exec", "expo", "start", "--port", String(expoPort), "--host", "tunnel"],
  {
    cwd: process.cwd(),
    env: expoEnv,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let printedExpoGoUrl = false;
let stopped = false;

function logOutput(chunk) {
  const text = chunk.toString();
  process.stdout.write(text);

  if (!printedExpoGoUrl && text.includes("Tunnel ready")) {
    void printExpoGoUrl();
  }
}

async function printExpoGoUrl() {
  for (let attempt = 0; attempt < 90 && !stopped; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${expoPort}/`, {
        headers: {
          "Expo-Platform": "ios",
          "Expo-Protocol-Version": "1",
        },
      });
      const manifest = await response.json();
      const hostUri = manifest?.extra?.expoClient?.hostUri;

      if (
        hostUri &&
        (hostUri.endsWith(".exp.direct") || hostUri.endsWith(".ngrok.io"))
      ) {
        printedExpoGoUrl = true;
        console.log(`\nExpo Go URL: exp://${hostUri}\n`);
        return;
      }
    } catch {
      // Metro may not have finished publishing its manifest yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!printedExpoGoUrl && !stopped) {
    console.warn(
      "\nExpo Go URL is not ready yet; scan again after the tunnel connects.\n",
    );
  }
}

function stop(signal) {
  if (stopped) return;
  stopped = true;
  console.log(`\nStopping Expo Go server (${signal})...`);
  expoProcess.kill(signal);
  healthServer.close(() => process.exit(0));
}

expoProcess.stdout?.on("data", logOutput);
expoProcess.stderr?.on("data", (chunk) => process.stderr.write(chunk));
expoProcess.on("error", (error) => {
  console.error("Unable to start Expo:", error);
  healthServer.close(() => process.exit(1));
});
expoProcess.on("exit", (code, signal) => {
  if (!stopped) {
    console.error(
      `Expo exited unexpectedly (code=${code ?? "none"}, signal=${signal ?? "none"}).`,
    );
    healthServer.close(() => process.exit(code || 1));
  }
});

process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));

healthServer.listen(healthPort, "0.0.0.0", () => {
  console.log(`Expo Go health server listening on port ${healthPort}`);
  console.log(`Expo Metro tunnel will use port ${expoPort}`);
});