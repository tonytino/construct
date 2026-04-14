import { describe, expect, it } from "vitest";
// @ts-expect-error — .mjs script, no type declarations
import { LABELS } from "../../scripts/labels.mjs";

type Label = { name: string; color: string; description: string };

describe("LABELS", () => {
  it("has no duplicate names", () => {
    const names = (LABELS as Label[]).map((l) => l.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every label has name, color (6-char hex), and description", () => {
    for (const label of LABELS as Label[]) {
      expect(label.name, `${label.name}: missing name`).toBeTruthy();
      expect(label.color, `${label.name}: missing color`).toMatch(/^[0-9a-f]{6}$/i);
      expect(label.description, `${label.name}: missing description`).toBeTruthy();
    }
  });

  it("includes all four status variants", () => {
    const names = (LABELS as Label[]).map((l) => l.name);
    expect(names).toContain("status:ready");
    expect(names).toContain("status:in-progress");
    expect(names).toContain("status:blocked");
    expect(names).toContain("status:needs-review");
  });

  it("includes all four size variants", () => {
    const names = (LABELS as Label[]).map((l) => l.name);
    expect(names).toContain("size:xs");
    expect(names).toContain("size:s");
    expect(names).toContain("size:m");
    expect(names).toContain("size:l");
  });

  it("includes both safety labels", () => {
    const names = (LABELS as Label[]).map((l) => l.name);
    expect(names).toContain("safe:agent");
    expect(names).toContain("safe:human");
  });

  it("includes all four type labels", () => {
    const names = (LABELS as Label[]).map((l) => l.name);
    expect(names).toContain("type:bug");
    expect(names).toContain("type:feature");
    expect(names).toContain("type:chore");
    expect(names).toContain("type:docs");
  });
});
