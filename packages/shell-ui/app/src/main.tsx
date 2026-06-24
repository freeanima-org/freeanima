import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ShellRouterProvider } from "./router.tsx";

document.documentElement.dataset.shellUi = "1";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ShellRouterProvider />
  </StrictMode>,
);
