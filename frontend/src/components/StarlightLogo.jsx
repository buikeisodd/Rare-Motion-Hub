export default function StarlightLogo({ className = '' }) {
  return (
    <svg
      viewBox="0 0 260 80"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Starlight Station"
    >
      <defs>
        {/* Glow filter */}
        <filter id="glow" x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="3.5" result="blur1" />
          <feGaussianBlur stdDeviation="7" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Subtle shimmer gradient — sweeps left to right */}
        <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="currentColor" stopOpacity="0.7" />
          <stop offset="45%"  stopColor="currentColor" stopOpacity="1" />
          <stop offset="55%"  stopColor="white"        stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.7" />
          <animateTransform
            attributeName="gradientTransform"
            type="translate"
            from="-1 0"
            to="1 0"
            dur="3s"
            repeatCount="indefinite"
          />
        </linearGradient>

        {/* Pulse animation on the glow blur */}
        <animate
          id="glowPulse"
          attributeName="stdDeviation"
          values="2;5;2"
          dur="2.8s"
          repeatCount="indefinite"
        />
      </defs>

      {/* Glow layer — blurred duplicate behind */}
      <g filter="url(#glow)" opacity="0.6">
        <text
          x="50%" y="36"
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="34" fontWeight="400" fontStyle="italic" letterSpacing="2"
          fill="currentColor"
        >
          Starlight
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2.8s" repeatCount="indefinite" />
        </text>
        <text
          x="50%" y="72"
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="34" fontWeight="400" fontStyle="italic" letterSpacing="2"
          fill="currentColor"
        >
          Station
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2.8s" repeatCount="indefinite" />
        </text>
      </g>

      {/* Main text with shimmer fill */}
      <text
        x="50%" y="36"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="34" fontWeight="400" fontStyle="italic" letterSpacing="2"
        fill="url(#shimmer)"
      >
        Starlight
      </text>
      <text
        x="50%" y="72"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="34" fontWeight="400" fontStyle="italic" letterSpacing="2"
        fill="url(#shimmer)"
      >
        Station
      </text>
    </svg>
  );
}
