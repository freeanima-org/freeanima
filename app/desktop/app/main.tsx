// oxlint-disable-next-line import/no-unassigned-import -- 须在 createDesktopSettingsStores 前注入 bridge（浏览器开发回退）
import "./shell-bridge.ts";

import { mountShellUi } from "@freeanima/shell-ui/mount";

// oxlint-disable-next-line import/no-unassigned-import -- Vite side-effect stylesheet
import "../../../packages/shell-ui/app/src/styles.css";

import { createDesktopSettingsApis } from "./companion-settings-api.ts";
import { createDesktopSettingsBindings } from "./settings-registry.ts";
import { createDesktopSettingsStores } from "../src/settings-stores.ts";

const stores = createDesktopSettingsStores();
const apis = createDesktopSettingsApis();
const bindings = createDesktopSettingsBindings(stores, apis);

void mountShellUi({ bindings });
