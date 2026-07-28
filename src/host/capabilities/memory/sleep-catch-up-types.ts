export type SleepCatchUpPlan = {
  start: string;
  end: string;
  light_days: string[];
  temporal_days: string[];
  cascade_days: string[];
  /** Ordered unique days that need at least one step */
  days: string[];
};
