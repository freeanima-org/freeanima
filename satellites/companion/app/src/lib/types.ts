export const COMPANION_PLATFORM = "companion";

export type CompanionConfig = {
  app_id: string;
  instance_id: string;
  hub_url: string;
  model_path: string;
  model_available?: boolean;
};
