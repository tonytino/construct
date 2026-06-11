# Slack Standup Bot — on Claude Managed Agents

A daily standup coordinator with **no server of your own**. Claude Managed Agents (CMA) hosts everything: a cron fires an agent session, the agent calls the Slack API with `curl` from a sandboxed container, and persistent state lives in a managed memory store.

What it does every weekday (times configurable, defaults Pacific):

| Time  | Deployment            | Behavior |
|-------|-----------------------|----------|
| 09:00 | `standup-post`        | Builds the channel roster, posts the standup prompt, saves the thread + roster to the memory store |
| 10:30 | `standup-reminder-90m`| Reads the thread, records responders, posts **one** thread reply @mentioning non-responders, DMs the owner about any blockers |
| 12:00 | `standup-final-3h`    | Last-call reminder pass, plus an end-of-window digest DM to the owner (response rate, holdouts, blockers with permalinks) |

Blocking issues are detected by the model itself — the system prompt contains a rubric (waiting on a person/approval/access, broken dependency, explicit "blocked"; *not* "busy" or OOO) and a dedup ledger so the same message is never escalated twice.

## Architecture

If you're new to Managed Agents, the mental model is: you define a versioned **agent** (model + system prompt + tools) and a sandbox **environment** once; then **sessions** run in fresh containers where the agent's tools (bash, file ops) execute. Three CMA primitives do all the orchestration here:

```
                 Anthropic-hosted (no infra of yours)
  ┌─────────────────────────────────────────────────────────────┐
  │  3 scheduled deployments (cron, per-run audit records)      │
  │        │ each firing creates a session                      │
  │        ▼                                                    │
  │  Agent loop (claude-opus-4-8, system prompt = bot logic)    │
  │        │ bash/curl in a per-session sandbox                 │
  │        │   egress allowed to slack.com ONLY                 │
  │        ▼                                                    │
  │  ┌──────────────┐   ┌─────────────────────────────────────┐ │
  │  │ Vault        │   │ Memory store (mounted filesystem)   │ │
  │  │ SLACK_BOT_   │   │ /standups/YYYY-MM-DD.json:          │ │
  │  │ TOKEN, subst-│   │   thread_ts, roster, responded[],   │ │
  │  │ ituted at    │   │   flagged_blockers[]                │ │
  │  │ egress       │   │ (how state crosses the 3 sessions)  │ │
  │  └──────────────┘   └─────────────────────────────────────┘ │
  └───────────────┬─────────────────────────────────────────────┘
                  ▼  HTTPS
            Slack Web API
```

- **Scheduled deployments** replace any cron/queue infrastructure. There is no long-lived "sleeping" process — the 90-minute and 3-hour checks are independent short sessions that reconstruct context from the memory store. Every firing (or failure) writes a `deployment_run` audit record you can inspect with `pnpm status`.
- **Memory store** is a persistent filesystem mounted into every session at `/mnt/memory/standup-state/`. The morning session writes the day's state file; later sessions read and update it. This is also what makes blocker-DM dedup work across sessions.
- **Vault credential** (`environment_variable` type) keeps the Slack token out of the sandbox entirely. The agent's shell sees an opaque placeholder in `$SLACK_BOT_TOKEN`; Anthropic substitutes the real token at egress, and only for requests to `slack.com`. Even a prompt-injected standup reply could not exfiltrate the token. Defense in depth: the environment's network policy *also* only allows `slack.com`.
- **Agent logic is the system prompt** (`prompts/system.md`). The three deployments share one agent and differ only in their kickoff message (`MODE: post|remind|final`). Editing the prompt and re-running `pnpm setup` creates a new immutable agent version — old runs stay reproducible.

### Slack API surface

All called via `curl` by the agent (bot token, no Socket Mode, no webhooks):

| Call | Used for |
|------|----------|
| `auth.test` | Discover the bot's own user ID (excluded from the roster) |
| `conversations.members` + `users.info` | Channel roster, minus bots and deleted users |
| `chat.postMessage` | Standup post; thread reminders (`thread_ts` + `<@UID>`); owner DMs |
| `conversations.replies` | Read thread responses (cursor-paginated) |
| `chat.getPermalink` | Link the standup and each flagged blocker message |
| `conversations.open` | Open the owner DM channel for blocker escalations + digest |

