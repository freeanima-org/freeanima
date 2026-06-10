export type FridgeMagnet = {
  /** Display label (usually Redis key without `fridge:` prefix) */
  key: string;
  value: string;
};

export type FridgeMagnetScanHit = {
  /** Full Redis key, e.g. fridge:session:abc:r1a2 */
  key: string;
  value: string;
};
