#!/usr/bin/env bun
/**
 * 从 brand/ SSOT 生成各端图标与 splash。
 * 修改 logo 后运行：bun run brand:icons
 */
import { Resvg } from "@resvg/resvg-js";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import pngToIco from "png-to-ico";

const ROOT = join(import.meta.dir, "..");
const BRAND = join(ROOT, "brand");

const APP_ICON_SVG = join(BRAND, "app-icon.svg");
const APP_ICON_LIGHT_SVG = join(BRAND, "app-icon-light.svg");
const MASKABLE_SVG = join(BRAND, "app-icon-maskable.svg");
const MARK_SVG = join(BRAND, "logo.svg");
const MARK_LIGHT_SVG = join(BRAND, "logo-light.svg");

const ANDROID_RES = join(ROOT, "app/mobile/android/app/src/main/res");

const MIPMAP_LAUNCHER: Record<string, number> = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

const MIPMAP_FOREGROUND: Record<string, number> = {
  "mipmap-mdpi": 108,
  "mipmap-hdpi": 162,
  "mipmap-xhdpi": 216,
  "mipmap-xxhdpi": 324,
  "mipmap-xxxhdpi": 432,
};

const SPLASH_SIZES: Record<string, { w: number; h: number }> = {
  "drawable-port-mdpi": { w: 320, h: 480 },
  "drawable-port-hdpi": { w: 480, h: 800 },
  "drawable-port-xhdpi": { w: 720, h: 1280 },
  "drawable-port-xxhdpi": { w: 960, h: 1600 },
  "drawable-port-xxxhdpi": { w: 1280, h: 1920 },
  "drawable-land-mdpi": { w: 480, h: 320 },
  "drawable-land-hdpi": { w: 800, h: 480 },
  "drawable-land-xhdpi": { w: 1280, h: 720 },
  "drawable-land-xxhdpi": { w: 1600, h: 960 },
  "drawable-land-xxxhdpi": { w: 1920, h: 1280 },
  drawable: { w: 480, h: 800 },
};

function readSvg(path: string): string {
  return readFileSync(path, "utf-8");
}

function renderPngSized(svg: string, size: number): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "transparent",
  });
  return Buffer.from(resvg.render().asPng());
}

function renderPngIntrinsic(svg: string): Buffer {
  const resvg = new Resvg(svg, { background: "transparent" });
  return Buffer.from(resvg.render().asPng());
}

function renderSvgFile(path: string, size: number): Buffer {
  return renderPngSized(readSvg(path), size);
}

function splashSvg(width: number, height: number, iconSize: number): string {
  const markInner = readSvg(MARK_SVG)
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");
  const x = (width - iconSize) / 2;
  const y = (height - iconSize) / 2;
  const scale = iconSize / 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#0a0a0b"/>
  <g transform="translate(${x} ${y}) scale(${scale})">${markInner}</g>
</svg>`;
}

function writePng(path: string, data: Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

function copySvg(src: string, dest: string): void {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
}

async function writeIco(pngPaths: string[], dest: string): Promise<void> {
  const buf = await pngToIco(pngPaths);
  writeFileSync(dest, buf);
}

function writeIcns(png1024: Buffer, dest: string): void {
  const png2icons = require("png2icons") as {
    createICNS: (input: Buffer, scalingAlgorithm: number, numOfColors: number) => Buffer;
    BILINEAR: number;
  };
  const icns = png2icons.createICNS(png1024, png2icons.BILINEAR, 0);
  if (!icns || icns.length === 0) {
    throw new Error("png2icons createICNS failed");
  }
  writeFileSync(dest, icns);
}

async function main(): Promise<void> {
  console.log("brand:icons — generating from", BRAND);

  // SVG copies
  copySvg(APP_ICON_SVG, join(ROOT, "site/public/favicon.svg"));
  copySvg(APP_ICON_SVG, join(ROOT, "app/web/app/public/favicon.svg"));
  copySvg(APP_ICON_SVG, join(ROOT, "platform/admin-frontend/app/public/favicon.svg"));

  // Web PWA
  writePng(join(ROOT, "app/web/app/public/icons/icon-192.png"), renderSvgFile(APP_ICON_SVG, 192));
  writePng(join(ROOT, "app/web/app/public/icons/icon-512.png"), renderSvgFile(APP_ICON_SVG, 512));
  writePng(
    join(ROOT, "app/web/app/public/icons/icon-512-maskable.png"),
    renderSvgFile(MASKABLE_SVG, 512),
  );

  // Desktop electron
  const electronIcons = join(ROOT, "app/desktop/electron/icons");
  const png32 = join(electronIcons, "32x32.png");
  const png128 = join(electronIcons, "128x128.png");
  const png256 = join(electronIcons, "256x256.png");
  const png512 = join(electronIcons, "512x512.png");
  const png1024 = join(electronIcons, "1024x1024.png");

  writePng(png32, renderSvgFile(APP_ICON_SVG, 32));
  writePng(png128, renderSvgFile(APP_ICON_SVG, 128));
  writePng(png256, renderSvgFile(APP_ICON_SVG, 256));
  writePng(png512, renderSvgFile(APP_ICON_SVG, 512));
  const buf1024 = renderSvgFile(APP_ICON_SVG, 1024);
  writePng(png1024, buf1024);

  await writeIco([png32, png128, png256], join(electronIcons, "icon.ico"));
  writeIcns(buf1024, join(electronIcons, "icon.icns"));

  // Android mipmap — white launcher tiles (adaptive background is ic_launcher_background #FFFFFF)
  for (const [folder, size] of Object.entries(MIPMAP_LAUNCHER)) {
    const base = join(ANDROID_RES, folder);
    const icon = renderSvgFile(APP_ICON_LIGHT_SVG, size);
    writePng(join(base, "ic_launcher.png"), icon);
    writePng(join(base, "ic_launcher_round.png"), icon);
  }

  for (const [folder, size] of Object.entries(MIPMAP_FOREGROUND)) {
    writePng(
      join(ANDROID_RES, folder, "ic_launcher_foreground.png"),
      renderPngIntrinsic(foregroundSvg(size, MARK_LIGHT_SVG)),
    );
  }

  // Android splash
  for (const [folder, { w, h }] of Object.entries(SPLASH_SIZES)) {
    const iconSize = Math.round(Math.min(w, h) * 0.28);
    const svg = splashSvg(w, h, iconSize);
    writePng(join(ANDROID_RES, folder, "splash.png"), renderPngIntrinsic(svg));
  }

  console.log("brand:icons — done");
}

function foregroundSvg(size: number, markPath: string = MARK_SVG): string {
  const markInner = readSvg(markPath)
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");
  const iconSize = size * 0.55;
  const offset = (size - iconSize) / 2;
  const scale = iconSize / 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${offset} ${offset}) scale(${scale})">${markInner}</g>
</svg>`;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
