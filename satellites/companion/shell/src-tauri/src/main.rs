#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    companion_shell_lib::bootstrap::init();
    if let Err(err) = companion_shell_lib::bootstrap::preflight() {
        companion_shell_lib::bootstrap::show_native_error("FreeAnima Companion", &err);
        return;
    }
    companion_shell_lib::run();
}
