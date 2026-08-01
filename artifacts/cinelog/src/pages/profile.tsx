import { ChevronRight, User, Bell, HelpCircle, Info } from 'lucide-react';
import { SpudMascot } from '@/components/spud-mascot';
import { CouchPotatoLogo } from '@/components/couch-potato-logo';

const SETTINGS = [
  { icon: User, label: 'Profile Settings', desc: 'Name, avatar & preferences' },
  { icon: Bell, label: 'Notifications', desc: 'Reminders and alerts' },
  { icon: HelpCircle, label: 'Help & Support', desc: 'FAQ and contact' },
  { icon: Info, label: 'About CouchPotato', desc: 'Version 1.0.0' },
];

export default function Profile() {
  return (
    <div className="min-h-full pb-8" style={{ background: '#FFF3E8' }}>
      <div className="px-5 pt-8 pb-4">
        <h1 className="text-2xl font-bold" style={{ color: '#111111' }}>Profile</h1>
      </div>

      {/* Profile hero card */}
      <div
        className="mx-5 mb-6 rounded-3xl p-6 flex flex-col items-center text-white"
        style={{ background: '#116149' }}
      >
        <SpudMascot pose="celebrating" size={100} className="mb-3" />
        <p className="text-xl font-bold">Hey, Spud! 🛋️</p>
        <p className="text-sm opacity-70 mt-1">Your TV life, remembered.</p>
        <div className="mt-4">
          <CouchPotatoLogo size="sm" onDark />
        </div>
      </div>

      {/* Settings list */}
      <div className="px-5 space-y-2">
        {SETTINGS.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="rounded-2xl px-4 py-4 flex items-center gap-3 cursor-pointer active:opacity-70 transition-opacity"
            style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#EFE4D2' }}
            >
              <Icon className="w-4 h-4" style={{ color: '#116149' }} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color: '#111111' }}>{label}</p>
              <p className="text-xs" style={{ color: '#7E7A73' }}>{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: '#7E7A73' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
