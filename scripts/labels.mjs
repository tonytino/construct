/**
 * Canonical label definitions for the agentic task management workflow.
 *
 * Imported by scaffold.mjs to create labels in GitHub on first setup.
 * Imported by tests to verify label definitions are correct and complete.
 *
 * If you change this taxonomy, update docs/agents/tasks.md in sync.
 *
 * @typedef {{ name: string; color: string; description: string }} Label
 */

/** @type {Label[]} */
export const LABELS = [
  // ── Status ──────────────────────────────────────────────────────────────────
  // Mutually exclusive. Drives the agent workflow state machine.
  {
    name: "status:ready",
    color: "0075ca",
    description: "Scoped and ready for an agent to claim",
  },
  {
    name: "status:in-progress",
    color: "e4e669",
    description: "Claimed by an agent — do not pick up",
  },
  {
    name: "status:blocked",
    color: "d93f0b",
    description: "Waiting on something external before work can continue",
  },
  {
    name: "status:needs-review",
    color: "0e8a16",
    description: "Agent finished — awaiting human review before closing",
  },

  // ── Type ────────────────────────────────────────────────────────────────────
  { name: "type:bug", color: "d73a4a", description: "Something is broken" },
  { name: "type:feature", color: "a2eeef", description: "New functionality" },
  {
    name: "type:chore",
    color: "cfd3d7",
    description: "Maintenance, cleanup, or tooling change",
  },
  { name: "type:docs", color: "0052cc", description: "Documentation change" },

  // ── Size ────────────────────────────────────────────────────────────────────
  // Scope for a single agent working independently in one session.
  {
    name: "size:xs",
    color: "f9d0c4",
    description: "< 30 min, single file",
  },
  {
    name: "size:s",
    color: "f9d0c4",
    description: "< 2 hrs, isolated change",
  },
  {
    name: "size:m",
    color: "f9d0c4",
    description: "2–4 hrs, touches multiple files",
  },
  {
    name: "size:l",
    color: "e99695",
    description: "Requires a planning session first — not directly claimable",
  },

  // ── Safety ──────────────────────────────────────────────────────────────────
  {
    name: "safe:agent",
    color: "bfd4f2",
    description: "Agent can execute without human pre-approval",
  },
  {
    name: "safe:human",
    color: "e4b429",
    description: "Human must approve before the agent begins work",
  },
];
