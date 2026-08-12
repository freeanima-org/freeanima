import { createRoot } from "react-dom/client";
import { ConfirmPromptHost } from "@freeanima/ui-kit/composite";
import { VaultPopupApp } from "../../ui/popup/VaultPopupApp.tsx";
import "../../ui/styles.css";

document.documentElement.classList.add("ext-popup");
document.body.classList.add("ext-popup");

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

createRoot(root).render(
  <>
    <ConfirmPromptHost />
    <VaultPopupApp />
  </>,
);
