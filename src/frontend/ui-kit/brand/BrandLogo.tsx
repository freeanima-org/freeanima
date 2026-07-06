import type { SVGProps } from "react";

import { cn } from "../lib/utils.ts";

export type BrandLogoProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

/** L01 core mark — head + brainwave (warm). */
export function BrandLogo({ size = 20, className, ...props }: BrandLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden
      className={cn("shrink-0", className)}
      {...props}
    >
      <circle
        cx="16"
        cy="15.5"
        r="8.5"
        fill="none"
        stroke="#c4a882"
        strokeWidth="1.5"
        opacity="0.36"
      />
      <path
        d="M 9.5 15.5 H 11.5 L 12.75 11.8 L 14.5 16.35 L 16.25 12.1 L 18 15.55 L 19.5 12.15 L 22 15.5"
        fill="none"
        stroke="#dbbf96"
        strokeWidth="1.12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type BrandLockupProps = {
  name: string;
  subtitle?: string;
  logoSize?: number;
  className?: string;
  nameClassName?: string;
  subtitleClassName?: string;
};

/** Logo + product name row for headers and sidebars. */
export function BrandLockup({
  name,
  subtitle,
  logoSize = 20,
  className,
  nameClassName,
  subtitleClassName,
}: BrandLockupProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <BrandLogo size={logoSize} />
      <div className="min-w-0">
        <div className={cn("truncate font-semibold text-sm", nameClassName)}>{name}</div>
        {subtitle ? (
          <div
            className={cn("truncate text-xs font-normal text-muted-foreground", subtitleClassName)}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}
