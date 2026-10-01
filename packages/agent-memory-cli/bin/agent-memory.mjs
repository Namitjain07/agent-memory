#!/usr/bin/env node
import { run } from "../dist/index.js";

run(process.argv.slice(2))
  .then((r) => process.exit(r.exitCode))
  .catch((err) => {
    console.error("[agent-memory]", err);
    process.exit(1);
  });
