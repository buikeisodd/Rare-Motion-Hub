export const colors = {
  bg: '#F3EBDD',
  bgElevated: '#EAE4D7',
  panel: '#F0EBE1',
  panelSoft: '#E5DFD2',
  panelHover: '#D8D8C9',
  ink: '#34483B',
  inkStrong: '#22352A',
  muted: '#667268',
  subtle: '#7D897F',
  accent: '#6F8974',
  accentSoft: 'rgba(111,137,116,0.18)',
  accentHover: '#9BAF9B',
  danger: '#FF5C6C',
  info: '#85D7FF',
  border: 'rgba(23,23,20,0.12)',
  borderStrong: 'rgba(23,23,20,0.22)',
  overlay: 'rgba(23,23,20,0.28)',
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

