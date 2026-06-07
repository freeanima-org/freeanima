export type FridgeMagnet = {
  key: string;
  value: string;
};

export type FridgeMagnetRedisConfig = {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
};
