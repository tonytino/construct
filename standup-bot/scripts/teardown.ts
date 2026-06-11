// Pause, resume, or permanently archive the three deployments.
//
//   pnpm teardown pause      # stop scheduled firings (reversible; manual runs still work)
//   pnpm teardown unpause    # resume from the next occurrence (no backfill)
//   pnpm teardown archive --yes   # PERMANENT — schedule stops, deployments become immutable

import {
  loadConfig,
  pauseDeployment,
  unpauseDeployment,
  archiveDeployment,
  DEPLOYMENTS,
  type DeploymentKey,
} from "./lib.js";

async function main() {
  const action = process.argv[2];
  const config = loadConfig();
  if (!config.deployments) {
    console.error("No deployments in standup.config.json — run `pnpm setup` first.");
    process.exit(1);
  }

  if (action !== "pause" && action !== "unpause" && action !== "archive") {
    console.error("Usage: pnpm teardown <pause | unpause | archive --yes>");
    process.exit(1);
  }
  if (action === "archive" && !process.argv.includes("--yes")) {
    console.error("Archiving is permanent (no unarchive). Re-run with --yes to confirm.");
    process.exit(1);
  }

  for (const [key, def] of Object.entries(DEPLOYMENTS) as [DeploymentKey, (typeof DEPLOYMENTS)["post"]][]) {
    const deploymentId = config.deployments[key];
    if (!deploymentId) continue;
    if (action === "pause") await pauseDeployment(deploymentId);
    else if (action === "unpause") await unpauseDeployment(deploymentId);
    else await archiveDeployment(deploymentId);
    console.log(`${action}d ${def.name} (${deploymentId})`);
  }

  if (action === "archive") {
    console.log("\nDeployments archived. The agent, environment, vault, and memory store were left");
    console.log("in place (archiving those is also permanent) — remove them from the Console if desired.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
