// Starlight Station logo — SVG text, scales without quality loss
export default function StarlightLogo({ className = '' }) {
  return (
    <svg
      viewBox="0 0 260 80"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Starlight Station"
      fill="currentColor"
    >
      <text
        x="50%"
        y="36"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="34"
        fontWeight="400"
        fontStyle="italic"
        letterSpacing="2"
      >
        Starlight
      </text>
      <text
        x="50%"
        y="72"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="34"
        fontWeight="400"
        fontStyle="italic"
        letterSpacing="2"
      >
        Station
      </text>
    </svg>
  );
}
