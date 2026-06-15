import { connectParlorSap } from "./server/sap/run.ts";

const hub = process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658";
void connectParlorSap(hub);
