import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ChatApp } from "./ChatApp.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChatApp />
  </StrictMode>,
);
