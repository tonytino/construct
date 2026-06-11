// Manually trigger one of the scheduled deployments and tail the session live.
// Works even while a deployment is paused — this is the smoke-test path.
//
//   pnpm run-now post | remind | final

import {
  client,
  loadConfig,
  resolveDeploymentKey,
  runDeployment,
  listDeploymentRuns,
  consoleSessionUrl,
  DEPLOYMENTS,
} from "./lib.js";

async function resolveSessionId(deploymentId: string, run: any): Promise<string> {
  if (run?.session_id) return run.session_id;
  // The run record may need a moment to carry the session id — poll briefly.
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const runs = await listDeploymentRuns(deploymentId);
    const latest = run?.id ? runs.find((r) => r.id === run.id) : runs[0];
    if (latest?.session_id) return latest.session_id;
    if (latest?.error) {
      throw new Error(`Deployment run failed: ${latest.error.type} — ${latest.error.message}`);
    }
  }
  throw new Error("Timed out waiting for the deployment run to produce a session.");
}

async function main() {
  const key = resolveDeploymentKey(process.argv[2]);
  const config = loadConfig();
  const deploymentId = config.deployments?.[key];
  if (!deploymentId) {
    console.error(`No deployment id for "${key}" in standup.config.json — run \`pnpm setup\` first.`);
    process.exit(1);
  }

  console.log(`Triggering ${DEPLOYMENTS[key].name} (${deploymentId})...`);
  const run = await runDeployment(deploymentId);
  const sessionId = await resolveSessionId(deploymentId, run);

  console.log(`Session: ${sessionId}`);
  console.log(`Watch in Console: ${consoleSessionUrl(sessionId)}\n`);

  // Tail the session. The stream only delivers events emitted after it opens,
  // so fetch history first and dedupe by event id (lossless-reconnect pattern).
  const seen = new Set<string>();
  const stream = await client.beta.sessions.events.stream(sessionId);

  const handle = (event: any): boolean => {
    if (event.id && seen.has(event.id)) {
      // Already printed via history — but terminal checks below must still run.
    } else {
      if (event.id) seen.add(event.id);
      switch (event.type) {
        case "agent.message":
          for (const block of event.content ?? []) {
            if (block.type === "text") process.stdout.write(block.text);
          }
          process.stdout.write("\n");
          break;
        case "agent.tool_use":
          console.log(`  [tool] ${event.name ?? "tool"}`);
          break;
        case "session.error":
          console.error(`  [error] ${JSON.stringify(event.error ?? event)}`);
          break;
      }
    }
    if (event.type === "session.status_terminated") return true;
    if (event.type === "session.status_idle" && event.stop_reason?.type !== "requires_action") return true;
    return false;
  };

  for await (const event of client.beta.sessions.events.list(sessionId)) {
    if (handle(event)) return;
  }
  for await (const event of stream) {
    if (handle(event as any)) return;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
