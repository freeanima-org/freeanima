use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Once;

static INIT: Once = Once::new();

pub fn init() {
    INIT.call_once(|| {
        log_line("companion main enter");
        install_panic_hook();
    });
}

pub fn log_path() -> Option<PathBuf> {
    let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME"))?;
    Some(PathBuf::from(home).join(".anima").join("companion").join("shell.log"))
}

pub fn log_line(msg: &str) {
    eprintln!("{msg}");
    if let Some(path) = log_path() {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
            let _ = writeln!(file, "{msg}");
        }
    }
}

pub fn install_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("程序异常退出：{info}");
        log_line(&msg);
        show_native_error("FreeAnima Companion", &msg);
    }));
}

fn exe_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(Path::to_path_buf))
}

fn missing_file_message(dir: &Path, name: &str) -> String {
    format!(
        "缺少运行文件：{name}\n\n安装目录：{}\n目录内容：{}\n\n请重新运行安装包，或从 release 目录完整拷贝所有文件。",
        dir.display(),
        list_dir_names(dir)
    )
}

fn list_dir_names(dir: &Path) -> String {
    match std::fs::read_dir(dir) {
        Ok(entries) => entries
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect::<Vec<_>>()
            .join(", "),
        Err(_) => "(无法读取)".to_string(),
    }
}

#[cfg(windows)]
const WEBVIEW2_GUID: &str = "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";

#[cfg(windows)]
fn webview2_runtime_version() -> Option<String> {
    use winreg::enums::*;
    use winreg::RegKey;

    let paths = [
        (
            HKEY_CURRENT_USER,
            format!(r"Software\Microsoft\EdgeUpdate\Clients\{WEBVIEW2_GUID}"),
        ),
        (
            HKEY_LOCAL_MACHINE,
            format!(r"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{WEBVIEW2_GUID}"),
        ),
        (
            HKEY_LOCAL_MACHINE,
            format!(r"SOFTWARE\Microsoft\EdgeUpdate\Clients\{WEBVIEW2_GUID}"),
        ),
    ];

    for (hive, path) in paths {
        let root = RegKey::predef(hive);
        if let Ok(key) = root.open_subkey(path) {
            if let Ok(pv) = key.get_value::<String, _>("pv") {
                if !pv.is_empty() {
                    return Some(pv);
                }
            }
        }
    }
    None
}

#[cfg(windows)]
fn webview2_missing_message() -> String {
    "未检测到 WebView2 运行时。\n\n\
     说明：安装目录里的 WebView2Loader.dll 只是加载器，本机还必须安装 WebView2 运行时。\n\
     请下载并安装 Evergreen Standalone Installer：\n\
     https://go.microsoft.com/fwlink/p/?LinkId=2124703\n\n\
     安装完成后重新启动 FreeAnima Companion。"
        .to_string()
}

#[cfg(windows)]
pub fn preflight() -> Result<(), String> {
    let dir = exe_dir().ok_or("无法定位程序目录")?;
    log_line(&format!("exe dir: {}", dir.display()));

    let loader = dir.join("WebView2Loader.dll");
    if !loader.is_file() {
        return Err(missing_file_message(&dir, "WebView2Loader.dll"));
    }

    let sidecar_plain = dir.join("companion-sidecar.exe");
    let sidecar_triple = dir.join("companion-sidecar-x86_64-pc-windows-gnu.exe");
    if !sidecar_plain.is_file() && !sidecar_triple.is_file() {
        return Err(missing_file_message(
            &dir,
            "companion-sidecar.exe（后台服务）",
        ));
    }

    match webview2_runtime_version() {
        Some(version) => log_line(&format!("WebView2 runtime detected: {version}")),
        None => return Err(webview2_missing_message()),
    }

    Ok(())
}

#[cfg(not(windows))]
pub fn preflight() -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
pub fn show_native_error(title: &str, message: &str) {
    use std::ffi::OsStr;
    use std::iter::once;
    use std::os::windows::ffi::OsStrExt;

    fn wide(value: &str) -> Vec<u16> {
        OsStr::new(value).encode_wide().chain(once(0)).collect()
    }

    #[link(name = "user32")]
    extern "system" {
        fn MessageBoxW(
            hwnd: *mut std::ffi::c_void,
            text: *const u16,
            caption: *const u16,
            utype: u32,
        ) -> i32;
    }

    const MB_OK: u32 = 0x0000_0000;
    const MB_ICONERROR: u32 = 0x0000_0010;

    let text = wide(message);
    let caption = wide(title);
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            text.as_ptr(),
            caption.as_ptr(),
            MB_OK | MB_ICONERROR,
        );
    }
}

#[cfg(not(windows))]
pub fn show_native_error(title: &str, message: &str) {
    log_line(&format!("{title}: {message}"));
}

pub fn fatal_startup(message: &str) -> ! {
    log_line(message);
    show_native_error("FreeAnima Companion", message);
    std::process::exit(1);
}
