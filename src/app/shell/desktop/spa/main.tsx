// oxlint-disable-next-line import/no-unassigned-import -- 须在 createDesktopSettingsStores 前注入 bridge（浏览器开发回退）
import "./shell-bridge.ts";

import { mountShellUi } from "@freeanima/frontend/shell-ui/spa/mount.tsx";

// oxlint-disable-next-line import/no-unassigned-import -- Vite side-effect stylesheet
import "@freeanima/frontend/shell-ui/spa/styles.css";

import { createDesktopSettingsApis } from "./companion-settings-api.ts";
import { createDesktopSettingsBindings } from "./settings-registry.ts";
import { createDesktopSettingsStores } from "../lib/settings-stores.ts";

const stores = createDesktopSettingsStores();
const apis = createDesktopSettingsApis();
const bindings = createDesktopSettingsBindings(stores, apis);

void mountShellUi({ bindings });
