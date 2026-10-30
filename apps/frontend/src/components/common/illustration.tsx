import type { ImgHTMLAttributes } from 'react';
import { ILLUSTRATIONS, type IllustrationName } from '@/lib/illustrations';
import { cn } from '@/lib/utils';

export interface IllustrationProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'alt'
> {
  name: IllustrationName;
  size?: number;
}

export function Illustration({ name, size = 180, className, ...props }: IllustrationProps) {
  const src = ILLUSTRATIONS[name];

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn('inline-block select-none', className)}
      {...props}
    />
  );
}
