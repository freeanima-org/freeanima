fn main() {
  let channel = std::env::var("FREEANIMA_BUILD_CHANNEL").unwrap_or_else(|_| "dev".into());
  let home_dirname = if channel.trim().eq_ignore_ascii_case("dev") {
    ".anima-dev"
  } else {
    ".anima"
  };
  println!("cargo:rustc-env=FREEANIMA_DEFAULT_HOME_DIRNAME={home_dirname}");
  println!("cargo:rerun-if-env-changed=FREEANIMA_BUILD_CHANNEL");
  tauri_build::build()
}
