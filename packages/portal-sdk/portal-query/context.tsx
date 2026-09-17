import { createContext, useContext, type ReactNode } from "react";

import { getDefaultPortalQueryClient, PortalQueryClient } from "./client.ts";

const PortalQueryContext = createContext<PortalQueryClient | null>(null);

export function PortalQueryProvider({
  client,
  children,
}: {
  client?: PortalQueryClient;
  children: ReactNode;
}) {
  const value = client ?? getDefaultPortalQueryClient();
  return <PortalQueryContext.Provider value={value}>{children}</PortalQueryContext.Provider>;
}

export function usePortalQueryClient(): PortalQueryClient {
  const ctx = useContext(PortalQueryContext);
  return ctx ?? getDefaultPortalQueryClient();
}
