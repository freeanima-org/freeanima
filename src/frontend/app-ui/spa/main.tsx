/** app-ui 本地开发占位入口（无 app composition）；桌面/移动 build 使用各自 app/main.tsx */
import { mountShellUi } from "./mount.tsx";

void mountShellUi({ bindings: [] });
