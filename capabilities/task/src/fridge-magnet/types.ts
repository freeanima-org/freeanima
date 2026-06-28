export type FridgeMagnet = {
  /** Display label (usually Redis key without `fridge-magnet:` prefix) */
  key: string;
  value: string;
};

export type FridgeMagnetScanHit = {
  /** Full Redis key, e.g. fridge-magnet:session:abc:r1a2 */
  key: string;
  value: string;
};
