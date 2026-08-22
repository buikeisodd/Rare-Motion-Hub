export function StarlightMark({ className = 'h-8 w-8' }) {
  return <img src="/brand/rare-motion-mark.jpg" alt="Starlight Station" className={`${className} rounded-xl object-cover mix-blend-multiply`} />;
}

export default function StarlightLogo({ className = '', compact = false, showTagline = true, markClassName = 'h-8 w-8' }) {
  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <StarlightMark className={`${markClassName} shrink-0`} />
      {!compact && (
        <div className="flex flex-col leading-none overflow-hidden whitespace-nowrap">
          <span className="font-sans text-lg font-bold tracking-[0.02em] text-[#34483B] sm:text-xl">Starlight Station</span>
          {showTagline && <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[#667268]">Your work in motion</span>}
        </div>
      )}
    </div>
  );
}

