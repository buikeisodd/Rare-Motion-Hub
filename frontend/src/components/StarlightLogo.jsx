export function StarlightMark({ className = 'h-8 w-8', color = '#FF8A3D' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M 12 36 C 6 24, 16 10, 28 8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 18 40 C 28 42, 40 32, 42 18" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 8 20 C 14 8, 32 6, 40 14" stroke="currentColor" strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" />
      <circle cx="28" cy="8" r="2.5" fill={color} />
    </svg>
  );
}

export default function StarlightLogo({ className = '', compact = false, showTagline = true, markClassName = 'h-8 w-8' }) {
  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <StarlightMark className={`${markClassName} shrink-0 text-[#F7F4EC]`} color="#FF8A3D" />
      {!compact && (
        <div className="flex flex-col leading-none overflow-hidden whitespace-nowrap">
          <span className="font-sans text-base font-bold tracking-tight text-[#F7F4EC]">Starlight Station</span>
          {showTagline && (
            <span className="text-[10px] font-medium tracking-wider text-[#A6A09A] uppercase mt-1">Your work in motion</span>
          )}
        </div>
      )}
    </div>
  );
}
