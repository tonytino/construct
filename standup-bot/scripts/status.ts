// Show recent runs for each deployment (most recent first), with failures called out.
//
//   pnpm status

import { loadConfig, listDeploymentRuns, consoleSessionUrl, DEPLOYMENTS, type DeploymentKey } from "./lib.js";

async function main() {
  const config = loadConfig();
  if (!config.deployments) {
    console.error("No deployments in standup.config.json — run `pnpm setup` first.");
    process.exit(1);
  }

  for (const [key, def] of Object.entries(DEPLOYMENTS) as [DeploymentKey, (typeof DEPLOYMENTS)["post"]][]) {
    const deploymentId = config.deployments[key];
    console.log(`\n${def.name} (${deploymentId ?? "not provisioned"})`);
    if (!deploymentId) continue;

    const runs = await listDeploymentRuns(deploymentId);
    if (runs.length === 0) {
      console.log("  no runs yet");
      continue;
    }
    for (const run of runs.slice(0, 5)) {
      const trigger = run.trigger_context?.type ?? "?";
      if (run.error) {
        console.log(`  ${run.created_at}  [${trigger}]  FAILED: ${run.error.type} — ${run.error.message}`);
      } else {
        console.log(`  ${run.created_at}  [${trigger}]  session ${run.session_id}`);
        console.log(`      ${consoleSessionUrl(run.session_id)}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
