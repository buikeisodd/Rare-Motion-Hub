import { UserRound } from 'lucide-react';

export default function UserAvatar({ user, size = 'h-10 w-10', className = '', alt = '' }) {
  const src = user?.avatarUrl || user?.avatar || '';
  if (src) return <img src={src} alt={alt} className={`${size} ${className} shrink-0 rounded-full object-cover`} />;
  return <span className={`${size} ${className} grid shrink-0 place-items-center rounded-full bg-highlight text-primary-label`} aria-label={alt || 'User profile picture'}><UserRound className="h-[48%] w-[48%]" strokeWidth={1.8} /></span>;
}
