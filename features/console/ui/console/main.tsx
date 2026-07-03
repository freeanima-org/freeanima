import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { initConsoleLocale } from "./lib/i18n.ts";
import { getRouter } from "./router.tsx";

initConsoleLocale();
const router = getRouter();

const rootEl = document.getElementById("root");
if (rootEl === null) throw new Error("root element not found");
createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
