import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function readTheme(): Theme {
  if (typeof document === "undefined") return "system";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useTheme(): "light" | "dark" | "system" {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
