//! 任务栏 overlay / 托盘注意力用的小图标（纯 RGBA，无额外资源文件）。

use tauri::image::Image;

const SIZE: u32 = 16;

fn filled_circle(r: u8, g: u8, b: u8, radius: f32) -> Image<'static> {
  let w = SIZE;
  let h = SIZE;
  let mut rgba = vec![0u8; (w * h * 4) as usize];
  let cx = (w as f32 - 1.0) / 2.0;
  let cy = (h as f32 - 1.0) / 2.0;
  for y in 0..h {
    for x in 0..w {
      let dx = x as f32 - cx;
      let dy = y as f32 - cy;
      let i = ((y * w + x) * 4) as usize;
      if dx * dx + dy * dy <= radius * radius {
        rgba[i] = r;
        rgba[i + 1] = g;
        rgba[i + 2] = b;
        rgba[i + 3] = 255;
      }
    }
  }
  Image::new_owned(rgba, w, h)
}

/// Windows 任务栏未读角标（红点，非应用图标缩小）。
#[cfg(target_os = "windows")]
pub fn unread_badge_overlay() -> Image<'static> {
  filled_circle(220, 38, 38, 6.5)
}

/// 托盘闪烁「亮」相位（琥珀色圆点）。
pub fn tray_attention_icon() -> Image<'static> {
  filled_circle(245, 158, 11, 7.0)
}
