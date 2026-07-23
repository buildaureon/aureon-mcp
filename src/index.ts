import { startServer } from "./server.js";

export { startServer } from "./server.js";

startServer().catch((err: unknown) => {
  process.stderr.write(`aureon-mcp fatal: ${err}\n`);
  process.exit(1);
});
