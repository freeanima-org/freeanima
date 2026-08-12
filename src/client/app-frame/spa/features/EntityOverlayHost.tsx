import { useEffect, useState, type JSX } from "react";
import { DialogHeader, DialogTitle } from "@freeanima/ui-kit";
import { ModalSheetPresent } from "@freeanima/ui-kit/composite";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

import { getEntityOverlay } from "./entity-overlay-registry.ts";
import { GenericEntityOverlay } from "./GenericEntityOverlay.tsx";
import {
  bindOpenEntityResourceToWindow,
  setAnimaUriPrimaryComponentResolver,
  setEntityOverlayOpener,
  type EntityOverlayOpenRequest,
} from "./open-entity-resource.ts";

async function resolvePrimaryComponent(id: number): Promise<string | null> {
  try {
    const data = await getTypedHabitatClient().call("entity.get", { id });
    const component = data.item.primary_component;
    return typeof component === "string" && component.trim() ? component.trim() : null;
  } catch {
    return null;
  }
}

export function EntityOverlayHost(): JSX.Element | null {
  const [req, setReq] = useState<EntityOverlayOpenRequest | null>(null);

  useEffect(() => {
    setEntityOverlayOpener((next) => setReq(next));
    bindOpenEntityResourceToWindow();
    setAnimaUriPrimaryComponentResolver(resolvePrimaryComponent);
    return () => {
      setEntityOverlayOpener(null);
      setAnimaUriPrimaryComponentResolver(null);
    };
  }, []);

  if (req == null) return null;

  const Overlay = getEntityOverlay(req.component) ?? GenericEntityOverlay;

  return (
    <ModalSheetPresent
      open
      onClose={() => setReq(null)}
      aria-label="实体详情"
      showCloseButton
      className="flex min-h-[min(40vh,20rem)] flex-col md:max-w-lg"
    >
      <DialogHeader className="sr-only">
        <DialogTitle>实体详情</DialogTitle>
      </DialogHeader>
      <Overlay id={req.id} component={req.component} onClose={() => setReq(null)} />
    </ModalSheetPresent>
  );
}
