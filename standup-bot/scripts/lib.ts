import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(ROOT, "standup.config.json");

// Load .env if present (Node >= 22.6). Real env vars take precedence.
try {
  process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  // no .env file — rely on the ambient environment
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable ${name} — copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

export const client = new Anthropic();

// ---------------------------------------------------------------------------
// Provisioned-resource IDs, persisted so setup is idempotent and the other
// scripts can find the deployments. IDs are not secrets; commit this file.
// ---------------------------------------------------------------------------

export type DeploymentKey = "post" | "remind" | "final";

export interface StandupConfig {
  environment_id?: string;
  vault_id?: string;
  credential_id?: string;
  memory_store_id?: string;
  agent_id?: string;
  agent_version?: number;
  deployments?: Partial<Record<DeploymentKey, string>>;
}

export function loadConfig(): StandupConfig {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as StandupConfig;
}

export function saveConfig(config: StandupConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// Schedule + kickoff definitions for the three deployments.
// ---------------------------------------------------------------------------

export const TZ = process.env.STANDUP_TZ ?? "America/Los_Angeles";

export const DEPLOYMENTS: Record<DeploymentKey, { name: string; cron: string; kickoff: string }> = {
  post: {
    name: "standup-post",
    cron: process.env.STANDUP_CRON_POST ?? "0 9 * * 1-5",
    kickoff: "MODE: post — Post today's standup message and initialize today's state file.",
  },
  remind: {
    name: "standup-reminder-90m",
    cron: process.env.STANDUP_CRON_REMIND ?? "30 10 * * 1-5",
    kickoff:
      "MODE: remind — This is the 90-minute checkpoint. Check thread responses, nudge non-responders in the thread, and flag any new blockers.",
  },
  final: {
    name: "standup-final-3h",
    cron: process.env.STANDUP_CRON_FINAL ?? "0 12 * * 1-5",
    kickoff:
      "MODE: final — This is the 3-hour final checkpoint. Do the final reminder pass and send the owner the end-of-window digest.",
  },
};

export function resolveDeploymentKey(arg: string | undefined): DeploymentKey {
  if (arg === "post" || arg === "remind" || arg === "final") return arg;
  const byName = (Object.entries(DEPLOYMENTS) as [DeploymentKey, { name: string }][]).find(
    ([, d]) => d.name === arg,
  );
  if (byName) return byName[0];
  console.error(`Usage: pass one of: post | remind | final (got ${JSON.stringify(arg)})`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Deployments API access. The deployments surface is newer than the rest of
// Managed Agents — if the installed SDK doesn't expose client.beta.deployments
// yet, fall back to raw HTTP with the managed-agents beta header.
// ---------------------------------------------------------------------------

const BETA_HEADER = "managed-agents-2026-04-01";
const BASE_URL = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";

async function rawBeta(method: "GET" | "POST", endpoint: string, body?: unknown): Promise<any> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      "x-api-key": requireEnv("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
      "anthropic-beta": BETA_HEADER,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: any = await response.json();
  if (!response.ok) {
    throw new Error(`${method} ${endpoint} failed (${response.status}): ${JSON.stringify(json.error ?? json)}`);
  }
  return json;
}

function sdkDeployments(): any | undefined {
  const beta = client.beta as any;
  return beta.deployments?.create ? beta.deployments : undefined;
}

export async function createDeployment(body: Record<string, unknown>): Promise<any> {
  const sdk = sdkDeployments();
  if (sdk) return sdk.create(body);
  return rawBeta("POST", "/v1/deployments", body);
}

export async function runDeployment(deploymentId: string): Promise<any> {
  const sdk = sdkDeployments();
  if (sdk?.run) return sdk.run(deploymentId);
  return rawBeta("POST", `/v1/deployments/${deploymentId}/run`);
}

export async function pauseDeployment(deploymentId: string): Promise<any> {
  const sdk = sdkDeployments();
  if (sdk?.pause) return sdk.pause(deploymentId);
  return rawBeta("POST", `/v1/deployments/${deploymentId}/pause`);
}

export async function unpauseDeployment(deploymentId: string): Promise<any> {
  const sdk = sdkDeployments();
  if (sdk?.unpause) return sdk.unpause(deploymentId);
  return rawBeta("POST", `/v1/deployments/${deploymentId}/unpause`);
}

export async function archiveDeployment(deploymentId: string): Promise<any> {
  const sdk = sdkDeployments();
  if (sdk?.archive) return sdk.archive(deploymentId);
  return rawBeta("POST", `/v1/deployments/${deploymentId}/archive`);
}

export async function listDeploymentRuns(deploymentId: string): Promise<any[]> {
  const beta = client.beta as any;
  if (beta.deploymentRuns?.list) {
    const runs: any[] = [];
    for await (const run of beta.deploymentRuns.list({ deployment_id: deploymentId })) {
      runs.push(run);
    }
    return runs;
  }
  const json = await rawBeta("GET", `/v1/deployment_runs?deployment_id=${encodeURIComponent(deploymentId)}`);
  return json.data ?? [];
}

export function consoleSessionUrl(sessionId: string): string {
  return `https://platform.claude.com/workspaces/default/sessions/${sessionId}`;
}
