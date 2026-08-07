export default function Terms() {
  return (
    <div className="min-h-full pb-20 px-5 pt-8 max-w-2xl mx-auto" style={{ background: '#FFF3E8', color: '#111111' }}>

      {/* Back button */}
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

      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
        Terms of Service
      </h1>
      <p className="text-sm mb-8" style={{ color: '#7E7A73' }}>Last updated: August 7, 2026</p>

      <p className="text-sm leading-relaxed mb-8" style={{ color: '#3D3A35' }}>
        These terms cover your use of Spud, a movie and TV tracking app. By creating an account or using Spud, you're agreeing to them. If something here doesn't sit right with you, the best move is not to use the app.
      </p>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>1. Who we are</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          Spud is operated by Christian Rocha Adames as a sole trader based in Australia. You can reach us at{' '}
          <a
            href="mailto:christian.rocha.adames@outlook.com"
            className="underline font-medium"
            style={{ color: '#116149' }}
          >
            christian.rocha.adames@outlook.com
          </a>.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>2. Age requirement</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          You need to be 18 or older to use Spud. By signing up, you're confirming that's true.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>3. Your account</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          You'll need an account to use Spud, created either with an email and password or by signing in through Google, Apple, GitHub, or X. You're responsible for keeping your login secure and for anything that happens under your account. If you notice any unauthorised use, let us know straight away. We can suspend or close accounts that break these terms.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>4. What you log stays yours</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          Everything you add to Spud — ratings, notes, watch history — belongs to you. We only use it to run the app for you. Your entries are private by default. The only exception is the optional Facebook friend-finding feature, which only shows your basic profile (name, username, bio, avatar) to mutual friends who've also opted in, and only after both of you connect Facebook.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>5. Using Spud fairly</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          When using Spud, please don't: break any applicable law, pretend to be someone you're not, try to access parts of the system you're not meant to, scrape or pull data out of Spud using automated tools, upload anything harmful like malicious code, or use Spud for a commercial purpose without asking us first. We can suspend or remove access for anyone who does.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>6. Movie and show data</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          Titles, posters, and streaming availability shown in Spud come from The Movie Database (TMDB) and OMDB. That data belongs to those services and is subject to their own terms, not ours. We display it as-is and can't guarantee it's always accurate or current.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>7. Ownership</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          The Spud name, logo, and app design belong to us. Please don't copy, rebuild, or redistribute any part of it without asking first.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>8. No guarantees</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          Spud is provided as it is. We do our best to keep it running smoothly, but we can't promise it'll always be available, bug-free, or that the movie and show data pulled from third parties will always be accurate.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>9. Limits on our liability</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          To the extent the law allows, we're not liable for indirect or consequential losses arising from your use of Spud. Since Spud is currently free with no paid features, our total liability to you is limited to nil beyond what's required by law.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>10. Ending your access</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          You can stop using Spud and delete your account whenever you like. We can also suspend or end your access if you break these terms. Sections that naturally need to survive that, like ownership and liability limits, will keep applying afterward.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>11. Governing law</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          These terms are governed by the laws of New South Wales, Australia, and any disputes will be handled in NSW courts.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>12. Changes to these terms</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          We may update these terms from time to time. If we do, we'll update the date at the top.
        </p>
      </section>

      <section className="mb-7">
        <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>13. Contact</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#3D3A35' }}>
          Email:{' '}
          <a
            href="mailto:christian.rocha.adames@outlook.com"
            className="underline font-medium"
            style={{ color: '#116149' }}
          >
            christian.rocha.adames@outlook.com
          </a>
        </p>
      </section>

    </div>
  );
}
