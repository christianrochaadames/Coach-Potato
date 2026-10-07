import test from "node:test";
import assert from "node:assert/strict";
import { verifiedEmailUserIds } from "./emailDiscovery";

const accounts = [
  { id: "verified-user", emailAddresses: [{ emailAddress: "Friend@Example.test", verification: { status: "verified" } }] },
  { id: "unverified-user", emailAddresses: [{ emailAddress: "friend@example.test", verification: { status: "unverified" } }] },
  { id: "other-user", emailAddresses: [{ emailAddress: "someone-else@example.test", verification: { status: "verified" } }] },
];
test("email discovery returns only exact verified identities, never their email data", () => {
  assert.deepEqual(verifiedEmailUserIds(accounts, "friend@example.test"), ["verified-user"]);
});
test("email discovery cannot match partial addresses or domains", () => {
  assert.deepEqual(verifiedEmailUserIds(accounts, "@example.test"), []);
  assert.deepEqual(verifiedEmailUserIds(accounts, "friend"), []);
});
test("case and outer whitespace do not prevent an exact email match", () => {
  assert.deepEqual(verifiedEmailUserIds(accounts, " Friend@Example.test "), ["verified-user"]);
});
