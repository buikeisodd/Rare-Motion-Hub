export function StarlightMark({ className = 'h-8 w-8' }) {
  return <img src="/brand/rare-motion-mark.jpg" alt="Rare Motion Hub" className={`${className} rounded-xl object-cover`} />;
}

export default function StarlightLogo({ className = '', compact = false, showTagline = true, markClassName = 'h-8 w-8' }) {
  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <StarlightMark className={`${markClassName} shrink-0`} />
      {!compact && (
        <div className="flex flex-col leading-none overflow-hidden whitespace-nowrap">
          <span className="font-sans text-base font-bold tracking-tight text-[#171714]">Rare Motion Hub</span>
          {showTagline && <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[#667268]">Your work in motion</span>}
        </div>
      )}
    </div>
  );
}
