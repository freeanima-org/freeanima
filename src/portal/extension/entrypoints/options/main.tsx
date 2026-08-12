import { createRoot } from "react-dom/client";
import { VaultOptionsApp } from "../../ui/options/VaultOptionsApp.tsx";
import "../../ui/styles.css";

document.body.classList.add("ext-options");

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

createRoot(root).render(<VaultOptionsApp />);
