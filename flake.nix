{
  description = "FreeAnima 开发环境（direnv / nix develop）";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
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
          pkgs = nixpkgs.legacyPackages.${system};
          inherit (pkgs) lib stdenv;

          # bun / rustup 不纳入：nixpkgs bun 常落后于 engines（>=1.3.14）；
          # rustup 保留用户 toolchain，便于 rustup target add。
          cliTools = with pkgs; [
            just
            fzf
            direnv
            nix-direnv
            git
            ripgrep
            jq
          ];

          windowsCrossTools = with pkgs; [
            cargo-xwin
            nsis
            clang
            lld
            llvm # 含 llvm-lib（cc-rs / ring 编 MSVC 目标需要）
            pkg-config
          ]
          # tauri-cli 交叉打包也会探测 appindicator
          ++ lib.optionals stdenv.hostPlatform.isLinux [ pkgs.libayatana-appindicator ];

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

          mkHook =
            extra: ''
              echo "[freeanima flake] just=$(command -v just)  makensis=$(command -v makensis || echo missing)  cargo-xwin=$(command -v cargo-xwin || echo missing)${extra}"
              if ! command -v bun >/dev/null 2>&1; then
                echo "[freeanima flake] 未检测到 bun：请安装 >=1.3.14（https://bun.sh）后再 just dev"
              fi
              if ! command -v rustup >/dev/null 2>&1; then
                echo "[freeanima flake] 未检测到 rustup：交叉 Windows 请先安装 Rust，再 rustup target add x86_64-pc-windows-msvc"
              elif ! rustup target list --installed 2>/dev/null | grep -qx 'x86_64-pc-windows-msvc'; then
                echo "[freeanima flake] 可选：rustup target add x86_64-pc-windows-msvc   # just pack tauri-windows"
              fi
            '';
        in
        {
          default = pkgs.mkShell {
            packages = cliTools ++ windowsCrossTools;
            shellHook = mkHook "";
          };

          tauri = pkgs.mkShell {
            packages = cliTools ++ windowsCrossTools ++ linuxTauriLibs;
            shellHook = mkHook "  (tauri libs)";
          };
        }
      );
    };
}
