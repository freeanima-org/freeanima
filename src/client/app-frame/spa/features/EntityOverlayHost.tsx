import { useEffect, useState, type JSX } from "react";
import { Dialog, DialogHeader, DialogTitle } from "@freeanima/ui-kit";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

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
        const raw: unknown = await getTypedHabitatClient().call("memory.semanticList", {
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
      isOpen
      onOpenChange={(open) => {
        if (!open) setReq(null);
      }}
      className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
    >
      <DialogHeader className="sr-only">
        <DialogTitle>实体详情</DialogTitle>
      </DialogHeader>
      <Overlay id={req.id} component={req.component} onClose={() => setReq(null)} />
    </Dialog>
  );
}
