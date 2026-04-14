import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(fileURLToPath(import.meta.url), "../../..");

function readTemplate(filename: string): string {
  return readFileSync(join(ROOT, ".github/ISSUE_TEMPLATE", filename), "utf-8");
}

function readWorkflow(filename: string): string {
  return readFileSync(join(ROOT, ".github/workflows", filename), "utf-8");
}

describe("agent-task.yml", () => {
  it("has required top-level fields", () => {
    const content = readTemplate("agent-task.yml");
    expect(content).toContain("name:");
    expect(content).toContain("description:");
    expect(content).toContain("title:");
    expect(content).toContain("labels:");
  });

  it("includes Goal and Acceptance Criteria fields", () => {
    const content = readTemplate("agent-task.yml");
    expect(content).toContain("Goal");
    expect(content).toContain("Acceptance Criteria");
  });

  it("includes size and safety dropdowns", () => {
    const content = readTemplate("agent-task.yml");
    expect(content).toContain("size:");
    expect(content).toContain("safe:");
  });

  it("defaults to status:ready label", () => {
    const content = readTemplate("agent-task.yml");
    expect(content).toContain("status:ready");
  });
});

describe("bug-report.yml", () => {
  it("has required top-level fields", () => {
    const content = readTemplate("bug-report.yml");
    expect(content).toContain("name:");
    expect(content).toContain("description:");
    expect(content).toContain("title:");
    expect(content).toContain("labels:");
  });

  it("includes steps to reproduce", () => {
    const content = readTemplate("bug-report.yml");
    expect(content).toContain("Steps to reproduce");
  });

  it("defaults to type:bug label", () => {
    const content = readTemplate("bug-report.yml");
    expect(content).toContain("type:bug");
  });
});

describe("ci.yml", () => {
  it("runs on push and pull_request", () => {
    const content = readWorkflow("ci.yml");
    expect(content).toContain("push:");
    expect(content).toContain("pull_request:");
  });

  it("includes all required quality steps", () => {
    const content = readWorkflow("ci.yml");
    expect(content).toContain("biome check");
    expect(content).toContain("pnpm typecheck");
    expect(content).toContain("vitest run");
    expect(content).toContain("test:e2e");
  });

  it("injects DATABASE_URL from secrets for E2E tests", () => {
    const content = readWorkflow("ci.yml");
    expect(content).toContain("DATABASE_URL");
    expect(content).toContain("secrets.DATABASE_URL");
  });
});
