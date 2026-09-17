import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/workshop/$path")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
