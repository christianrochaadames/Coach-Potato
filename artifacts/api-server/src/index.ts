import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Keep the Clerk application display name in sync with the brand name.
  // Runs on every startup — idempotent, non-fatal if it fails.
  const clerkKey = process.env["CLERK_SECRET_KEY"];
  if (clerkKey) {
    fetch("https://api.clerk.com/v1/instance", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${clerkKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ display_name: "Spud" }),
    }).catch(() => {/* non-fatal */});
  }
});
