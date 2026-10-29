'use client';

import { useEffect, useState } from 'react';
import { isDefault } from '@/lib/avatar';
import { avatarUrl, characterSrc, type Facing } from '@/lib/avatar-canvas';
import type { Avatar } from '@/lib/types';

/** 외형을 입힌 캐릭터 그림 */
export default function AvatarImg({ avatar, facing = 'front-right', height = 34, alt = '' }: { avatar?: Avatar; facing?: Facing; height?: number; alt?: string }) {
  const [src, setSrc] = useState(characterSrc(facing));
  useEffect(() => {
    let alive = true;
    if (isDefault(avatar)) {
      setSrc(characterSrc(facing));
      return;
    }
    avatarUrl(avatar, facing)
      .then((u) => {
        if (alive) setSrc(u);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [avatar, facing]);
  return <img src={src} alt={alt} style={{ height, width: 'auto', objectFit: 'contain', imageRendering: 'pixelated' }} />;
}
