// Shared utility: deterministic per-project gradient
const palettes = [
  ['#ff9a9e', '#fecfef', '#fbc2eb'],
  ['#a18cd1', '#fbc2eb', '#e0c3fc'],
  ['#84fab0', '#8fd3f4', '#a1c4fd'],
  ['#ffecd2', '#fcb69f', '#ff9a9e'],
  ['#cfd9df', '#e2ebf0', '#8fd3f4'],
  ['#fbc2eb', '#a6c1ee', '#fccb90'],
  ['#fdcbf1', '#fdcbf1', '#e6dee9'],
  ['#a1c4fd', '#c2e9fb', '#e0c3fc'],
  ['#f6d365', '#fda085', '#f093fb'],
  ['#43e97b', '#38f9d7', '#4facfe'],
  ['#fa709a', '#fee140', '#30cfd0'],
  ['#667eea', '#764ba2', '#f093fb'],
];

export function gradientFor(id) {
  const sum = String(id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = palettes[sum % palettes.length];
  return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 48%, ${colors[2]} 100%)`;
}
