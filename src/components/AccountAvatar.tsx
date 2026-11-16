import { Cloud } from '@phosphor-icons/react/Cloud';
import { MoonStars } from '@phosphor-icons/react/MoonStars';
import { Star } from '@phosphor-icons/react/Star';
import { UserCircle } from '@phosphor-icons/react/UserCircle';
import type { User } from '../lib/api';

export function AccountAvatar({ avatar, size = 21 }: { avatar?: User['avatar']; size?: number }) {
  if (avatar?.startsWith('data:image/')) return <img src={avatar} width={size} height={size} alt="" className="account-avatar-image" />;
  const Icon = avatar === 'cloud' ? Cloud : avatar === 'star' ? Star : avatar === 'moon' ? MoonStars : UserCircle;
  return <Icon size={size} aria-hidden="true" />;
}
