import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/chamber/conversations")({
  component: () => <Outlet />,
});
