import { useLocation } from 'wouter';
import { SpudMascot } from '@/components/spud-mascot';
import { CouchPotatoLogo } from '@/components/couch-potato-logo';

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div
      className="min-h-full flex flex-col items-center justify-center px-5 text-center py-20"
      style={{ background: '#FFF3E8' }}
    >
      <CouchPotatoLogo size="md" className="mb-6" />
      <SpudMascot pose="watching" size={120} className="mb-4" />
      <h1 className="text-2xl font-bold mb-2" style={{ color: '#111111' }}>
        Lost in the couch cushions
      </h1>
      <p className="text-sm mb-6 font-medium" style={{ color: '#7E7A73' }}>
        That page doesn&apos;t exist.
      </p>
      <button
        onClick={() => setLocation('/')}
        className="px-8 py-3 rounded-full font-bold text-white"
        style={{ background: '#116149' }}
      >
        Go Home
      </button>
    </div>
  );
}
