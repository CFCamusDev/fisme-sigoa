import type { ImgHTMLAttributes } from 'react';
import { LOGO_ALT_TEXT, type LogoVariant } from '@sigoa/shared';
import { getLogoUrl } from '@/lib/logo';

export interface LogoProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'alt' | 'width' | 'height'
> {
  variant?: LogoVariant;
  size?: number;
  decorative?: boolean;
}

export function Logo({
  variant = 'square',
  size = 32,
  decorative = false,
  className,
  ...props
}: LogoProps) {
  const effectiveSize = Math.max(32, size);
  const altText = decorative ? '' : LOGO_ALT_TEXT;
  const src = getLogoUrl(variant);

  const img = (
    <img
      src={src}
      alt={altText}
      width={effectiveSize}
      height={effectiveSize}
      className={className}
      {...props}
    />
  );

  if (variant === 'horizontal') {
    return (
      <div className="inline-flex items-center gap-3">
        {img}
        <span className="font-bold tracking-tight text-current text-h3 leading-none">
          FISME-SIGOA
        </span>
      </div>
    );
  }

  return img;
}
