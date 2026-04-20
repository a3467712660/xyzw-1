import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../../src/views/BatchDailyTasks.vue", import.meta.url),
  "utf8",
);

test("BatchDailyTasks initializes toolbar actions after runtime actions are declared", () => {
  const runtimeActionsIndex = source.indexOf("} = useBatchTaskRuntime({");
  const toolbarActionsIndex = source.indexOf("const batchToolbarActions = {");

  assert.notEqual(runtimeActionsIndex, -1);
  assert.notEqual(toolbarActionsIndex, -1);
  assert.ok(
    runtimeActionsIndex < toolbarActionsIndex,
    "batchToolbarActions must be created after useBatchTaskRuntime destructures action functions to avoid setup-time TDZ errors",
  );
});
