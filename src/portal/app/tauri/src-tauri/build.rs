fn main() {
  let channel = std::env::var("FREEANIMA_BUILD_CHANNEL").unwrap_or_else(|_| "dev".into());
  let channel = channel.trim().to_ascii_lowercase();
  let (home_dirname, product_name) = if channel == "dev" {
    (".anima-dev", "FreeAnima Dev")
  } else {
    (".anima", "FreeAnima")
  };
  println!("cargo:rustc-env=FREEANIMA_DEFAULT_HOME_DIRNAME={home_dirname}");
  println!("cargo:rustc-env=FREEANIMA_PRODUCT_NAME={product_name}");
  println!("cargo:rerun-if-env-changed=FREEANIMA_BUILD_CHANNEL");
  tauri_build::build()
}
