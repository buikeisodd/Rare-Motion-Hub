export const colors = {
  ink: '#F7F4EC',
  muted: '#A6A09A',
  bg: '#050505',
  primaryBackground: '#000000',
  primaryLabel: '#FFFFFF',
  panel: '#121212',
  panelSoft: '#1B1B1B',
  border: '#2A2927',
  accent: '#D7FF65',
  red: '#FF5C6C',
  blue: '#85D7FF'
};

export const gradients = [
  ['#F96F6E', '#FFD166', '#8AE9C1'],
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
