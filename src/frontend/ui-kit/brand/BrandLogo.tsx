import type { ImgHTMLAttributes } from "react";

import appIconUrl from "./app-icon.png";
import { cn } from "../lib/utils.ts";

export type BrandLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> & {
  size?: number;
};

/** L01 core mark — app icon. */
export function BrandLogo({ size = 20, className, alt = "", ...props }: BrandLogoProps) {
  return (
    <img
      src={appIconUrl}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      className={cn("shrink-0", className)}
      {...props}
    />
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
