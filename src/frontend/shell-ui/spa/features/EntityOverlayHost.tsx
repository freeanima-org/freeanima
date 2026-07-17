import { useEffect, useState, type JSX } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@freeanima/frontend/ui-kit";
import { getTypedSatelliteHubClient } from "@freeanima/platform/hub/client.ts";

import { getEntityOverlay } from "./entity-overlay-registry.ts";
import {
  bindOpenEntityResourceToWindow,
  setAnimaUriPrimaryComponentResolver,
  setEntityOverlayOpener,
  type EntityOverlayOpenRequest,
} from "./open-entity-resource.ts";

export function EntityOverlayHost(): JSX.Element | null {
  const [req, setReq] = useState<EntityOverlayOpenRequest | null>(null);

  useEffect(() => {
    setEntityOverlayOpener((next) => setReq(next));
    bindOpenEntityResourceToWindow();
    setAnimaUriPrimaryComponentResolver(async (id) => {
      try {
        const raw: unknown = await getTypedSatelliteHubClient().call("memory.semanticList", {
          status: "all",
          limit: 100,
          offset: 0,
        });
        const items = (raw as { items?: Array<{ id: number }> }).items ?? [];
        if (items.some((item) => item.id === id)) return "semantic_memory";
      } catch {
        // ignore — caller will require explicit component
      }
      return null;
    });
    return () => {
      setEntityOverlayOpener(null);
      setAnimaUriPrimaryComponentResolver(null);
    };
  }, []);

  if (req == null) return null;

  const Overlay = getEntityOverlay(req.component);
  if (!Overlay) return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) setReq(null);
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>实体详情</DialogTitle>
        </DialogHeader>
        <Overlay id={req.id} component={req.component} onClose={() => setReq(null)} />
      </DialogContent>
    </Dialog>
  );
}
