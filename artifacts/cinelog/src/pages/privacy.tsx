import type { RouteComponentProps } from 'wouter';

type PrivacyProps = Partial<RouteComponentProps> & { embedded?: boolean };

export default function Privacy({ embedded = false }: PrivacyProps) {
  return (
    <div className="min-h-full pb-20 px-5 pt-8 max-w-2xl mx-auto" style={{ background: '#FFF3E8', color: '#111111' }}>

      {/* Back button — only shown when navigating from within the app */}
      {!embedded && (
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 text-sm font-semibold mb-6 active:opacity-60"
          style={{ color: '#116149' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back
        </button>
      )}

      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
        Privacy Policy
      </h1>
      <p className="text-sm mb-8" style={{ color: '#7E7A73' }}>Last updated: October 3, 2026</p>

      <p className="text-sm leading-relaxed mb-8" style={{ color: '#3D3A35' }}>
        Spud is a movie and TV tracking app. This policy explains what information Spud collects, why, and what your options are. It only covers what Spud actually does — there's no advertising and no data sold to anyone.
      </p>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>1. Who runs Spud</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          Spud is operated by Christian Rocha Adames, trading as an individual (sole trader) based in Australia. Contact details are at the bottom of this page.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-3" style={{ color: '#111111' }}>2. Information you give us</h2>
        <div className="space-y-3">
          <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
            <strong className="font-semibold" style={{ color: '#111111' }}>Account details.</strong> When you sign up, you create a profile with a first name, last name, username, and optional bio. You can choose an avatar from Spud's built-in character set, or upload your own photo.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
            <strong className="font-semibold" style={{ color: '#111111' }}>Login.</strong> Spud doesn't store your password. Sign-in is handled by our authentication provider, Clerk, either by email and password or by connecting a Google, Apple, GitHub, or X account. Clerk holds your email address, your OAuth login tokens, and session information on their servers, not ours.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
            <strong className="font-semibold" style={{ color: '#111111' }}>What you log.</strong> Every title you add to your list — its watch status, your rating, the date, your notes, and which streaming service you watched it on — is saved to your Spud account so the app can build your history and recommendations.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
            <strong className="font-semibold" style={{ color: '#111111' }}>Optional Facebook friend finding.</strong> If you choose to connect Facebook, Meta supplies your app-specific Facebook identifier and identifiers for friends who also authorised the same Facebook app and friends permission. We keep your identifier and only matches to other Spud members who connected Facebook, not your full friend list. Your Facebook access token is used briefly on our server, never saved or sent to your device. This does not post to Facebook, send buddy requests automatically, or grant access to private shelves. You can refresh matches or disconnect on the Spud buddies page. Disconnecting deletes your Facebook identifier and discovery matches, including references to you in other members’ discovery matches, without removing accepted buddies or your watch history.
          </p>
        </div>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>3. Information we collect automatically</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
           Spud's web app sets one functional cookie to remember whether your sidebar is open or closed, and briefly uses your browser's session storage to manage search focus. The published web app uses Replit-hosted analytics to measure anonymous page views and selected product interactions. The mobile app uses PostHog only for selected product interactions such as adding a title, completing onboarding, updating a watch status, or saving a rating. Mobile events may include the app version, build number, operating system name and version, and a randomly generated analytics identifier. We do not send your name, email address, username, bio, notes, title names, search text, account identifiers, advertising identifiers, or precise location in these events. Our servers may briefly log technical request data (like IP address) as part of normal traffic, but this isn't stored against your account or kept long-term.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>4. What we don't collect</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
           Spud does not collect your precise location or advertising device identifiers, and does not use analytics for advertising. Replit-hosted web analytics and PostHog mobile analytics record aggregate usage patterns and selected anonymous events so we can improve Spud. Mobile session replay, automatic touch capture, surveys, and automatic screen capture are disabled.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>5. How we use your information</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
           We use your information to run your account, save your watch history, show you personalised recommendations, verify your identity when you sign in, provide customer support, send essential account and operational messages, and understand aggregate usage of Spud. Signed-in members can search your first name, last name or username and see your name, username and profile picture. If you accept a buddy request, that buddy can also see your bio, top favorite movies and TV shows, and the titles, posters, statuses and counts in your watching, watchlist and watched shelves. Your email address, ratings, notes and watched dates are never shared with buddies. You can remove a buddy at any time to stop sharing your shelves and favorites. We don't send marketing emails, use your data for marketing, or sell it to anyone.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>6. Services we rely on</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
           Clerk (sign-up, login, password resets, and essential account emails), TMDB (show/movie details, posters, streaming availability), OMDB (IMDb/Rotten Tomatoes scores), Replit (hosts our servers, database, and web analytics), PostHog (anonymous mobile product analytics), and Expo/EAS (builds and distributes the mobile app). If you choose Facebook friend finding, Meta also processes your authorisation under its own privacy policy. Spud does not use Facebook advertising, tracking SDKs, or social plugins.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>7. Where your data lives</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          Spud's servers, database, and authentication provider are hosted in the United States. PostHog processes anonymous mobile analytics in the region configured for our PostHog project. If you're using Spud from Australia or elsewhere, some information will be transferred overseas.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>8. How long we keep your data</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          We keep your account and log data for as long as your account is active. If you delete your account, your profile and log entries are removed from our database.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>9. Your rights</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          Under Australia's Privacy Act, you can ask us to tell you what personal information we hold about you, correct anything wrong, or delete your account entirely by emailing us. If you're outside Australia, you may have additional rights under your local law (such as GDPR); we'll honour reasonable requests regardless.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>10. Security</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          We take reasonable steps to protect your information, including relying on Clerk's security practices. No online service can guarantee complete security.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>11. Age requirement</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          Spud is intended for people aged 18 and over. By creating an account, you're confirming you meet that requirement.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>12. Changes to this policy</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          If we make meaningful changes to how we handle your data, we'll update this page and the date at the top.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>13. Contact us</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          Email:{' '}
          <a
            href="mailto:mrspudcouchpotato@gmail.com"
            className="underline font-medium"
            style={{ color: '#116149' }}
          >
            mrspudcouchpotato@gmail.com
          </a>
        </p>
      </section>

    </div>
  );
}
