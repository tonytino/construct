// One-time provisioning. Safe to re-run: anything whose ID is already in
// standup.config.json is skipped, so a partial failure resumes where it left off.
//
//   pnpm setup
//
// Creates, in order: environment -> vault + SLACK_BOT_TOKEN credential ->
// memory store -> agent -> three scheduled deployments (post / remind / final).

import fs from "node:fs";
import path from "node:path";
import {
  client,
  loadConfig,
  saveConfig,
  requireEnv,
  DEPLOYMENTS,
  ROOT,
  TZ,
  createDeployment,
  type DeploymentKey,
} from "./lib.js";

const SLACK_HOSTS = ["slack.com"];

async function main() {
  requireEnv("ANTHROPIC_API_KEY");
  const slackToken = requireEnv("SLACK_BOT_TOKEN");
  const channelId = requireEnv("SLACK_CHANNEL_ID");
  const ownerId = requireEnv("STANDUP_OWNER_SLACK_ID");

  const config = loadConfig();

  // 1. Environment — locked-down cloud sandbox, egress to Slack only.
  if (!config.environment_id) {
    const environment = await client.beta.environments.create({
      name: `standup-bot-${Date.now()}`, // environment names must be unique org-wide
      description: "Slack standup bot sandbox (egress limited to slack.com)",
      config: {
        type: "cloud",
        networking: { type: "limited", allowed_hosts: SLACK_HOSTS },
      },
    });
    config.environment_id = environment.id;
    saveConfig(config);
    console.log(`environment  ${environment.id}`);
  } else {
    console.log(`environment  ${config.environment_id} (existing)`);
  }

  // 2. Vault + the Slack bot token as an environment_variable credential.
  //    The sandbox only ever sees a placeholder; the real token is substituted
  //    at egress, and only for requests to SLACK_HOSTS.
  if (!config.vault_id) {
    const vault = await client.beta.vaults.create({
      display_name: "standup-bot-secrets",
    });
    config.vault_id = vault.id;
    saveConfig(config);
    console.log(`vault        ${vault.id}`);
  } else {
    console.log(`vault        ${config.vault_id} (existing)`);
  }

  if (!config.credential_id) {
    const credential = await client.beta.vaults.credentials.create(config.vault_id, {
      display_name: "Slack bot token (standup bot)",
      auth: {
        type: "environment_variable",
        secret_name: "SLACK_BOT_TOKEN",
        secret_value: slackToken,
        networking: { type: "limited", allowed_hosts: SLACK_HOSTS },
      },
    });
    config.credential_id = credential.id;
    saveConfig(config);
    console.log(`credential   ${credential.id}`);
  } else {
    console.log(`credential   ${config.credential_id} (existing)`);
  }

  // 3. Memory store — persistent state shared by the three daily sessions.
  if (!config.memory_store_id) {
    const store = await client.beta.memoryStores.create({
      name: "standup-state",
      description:
        "Daily standup state. One file per day at /standups/YYYY-MM-DD.json with the " +
        "channel, thread_ts, roster, responders, and already-flagged blocker message timestamps.",
    });
    config.memory_store_id = store.id;
    saveConfig(config);
    console.log(`memory store ${store.id}`);
  } else {
    console.log(`memory store ${config.memory_store_id} (existing)`);
  }

  // 4. Agent — system prompt from prompts/system.md with config interpolated.
  //    Created once; re-running setup after editing the prompt UPDATES the
  //    agent (new immutable version) instead of creating a duplicate.
  const system = fs
    .readFileSync(path.join(ROOT, "prompts", "system.md"), "utf8")
    .replaceAll("{{SLACK_CHANNEL_ID}}", channelId)
    .replaceAll("{{STANDUP_OWNER_SLACK_ID}}", ownerId)
    .replaceAll("{{STANDUP_TZ}}", TZ);

  const agentBody = {
    name: "Standup Bot",
    model: "claude-opus-4-8",
    description: "Posts daily standups to Slack, nudges non-responders, escalates blockers.",
    system,
    tools: [{ type: "agent_toolset_20260401" as const, default_config: { enabled: true } }],
  };

  if (!config.agent_id) {
    const agent = await client.beta.agents.create(agentBody);
    config.agent_id = agent.id;
    config.agent_version = agent.version;
    saveConfig(config);
    console.log(`agent        ${agent.id} (v${agent.version})`);
  } else {
    const current = await client.beta.agents.retrieve(config.agent_id);
    const updated = await client.beta.agents.update(config.agent_id, {
      ...agentBody,
      version: current.version,
    });
    config.agent_version = updated.version;
    saveConfig(config);
    console.log(`agent        ${config.agent_id} (updated to v${updated.version})`);
  }

  // 5. Three scheduled deployments sharing the one agent. Each firing creates
  //    a fresh session with the vault + memory store attached.
  config.deployments ??= {};
  for (const [key, def] of Object.entries(DEPLOYMENTS) as [DeploymentKey, (typeof DEPLOYMENTS)["post"]][]) {
    if (config.deployments[key]) {
      console.log(`deployment   ${def.name} ${config.deployments[key]} (existing)`);
      continue;
    }
    const deployment = await createDeployment({
      name: def.name,
      agent: config.agent_id,
      environment_id: config.environment_id,
      vault_ids: [config.vault_id],
      resources: [
        {
          type: "memory_store",
          memory_store_id: config.memory_store_id,
          access: "read_write",
          instructions:
            "Standup state lives here. Read/write /standups/<YYYY-MM-DD>.json as described in your instructions.",
        },
      ],
      initial_events: [{ type: "user.message", content: [{ type: "text", text: def.kickoff }] }],
      schedule: { type: "cron", expression: def.cron, timezone: TZ },
    });
    config.deployments[key] = deployment.id;
    saveConfig(config);
    const upcoming: string[] = deployment.schedule?.upcoming_runs_at ?? [];
    console.log(`deployment   ${def.name} ${deployment.id}`);
    console.log(`             cron "${def.cron}" ${TZ} — next: ${upcoming.slice(0, 2).join(", ") || "(unknown)"}`);
  }

  console.log("\nDone. Smoke-test against a quiet channel with:");
  console.log("  pnpm run-now post     # then reply in the thread, including one blocker-flavored reply");
  console.log("  pnpm run-now remind   # verify the nudge skips responders and the blocker DM arrives");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
