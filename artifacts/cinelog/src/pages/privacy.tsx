export default function Privacy() {
  return (
    <div className="min-h-full pb-12 px-5 pt-8 max-w-2xl mx-auto" style={{ background: '#FFF3E8', color: '#111111' }}>
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>Privacy Policy</h1>
      <p className="text-sm mb-8" style={{ color: '#7E7A73' }}>Last updated: August 2, 2026</p>

      <section className="mb-6">
        <h2 className="text-lg font-bold mb-2">What CouchPotato is</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          CouchPotato is a personal movie and TV show tracker. You log what you watch,
          rate titles, and view stats about your viewing habits. All your data belongs to you.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-bold mb-2">Data we collect</h2>
        <ul className="text-sm leading-relaxed space-y-2" style={{ color: '#3D3A35' }}>
          <li><strong>Account information</strong> — your name and email address, provided when you sign up via Clerk.</li>
          <li><strong>Watch history</strong> — titles you log, ratings, notes, and viewing dates you enter manually.</li>
          <li><strong>Profile photo</strong> — only if you choose to upload one.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-bold mb-2">Data we do not collect</h2>
        <ul className="text-sm leading-relaxed space-y-2" style={{ color: '#3D3A35' }}>
          <li>We do not collect location data.</li>
          <li>We do not track you across other apps or websites.</li>
          <li>We do not sell your data to third parties.</li>
          <li>We do not use your data for advertising.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-bold mb-2">Third-party services</h2>
        <ul className="text-sm leading-relaxed space-y-2" style={{ color: '#3D3A35' }}>
          <li>
            <strong>Clerk</strong> — handles authentication. Your email and name are stored
            by Clerk under their{' '}
            <a
              href="https://clerk.com/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: '#116149' }}
            >
              Privacy Policy
            </a>.
          </li>
          <li>
            <strong>TMDB (The Movie Database)</strong> — we fetch movie and show metadata
            (titles, posters, genres) from TMDB's public API. We do not share your personal
            data with TMDB.
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-bold mb-2">Data retention and deletion</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          Your data is stored for as long as you have an account. You can delete your
          account at any time from the Profile page. Upon deletion, all your watch history
          and personal information is permanently removed.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-bold mb-2">Children's privacy</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          CouchPotato is not directed at children under 13. We do not knowingly collect
          personal information from children under 13.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-bold mb-2">Contact</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          If you have questions about this policy, please reach out via the App Store
          support link on the CouchPotato listing.
        </p>
      </section>
    </div>
  );
}
