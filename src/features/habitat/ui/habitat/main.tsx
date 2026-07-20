import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { blockNativeDialogs, ConfirmPromptHost } from "@freeanima/frontend/ui-kit/composite";
import { initHabitatLocale } from "./lib/i18n.ts";
import { getRouter } from "./router.tsx";

initHabitatLocale();
blockNativeDialogs();
const router = getRouter();

const rootEl = document.getElementById("root");
if (rootEl === null) throw new Error("root element not found");
createRoot(rootEl).render(
  <StrictMode>
    <ConfirmPromptHost />
    <RouterProvider router={router} />
  </StrictMode>,
);
