export const colors = {
  bg: '#050505',
  bgElevated: '#0A0A0A',
  panel: '#111111',
  panelSoft: '#171717',
  panelHover: '#1D1D1D',
  ink: '#F7F4EC',
  inkStrong: '#FFFFFF',
  muted: '#A6A09A',
  subtle: '#77736E',
  accent: '#D7FF65',
  accentSoft: 'rgba(215,255,101,0.12)',
  accentHover: '#E3FF91',
  danger: '#FF5C6C',
  info: '#85D7FF',
  border: 'rgba(255,255,255,0.09)',
  borderStrong: 'rgba(255,255,255,0.15)',
  overlay: 'rgba(0,0,0,0.72)',
  red: '#FF5C6C',
  blue: '#85D7FF'
};

export const gradients = [
  ['#43E97B', '#38F9D7', '#4FACFE'],
  ['#80ED99', '#57CC99', '#38A3A5'],
  ['#FF9F1C', '#FFBF69', '#CBF3F0'],
  ['#A78BFA', '#F0ABFC', '#FDE68A'],
  ['#4D96FF', '#6BCB77', '#FFD93D'],
  ['#F72585', '#7209B7', '#4CC9F0'],
  ['#FFADAD', '#FFD6A5', '#CAFFBF'],
  ['#06D6A0', '#118AB2', '#073B4C']
];

export function gradientFor(id = '') {
  const sum = String(id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradients[sum % gradients.length];
}
