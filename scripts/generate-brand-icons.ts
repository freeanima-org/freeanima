#!/usr/bin/env bun
/**
 * 从 brand/app-icon.png SSOT 生成各端图标与 splash。
 * 修改 logo 后运行：just brand-icons
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import pngToIco from "png-to-ico";
import sharp from "sharp";
import { resolveTauriAndroidMain } from "./tauri-android-gen-paths.ts";

const ROOT = join(import.meta.dir, "..");
const APP_ICON_PNG = join(ROOT, "brand/app-icon.png");

const BG_DARK = "#0a0a0b";
const BG_NAVY = "#0d1628";

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

function writePng(path: string, data: Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

async function renderIcon(size: number): Promise<Buffer> {
  return sharp(APP_ICON_PNG)
    .resize(size, size, { fit: "cover", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
}

async function renderMaskable(size: number): Promise<Buffer> {
  const inner = Math.round(size * 0.8);
  const icon = await renderIcon(inner);
  const offset = Math.round((size - inner) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background: BG_NAVY },
  })
    .composite([{ input: icon, left: offset, top: offset }])
    .png()
    .toBuffer();
}

async function renderForeground(size: number): Promise<Buffer> {
  const inner = Math.round(size * 0.55);
  const icon = await renderIcon(inner);
  const offset = Math.round((size - inner) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: icon, left: offset, top: offset }])
    .png()
    .toBuffer();
}

async function renderSplash(width: number, height: number): Promise<Buffer> {
  const iconSize = Math.round(Math.min(width, height) * 0.28);
  const icon = await renderIcon(iconSize);
  const left = Math.round((width - iconSize) / 2);
  const top = Math.round((height - iconSize) / 2);
  return sharp({
    create: { width, height, channels: 4, background: BG_DARK },
  })
    .composite([{ input: icon, left, top }])
    .png()
    .toBuffer();
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
  console.log("brand:icons — generating from", APP_ICON_PNG);

  const faviconDests = [
    join(ROOT, "site/public/favicon.png"),
    join(ROOT, "src/portal/app/web/spa/public/favicon.png"),
    join(ROOT, "src/features/habitat/ui/habitat/public/favicon.png"),
  ];
  const favicon32 = await renderIcon(32);
  for (const dest of faviconDests) {
    writePng(dest, favicon32);
  }

  writePng(join(ROOT, "src/portal/app/web/spa/public/icons/icon-192.png"), await renderIcon(192));
  writePng(join(ROOT, "src/portal/app/web/spa/public/icons/icon-512.png"), await renderIcon(512));
  writePng(
    join(ROOT, "src/portal/app/web/spa/public/icons/icon-512-maskable.png"),
    await renderMaskable(512),
  );

  const tauriIcons = join(ROOT, "src/portal/app/tauri/src-tauri/icons");
  const png32 = join(tauriIcons, "32x32.png");
  const png128 = join(tauriIcons, "128x128.png");
  const png256 = join(tauriIcons, "256x256.png");
  const png512 = join(tauriIcons, "512x512.png");
  const png1024 = join(tauriIcons, "1024x1024.png");

  writePng(png32, await renderIcon(32));
  writePng(png128, await renderIcon(128));
  writePng(png256, await renderIcon(256));
  writePng(png512, await renderIcon(512));
  const buf1024 = await renderIcon(1024);
  writePng(png1024, buf1024);

  await writeIco([png32, png128, png256], join(tauriIcons, "icon.ico"));
  writeIcns(buf1024, join(tauriIcons, "icon.icns"));

  const androidMain = resolveTauriAndroidMain(ROOT);
  if (androidMain) {
    const androidRes = join(androidMain, "res");
    for (const [folder, size] of Object.entries(MIPMAP_LAUNCHER)) {
      const base = join(androidRes, folder);
      const icon = await renderIcon(size);
      writePng(join(base, "ic_launcher.png"), icon);
      writePng(join(base, "ic_launcher_round.png"), icon);
    }

    for (const [folder, size] of Object.entries(MIPMAP_FOREGROUND)) {
      writePng(
        join(androidRes, folder, "ic_launcher_foreground.png"),
        await renderForeground(size),
      );
    }

    for (const [folder, { w, h }] of Object.entries(SPLASH_SIZES)) {
      writePng(join(androidRes, folder, "splash.png"), await renderSplash(w, h));
    }
  } else {
    console.log(
      "brand:icons — skip Android mipmap/splash（尚无 gen/android；init 后请再跑 just brand-icons）",
    );
  }

  writePng(join(ROOT, "src/ui-kit/brand/app-icon.png"), await renderIcon(64));

  console.log("brand:icons — done");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
