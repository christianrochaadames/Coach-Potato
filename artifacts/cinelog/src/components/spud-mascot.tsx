import { cn } from '@/lib/utils';

interface SpudProps {
  pose?: 'relaxed' | 'sleepy' | 'celebrating' | 'watching';
  className?: string;
  size?: number;
}

export function SpudMascot({ pose = 'relaxed', className, size = 120 }: SpudProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className)}
    >
      {/* Potato body */}
      <ellipse cx="60" cy="74" rx="38" ry="34" fill="#C4A35A" stroke="#111111" strokeWidth="2.5" />
      <ellipse cx="50" cy="70" rx="10" ry="14" fill="#B8913A" opacity="0.35" />

      {/* Trucker cap brim */}
      <rect x="30" y="42" width="60" height="8" rx="4" fill="#116149" stroke="#111111" strokeWidth="2" />
      {/* Cap crown */}
      <ellipse cx="60" cy="36" rx="26" ry="18" fill="#116149" stroke="#111111" strokeWidth="2.5" />
      {/* Cap button */}
      <circle cx="60" cy="20" r="3" fill="#9BD6FF" stroke="#111111" strokeWidth="1.5" />
      {/* Cap text */}
      <text x="60" y="39" textAnchor="middle" fontSize="5.5" fontWeight="800" fill="#FFF3E8" fontFamily="Manrope, sans-serif" letterSpacing="0.5">COUCH POTATO</text>

      {/* Eyes */}
      {pose === 'sleepy' ? (
        <>
          <path d="M46 70 Q50 66 54 70" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M66 70 Q70 66 74 70" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <text x="80" y="58" fontSize="11" fill="#111111" opacity="0.6" fontFamily="Manrope, sans-serif">z</text>
          <text x="88" y="49" fontSize="8" fill="#111111" opacity="0.4" fontFamily="Manrope, sans-serif">z</text>
          <text x="93" y="42" fontSize="6" fill="#111111" opacity="0.25" fontFamily="Manrope, sans-serif">z</text>
        </>
      ) : pose === 'watching' ? (
        <>
          <circle cx="50" cy="70" r="7" fill="white" stroke="#111111" strokeWidth="1.5" />
          <circle cx="70" cy="70" r="7" fill="white" stroke="#111111" strokeWidth="1.5" />
          <circle cx="51" cy="71" r="3.5" fill="#111111" />
          <circle cx="71" cy="71" r="3.5" fill="#111111" />
          <circle cx="52" cy="69" r="1.2" fill="white" />
          <circle cx="72" cy="69" r="1.2" fill="white" />
        </>
      ) : (
        <>
          <ellipse cx="50" cy="71" rx="5" ry="5.5" fill="white" stroke="#111111" strokeWidth="1.5" />
          <ellipse cx="70" cy="71" rx="5" ry="5.5" fill="white" stroke="#111111" strokeWidth="1.5" />
          <circle cx="51" cy="72" r="2.5" fill="#111111" />
          <circle cx="71" cy="72" r="2.5" fill="#111111" />
          <circle cx="52" cy="70" r="1" fill="white" />
          <circle cx="72" cy="70" r="1" fill="white" />
        </>
      )}

      {/* Smile */}
      {pose !== 'sleepy' && (
        <path
          d={pose === 'celebrating' ? "M48 82 Q60 94 72 82" : "M50 81 Q60 89 70 81"}
          stroke="#111111"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Arms */}
      {pose === 'celebrating' ? (
        <>
          <path d="M22 72 Q14 56 20 46" stroke="#C4A35A" strokeWidth="6" strokeLinecap="round" />
          <path d="M98 72 Q106 56 100 46" stroke="#C4A35A" strokeWidth="6" strokeLinecap="round" />
          <text x="8" y="46" fontSize="14" fill="#FFD34D">★</text>
          <text x="97" y="40" fontSize="11" fill="#FFD34D">★</text>
          <text x="6" y="62" fontSize="9" fill="#FFD34D">★</text>
        </>
      ) : (
        <>
          <path d="M22 82 Q16 72 23 67" stroke="#C4A35A" strokeWidth="6" strokeLinecap="round" />
          <path d="M98 82 Q104 72 97 67" stroke="#C4A35A" strokeWidth="6" strokeLinecap="round" />
        </>
      )}

      {/* Remote for watching */}
      {pose === 'watching' && (
        <>
          <rect x="82" y="76" width="17" height="28" rx="4" fill="#333333" stroke="#111111" strokeWidth="1.5" />
          <rect x="85" y="79" width="11" height="6" rx="1.5" fill="#9BD6FF" opacity="0.7" />
          <circle cx="87" cy="90" r="1.5" fill="#EFE4D2" />
          <circle cx="91" cy="90" r="1.5" fill="#EFE4D2" />
          <circle cx="87" cy="95" r="1.5" fill="#EFE4D2" />
          <circle cx="91" cy="95" r="1.5" fill="#EFE4D2" />
        </>
      )}

      {/* Feet */}
      <ellipse cx="46" cy="104" rx="13" ry="6" fill="#C4A35A" stroke="#111111" strokeWidth="2" />
      <ellipse cx="74" cy="104" rx="13" ry="6" fill="#C4A35A" stroke="#111111" strokeWidth="2" />
    </svg>
  );
}
