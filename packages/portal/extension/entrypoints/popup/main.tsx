import { createRoot } from "react-dom/client";
import { ConfirmPromptHost } from "@freeanima/ui-kit/composite";
import { VaultPopupApp } from "../../ui/popup/VaultPopupApp.tsx";
import "../../ui/styles.css";

document.documentElement.classList.add("ext-popup");
document.body.classList.add("ext-popup");
// 再次钉死尺寸（防 CSS 加载顺序 / Tailwind preflight 干扰）
Object.assign(document.body.style, {
  width: "380px",
  minWidth: "380px",
  maxWidth: "380px",
  height: "520px",
  margin: "0",
  overflow: "hidden",
});

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

createRoot(root).render(
  <>
    <ConfirmPromptHost />
    <VaultPopupApp />
  </>,
);
