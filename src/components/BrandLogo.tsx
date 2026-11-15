import React from 'react';

interface BrandLogoProps {
  variant?: 'dark' | 'light';
  showWordmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function BrandLogo({
  variant = 'dark',
  showWordmark = true,
  size = 'md',
}: BrandLogoProps) {
  const iconDims = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg';
  const textColor = variant === 'light' ? 'text-white' : 'text-[#111C18]';

  return (
    <div className="inline-flex items-center gap-2.5 shrink-0">
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconDims} shrink-0`}
        aria-hidden="true"
      >
        <rect
          width="36"
          height="36"
          rx="9"
          fill={variant === 'light' ? '#16794F' : '#113C2E'}
        />
        <path
          d="M7 24L13.5 13.5L18.5 20L23 14.5L29 24H7Z"
          fill={variant === 'light' ? '#E8F4EE' : '#34D399'}
          fillOpacity="0.92"
        />
        <path
          d="M7 26.5H29"
          stroke="#FFFFFF"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M11 29.5H25"
          stroke="#FFFFFF"
          strokeOpacity="0.55"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {showWordmark && (
        <span
          className={`font-display font-bold tracking-tight whitespace-nowrap shrink-0 ${textSize} ${textColor}`}
        >
          TripLedger
        </span>
      )}
    </div>
  );
}
