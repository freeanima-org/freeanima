import { RouterProvider } from "@tanstack/react-router";
import { useMemo } from "react";
import { getRouter } from "@freeanima/admin-frontend/router";
import { initAdminLocale } from "@freeanima/admin-frontend/i18n";
import "@freeanima/admin-frontend/styles.css";

initAdminLocale();

export function AdminShell() {
  const router = useMemo(() => getRouter({ basepath: "/admin" }), []);
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <RouterProvider router={router} />
    </div>
  );
}
