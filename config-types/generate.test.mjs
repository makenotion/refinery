import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { generateConfigTypes } from "./generate.ts";

// Compile the generated fixture as a consumer would. @ts-expect-error also
// fails compilation if a constraint is accidentally weakened.
function checkConsumer(fields, examples) {
  const directory = mkdtempSync(join(tmpdir(), "refinery-types-fixture-"));
  try {
    const declarations = generateConfigTypes({
      groups: [{ name: "Example", fields }],
    });
    writeFileSync(join(directory, "index.d.ts"), declarations);
    writeFileSync(
      join(directory, "consumer.ts"),
      'import type { RefineryConfig } from "./index";\n' + examples,
    );
    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
      "--noEmit", "--strict", "--exactOptionalPropertyTypes",
      "--skipLibCheck", "--types", "node",
      "--typeRoots", fileURLToPath(new URL("../node_modules/@types", import.meta.url)),
      join(directory, "consumer.ts"),
    ], { encoding: "utf8" });
    assert.equal(result.status, 0, result.error?.message ?? result.stdout + result.stderr);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("required fields require the containing group", () => {
  checkConsumer([
    { name: "Value", type: "string", validations: [{ type: "required" }] },
  ], `
    const valid: RefineryConfig = { Example: { Value: "ok" } };
    // @ts-expect-error globally required group is missing
    const missingGroup: RefineryConfig = {};
    // @ts-expect-error required field is missing
    const missingField: RefineryConfig = { Example: {} };
  `);
});

test("requiredInGroup permits omission of the group, but not its field", () => {
  checkConsumer([
    { name: "Value", type: "string", validations: [{ type: "requiredInGroup" }] },
  ], `
    const omitted: RefineryConfig = {};
    const valid: RefineryConfig = { Example: { Value: "ok" } };
    // @ts-expect-error group is present without its required field
    const invalid: RefineryConfig = { Example: {} };
  `);
});

test("conflictsWith rejects both fields, including through a variable", () => {
  checkConsumer([
    { name: "Left", type: "string", validations: [{ type: "conflictsWith", arg: "Right" }] },
    { name: "Right", type: "string" },
  ], `
    const neither: RefineryConfig = { Example: {} };
    const left: RefineryConfig = { Example: { Left: "a" } };
    const right: RefineryConfig = { Example: { Right: "b" } };
    const both = { Left: "a", Right: "b" };
    // @ts-expect-error mutually exclusive fields
    const invalid: RefineryConfig = { Example: both };
  `);
});

test("requiredWith requires its dependent field only when the trigger is set", () => {
  checkConsumer([
    { name: "Trigger", type: "bool" },
    { name: "Dependent", type: "string", validations: [{ type: "requiredWith", arg: "Trigger" }] },
  ], `
    const neither: RefineryConfig = { Example: {} };
    const dependent: RefineryConfig = { Example: { Dependent: "a" } };
    const both: RefineryConfig = { Example: { Trigger: true, Dependent: "a" } };
    // @ts-expect-error missing dependent field
    const invalid: RefineryConfig = { Example: { Trigger: true } };
  `);
});

test("a default satisfies requiredWith without an explicit dependent field", () => {
  checkConsumer([
    { name: "Trigger", type: "bool" },
    { name: "Dependent", type: "string", default: "default",
      validations: [{ type: "requiredWith", arg: "Trigger" }] },
  ], `
    const valid: RefineryConfig = { Example: { Trigger: true } };
  `);
});

test("unknown field types fail generation instead of silently weakening types", () => {
  assert.throws(() => generateConfigTypes({
    groups: [{ name: "Example", fields: [{ name: "Value", type: "futuretype" }] }],
  }), /Unhandled metadata field type "futuretype" for Example.Value/);
});

test("invalid constraint references fail generation", () => {
  for (const type of ["requiredWith", "conflictsWith"]) {
    assert.throws(() => generateConfigTypes({
      groups: [{ name: "Example", fields: [
        { name: "Value", type: "string", validations: [{ type, arg: "Missing" }] },
      ] }],
    }), new RegExp("Invalid " + type + " reference for Example.Value"));
  }
});
