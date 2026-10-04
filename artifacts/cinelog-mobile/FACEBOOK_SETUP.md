# Optional Facebook friend discovery

This is an optional connection **after signing into Spud**, not a replacement
for Clerk sign-in. It is available from the existing Spud buddies pages on web
and mobile. It never posts, automatically sends buddy requests, or opens private
watch shelves.

## What Facebook can return

The `user_friends` permission only returns Facebook friends who authorised the
**same Meta app** and granted the friends permission. It cannot return everyone's
Facebook friends. Each person must connect Facebook in Spud; ordinary username
search and sharing a Spud invite remain available without Facebook.

Spud stores app-scoped Facebook identity and matches to connected Spud members,
not the full friend graph. Provider tokens are used temporarily server-side.
Refreshing friends starts a new authorisation because no token is retained.

## Meta configuration

### Create the app

1. Open https://developers.facebook.com/apps/ and complete developer registration
   if prompted.
2. Create an app named **Spud** with the use case **Authenticate and request data
   from users with Facebook Login**. This is consumer friend discovery, not
   management of business customers' Facebook assets.
3. Use a monitored contact email and genuine business information. Follow Meta's
   business portfolio and verification prompts; do not invent business details.
4. Keep the app in Development mode during setup and testing.
5. Customize the Facebook Login use case and add `user_friends`. Keep the required
   `public_profile`; do not add email, posts, photos, Pages, or advertising
   permissions for this feature.

Create or use a Meta developer app with the Facebook Login use case for this
consumer app. Follow the current Meta dashboard requirements for verification,
permission access, App Review, and making the app available to public users.
Development mode only permits the app's authorised developer/tester accounts.
Do not assume toggling a permission is production approval.

The published URL was verified on October 3, 2026 as
`https://couch-potato.replit.app`. Recheck the project's publishing settings if
the domain changes, then update **both** Meta and the server configuration.

Set the Facebook Login web configuration:

| Setting | Value |
|---|---|
| Site URL | `https://couch-potato.replit.app/` |
| App domain | `couch-potato.replit.app` |
| Valid OAuth redirect URI | `https://couch-potato.replit.app/api/facebook/callback` |
| Privacy policy URL | `https://couch-potato.replit.app/privacy` |
| Terms URL | `https://couch-potato.replit.app/terms` |
| Deauthorisation callback | `https://couch-potato.replit.app/api/facebook/deauthorize` |
| User data deletion instructions | `https://couch-potato.replit.app/api/facebook/data-deletion` |

Enable HTTPS web OAuth and strict redirect URI matching. Request
`public_profile,user_friends`; Spud verifies that `user_friends` was granted.
The server currently uses Graph API v23.0.

## Server configuration

Use Replit's secure Secrets flow for `FACEBOOK_APP_SECRET` and the app's ID
(`FACEBOOK_APP_ID`). Do not paste credentials into chat or put them in source.
Set the non-secret `FACEBOOK_REDIRECT_URI` to the exact callback above.
These settings belong to the API server, **not** `EXPO_PUBLIC_*` or `VITE_*`.
No native Facebook SDK, iOS Facebook platform configuration, or native
Facebook callback is required: mobile opens the HTTPS browser flow.

Publish the API/web changes so Meta can reach the callback and data-deletion
pages. Confirm the additive Facebook schema changes are present in production
before releasing the API; do not use a destructive schema sync or truncate
profiles to add uniqueness. Restart the development API after changing configuration. Public use
needs Meta's required approval/live access. A new iOS build is needed for
TestFlight users to receive the new mobile controls.

## Verification with real accounts

Use two authorised Meta testers who are Facebook friends and have separate
Spud accounts. Connect both, then refresh the first account's Facebook matches.
Verify that only identities appear until a normal buddy request is accepted.
Decline friends permission, cancel the browser, refresh, unlink, and remove
Spud from Facebook's Apps and Websites to check the failure/removal paths.
Accepted buddies and private watch history must be unchanged by unlinking.

Clerk's existing Facebook **sign-in** provider is configured separately through
the project's Replit-managed authentication settings. Discovery does not depend
on using Facebook to sign into Spud.

## Permission review preparation

Checked against Meta's official documentation on October 3, 2026. Dashboard
labels and requirements can change; follow the requirements shown for this app.

For public friend discovery, request Advanced Access for `user_friends` through
Meta's permission review flow. Meta's current permission reference requires
business verification for Advanced Access. Complete the requested data-handling
questions accurately; approval is Meta's decision.

### Draft justification for user_friends

> Spud is a movie and television tracking app. Its optional “Find friends from
> Facebook” feature lets a signed-in member discover their Facebook friends who
> also use Spud and have authorised the same Meta app and friends permission.
> We use app-scoped Facebook identifiers to match those friends to consenting
> Spud members and show their Spud profile identity and buddy-request status.
> Members can then choose to send an ordinary Spud buddy request. Nothing is
> posted to Facebook and no requests are sent automatically. Watch shelves
> remain private until the buddy request is accepted. We retain only the
> member's app-scoped identifier and matched Spud friend identifiers, not the
> full Facebook friend graph. Provider tokens are used temporarily server-side
> and are not retained. Disconnecting removes Facebook identity and discovery
> references without deleting existing Spud buddies or watch history.

### Before submitting

- Publish and verify the callback, deletion instructions, privacy, and terms
  URLs. An invalid-state callback response is expected when opened directly;
  a 404 is not.
- Complete required business verification and basic app settings, including
  a compliant 1024 × 1024 app icon and accurate app category/contact details.
- Make a successful real API call using `user_friends` within 30 days of the
  review submission. Meta says its activity log can take up to two days to
  update; Request advanced access may remain disabled until then.
- Verify discovery using two consenting, authorised developer/tester-role
  Facebook accounts that are friends and have separate Spud accounts.
- Record the real permission flow and resulting friend discovery in English
  at 1080p or better. Show Spud sign-in, Buddies, Connect Facebook, consent,
  return to Spud, a real matching friend, the optional buddy request, and
  disconnect. Mocked results are not evidence for App Review.
- Explain how reviewers can access Spud and reach this optional connection
  after normal Spud sign-in. If app test credentials are needed, provide
  dedicated test credentials only in Meta's private reviewer fields.
  Never provide personal Facebook credentials.
- Submit only when the recorded flow works. Do not switch to Live mode
  prematurely; live mode does not replace permission approval.

Official references:
- https://developers.facebook.com/docs/development/create-an-app
- https://developers.facebook.com/docs/permissions/
- https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review/submission-guide