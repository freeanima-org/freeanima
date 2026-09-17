type Listener = () => void;

let immersive = false;
const listeners = new Set<Listener>();

export function getCompactImmersive(): boolean {
  return immersive;
}

export function setCompactImmersive(next: boolean): void {
  if (immersive === next) return;
  immersive = next;
  for (const listener of listeners) listener();
}

export function subscribeCompactImmersive(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetCompactImmersiveForTest(): void {
  immersive = false;
  for (const listener of listeners) listener();
}
