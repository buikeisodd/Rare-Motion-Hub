// Starlight Station logo — blends with background in dark mode, black text in light mode
export default function StarlightLogo({ className = '' }) {
  return (
    <svg
      viewBox="0 0 320 72"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Starlight Station"
      fill="currentColor"
    >
      <text
        x="50%"
        y="38"
        textAnchor="middle"
        fontFamily="'Georgia', 'Times New Roman', serif"
        fontSize="28"
        fontWeight="400"
        fontStyle="italic"
        letterSpacing="1.5"
      >
        Starlight
      </text>
      <text
        x="50%"
        y="66"
        textAnchor="middle"
        fontFamily="'Georgia', 'Times New Roman', serif"
        fontSize="28"
        fontWeight="400"
        fontStyle="italic"
        letterSpacing="1.5"
      >
        Station
      </text>
    </svg>
  );
}
