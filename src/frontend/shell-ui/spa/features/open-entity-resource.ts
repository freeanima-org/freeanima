import type { AnimaPresent, AnimaUriRef } from "@freeanima/frontend/shell-sdk/anima-uri.ts";
import {
  defaultPresentForComponent,
  navigateAnimaUri,
  parseAnimaUri,
} from "@freeanima/frontend/shell-sdk/anima-uri.ts";

import { getEntityOverlay } from "./entity-overlay-registry.ts";

export type EntityOverlayOpenRequest = {
  id: number;
  component: string;
  present: AnimaPresent;
};

type OverlayOpener = (req: EntityOverlayOpenRequest) => void;

let overlayOpener: OverlayOpener | null = null;

/** Resolve primary_component when URI omits component (optional). */
type PrimaryComponentResolver = (id: number) => Promise<string | null>;

let primaryResolver: PrimaryComponentResolver | null = null;

export function setEntityOverlayOpener(opener: OverlayOpener | null): void {
  overlayOpener = opener;
}

export function setAnimaUriPrimaryComponentResolver(
  resolver: PrimaryComponentResolver | null,
): void {
  primaryResolver = resolver;
}

export type OpenEntityResourceResult =
  | { ok: true; mode: "overlay" | "navigate" }
  | { ok: false; error: string };

async function resolveComponent(ref: AnimaUriRef): Promise<string | null> {
  if (ref.component) return ref.component;
  if (!primaryResolver) return null;
  return primaryResolver(ref.id);
}

/**
 * Open an Anima URI or ref: overlay via registry Host, or navigate Shell path.
 */
export async function openEntityResource(
  input: string | AnimaUriRef,
): Promise<OpenEntityResourceResult> {
  const parsed =
    typeof input === "string" ? parseAnimaUri(input) : ({ ok: true as const, ref: input } as const);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const component = await resolveComponent(parsed.ref);
  if (!component) {
    return { ok: false, error: "component required (or register primary_component resolver)" };
  }

  const present = parsed.ref.present ?? defaultPresentForComponent(component);
  const ref: AnimaUriRef = { ...parsed.ref, component, present };

  if (present === "overlay") {
    if (!getEntityOverlay(component)) {
      return { ok: false, error: `no overlay registered for component: ${component}` };
    }
    if (!overlayOpener) {
      return { ok: false, error: "EntityOverlayHost not mounted" };
    }
    overlayOpener({ id: ref.id, component, present });
    return { ok: true, mode: "overlay" };
  }

  if (!navigateAnimaUri(ref)) {
    return { ok: false, error: `no shell path for component: ${component}` };
  }
  return { ok: true, mode: "navigate" };
}

/** Expose for console / tests. */
export function bindOpenEntityResourceToWindow(): void {
  (window as Window & { openEntityResource?: typeof openEntityResource }).openEntityResource =
    openEntityResource;
}