## Setup

### 1. Slack app

Create an app at https://api.slack.com/apps (From scratch), add these **Bot Token Scopes** under *OAuth & Permissions*:

```
chat:write  channels:read  channels:history  users:read  im:write
```

(Private standup channel? Add `groups:read` and `groups:history`.) Install to your workspace, copy the **Bot User OAuth Token** (`xoxb-...`), and **invite the bot to the standup channel** (`/invite @YourBot`).

### 2. Anthropic + local config

```sh
cp .env.example .env   # fill in ANTHROPIC_API_KEY, SLACK_BOT_TOKEN, SLACK_CHANNEL_ID, STANDUP_OWNER_SLACK_ID
pnpm install
```

### 3. Provision

```sh
pnpm setup
```

Idempotent — creates environment → vault + credential → memory store → agent → three deployments, persisting IDs to `standup.config.json` (IDs aren't secrets; commit the file). It prints each deployment's next fire times so you can sanity-check the cron. Re-run any time you edit `prompts/system.md` or the cron env vars: the agent is version-bumped in place; nothing is duplicated.

### 4. Smoke test (use a quiet/test channel first)

```sh
pnpm run-now post      # triggers the morning deployment immediately; tails the session
# reply in the thread as yourself — make one reply blocker-flavored
# ("still blocked on infra for the deploy credentials")
pnpm run-now remind    # verify: nudge skips you-the-responder? blocker DM arrived? no duplicate DM on a second run
pnpm run-now final     # verify the digest DM
```

Each `run-now` prints a Console URL (`platform.claude.com/.../sessions/<id>`) where you can watch the agent's tool calls live. Manual runs work even while a deployment is paused.

## Day-to-day operations

```sh
pnpm status              # recent runs per deployment, failures highlighted
pnpm teardown pause      # going on holiday — stop scheduled firings (reversible)
pnpm teardown unpause    # resume from the next occurrence (missed days are not backfilled)
pnpm teardown archive --yes   # PERMANENT shutdown of the schedules
```

Skipped a day (holiday/pause)? The reminder sessions notice there's no state file for today and exit quietly.

## Repo layout

```
agents/standup-bot.agent.yaml        # agent definition (reference; ant CLI-compatible)
environments/standup.environment.yaml# sandbox definition (reference)
prompts/system.md                    # THE bot logic — modes, Slack conventions, blocker rubric
scripts/lib.ts                       # client, config persistence, deployments helpers
scripts/setup.ts                     # one-time idempotent provisioning
scripts/run-now.ts                   # manual trigger + live session tail
scripts/status.ts                    # deployment run history
scripts/teardown.ts                  # pause / unpause / archive
standup.config.json                  # provisioned resource IDs (created by setup; commit it)
```

## Notes & gotchas

- **Cost**: three short Opus sessions per weekday. Each is a handful of model turns plus curl calls; watch the per-session usage in the Console and dial the schedule down if needed.
- **DST**: cron is literal wall-clock in the configured IANA timezone. 9:00/10:30/12:00 are safely outside the 1–3 AM DST danger window.
- **Both networking layers matter**: the environment's `allowed_hosts` *and* the vault credential's `allowed_hosts` must include `slack.com` — a host missing from either makes the call fail.
- **The placeholder token is normal**: inside the sandbox `$SLACK_BOT_TOKEN` does not look like `xoxb-...`. curl sends it as-is and the real token is injected at egress.
- **Token rotation**: rotate by updating the credential (`vaults.credentials.update`) — or delete `credential_id` from `standup.config.json` after archiving the old credential and re-run `pnpm setup` with the new token in `.env`.
- **SDK**: requires `@anthropic-ai/sdk` ≥ 0.104 for the typed deployments surface; `scripts/lib.ts` falls back to raw HTTP with the `managed-agents-2026-04-01` beta header on older SDKs.
