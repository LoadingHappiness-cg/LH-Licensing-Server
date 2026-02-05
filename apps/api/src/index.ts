import "dotenv/config";
import { buildServer } from "./server.js";
import { config } from "./config.js";

const server = await buildServer();

server.listen({ port: config.PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    server.log.error(err, "Failed to start");
    process.exit(1);
  }
  server.log.info(`API listening on ${address}`);
});
