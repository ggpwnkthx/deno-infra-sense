// src/cli.ts

import { CLI } from "@ggpwnkthx/generic-cli";
import { detect } from "@ggpwnkthx/infra-sense";

async function main() {
  // Instantiate the CLI with name and version.
  const cli = new CLI({ name: "infra-sense", version: "1.0.0" });
  cli.registerCommand(
    ["detect"],
    async (_args, _flags, ctx) => {
      const platform = await detect(ctx);
      ctx.log({ ...platform });
      return;
    },
    {
      description: "Scan the environment.",
    },
  );

  // Run the CLI with Deno.args
  await cli.run(Deno.args);
}

if (import.meta.main) {
  main();
}
