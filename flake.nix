{
  description = "FreeAnima 开发环境（direnv / nix develop）";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { nixpkgs, rust-overlay, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      formatter = forAllSystems (system: nixpkgs.legacyPackages.${system}.nixfmt-rfc-style);

      # default：日常 CLI + Windows 交叉
      # tauri：额外带上本机 Linux Tauri / AppImage 的 GTK·WebKit 库（体积更大）
      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs {
            inherit system;
            overlays = [ rust-overlay.overlays.default ];
          };
          inherit (pkgs) lib stdenv;

          # cargo/rustc 必须来自 overlay：nixpkgs rustup 只是代理，会 exec ~/.rustup
          # 里可能已被 patchelf 到过期 glibc 的二进制（ENOENT）。
          rustToolchain = pkgs.rust-bin.stable.latest.default.override {
            extensions = [
              "rust-src"
              "clippy"
              "rustfmt"
            ];
            targets = [ "x86_64-pc-windows-msvc" ];
          };

          # bun 不纳入：nixpkgs bun 常落后于 engines（>=1.4.0）。
          # rustToolchain 须排在 rustup 之前，避免 rustup 的 cargo 代理抢 PATH。
          cliTools = with pkgs; [
            just
            fzf
            direnv
            nix-direnv
            git
            ripgrep
            jq
            rustToolchain
            rustup
          ];

          windowsCrossTools =
            with pkgs;
            [
              cargo-xwin
              nsis
              clang
              lld
              llvm # 含 llvm-lib（cc-rs / ring 编 MSVC 目标需要）
              pkg-config
            ]
            # tauri-cli 交叉打包会探测 appindicator；其 .pc Requires gtk+-3.0
            ++ lib.optionals stdenv.hostPlatform.isLinux [
              libayatana-appindicator
              gtk3
            ];

          # 本机 just pack tauri / just dev tauri（WebKitGTK，体积大）
          linuxTauriLibs = lib.optionals stdenv.hostPlatform.isLinux (
            with pkgs;
            [
              webkitgtk_4_1
              libsoup_3
              librsvg
              gtk3
              openssl
              patchelf
            ]
          );

          mkHook = extra: ''
            export RUSTUP_HOME="''${RUSTUP_HOME:-$HOME/.rustup}"
            export CARGO_HOME="''${CARGO_HOME:-$HOME/.cargo}"
            # 插件在 CARGO_HOME/bin；追加而非前置，避免 rustup 代理盖住 overlay cargo
            export PATH="$PATH:$CARGO_HOME/bin"
            echo "[freeanima flake] just=$(command -v just)  rustc=$(command -v rustc)  cargo=$(command -v cargo)  rustup=$(command -v rustup)  makensis=$(command -v makensis || echo missing)  cargo-xwin=$(command -v cargo-xwin || echo missing)${extra}"
            if ! command -v bun >/dev/null 2>&1; then
              echo "[freeanima flake] 未检测到 bun：请安装 >=1.4.0（https://bun.sh）后再 just dev"
            fi
            if ! rustc --print sysroot >/dev/null 2>&1; then
              echo "[freeanima flake] rustc 不可用"
            elif [ ! -d "$(rustc --print sysroot)/lib/rustlib/x86_64-pc-windows-msvc" ]; then
              echo "[freeanima flake] 可选：rustup target add x86_64-pc-windows-msvc   # just pack tauri-windows"
            fi
          '';
        in
        {
          default = pkgs.mkShell {
            packages = cliTools ++ windowsCrossTools;
            RUST_BACKTRACE = "1";
            shellHook = mkHook "";
          };

          tauri = pkgs.mkShell {
            packages = cliTools ++ windowsCrossTools ++ linuxTauriLibs;
            RUST_BACKTRACE = "1";
            shellHook = mkHook "  (tauri libs)";
          };
        }
      );
    };
}
