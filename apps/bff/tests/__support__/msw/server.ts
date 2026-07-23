import { setupServer } from "msw/node";
import { coreServiceHandlers } from "./handlers/core-service";
import { aiServiceHandlers } from "./handlers/ai-service";

export const server = setupServer(
  ...coreServiceHandlers,
  ...aiServiceHandlers,
);
