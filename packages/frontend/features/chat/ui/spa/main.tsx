import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ChatApp } from "./ChatApp.tsx";

const rootEl = document.getElementById("root");
if (rootEl === null) throw new Error("root element not found");
createRoot(rootEl).render(
  <StrictMode>
    <ChatApp />
  </StrictMode>,
);
