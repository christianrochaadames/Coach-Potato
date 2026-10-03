import assert from "node:assert/strict";
import { test } from "node:test";
import { serializeIdentity } from "./buddyIdentity";

test("serializeIdentity excludes profile metadata beyond the public identity whitelist", () => {
  const profile = {
    userId: "buddy-123",
    firstName: "Spud",
    lastName: "Buddy",
    username: "spudbuddy",
    avatarId: "3",
    avatarUrl: null,
    bio: "private bio",
    favorites: ["private favorite"],
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-02-01T00:00:00.000Z"),
    arbitraryPrivateField: "do not serialize",
  };

  assert.deepEqual(serializeIdentity(profile), {
    userId: "buddy-123",
    firstName: "Spud",
    lastName: "Buddy",
    username: "spudbuddy",
    avatarId: "3",
    avatarUrl: null,
  });
});