import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBatchConfigExportData,
  normalizeBatchConfigImportData,
} from "../../src/composables/useBatchConfigTransfer.logic.js";

test("buildBatchConfigExportData exports config and token references without raw credentials or raw URLs", () => {
  const exportData = buildBatchConfigExportData({
    batchSettings: {
      boxCount: 100,
      fishCount: 50,
      helperLineupAnalysisEnabled: true,
      helperPreferredLineups: ["attack"],
      ignoredKey: "should-not-export",
    },
    scheduledTasks: [
      {
        id: "task-1",
        name: "Task 1",
        selectedTokens: ["token-1", "missing-token"],
      },
    ],
    tokenSettings: [
      { tokenId: "token-1", settings: { arenaFormation: 2 } },
    ],
    tokens: [
      {
        id: "token-1",
        name: "Role 1",
        token: "raw-token",
        server: "s1",
        wsUrl: "wss://example.com/agent?p=secret",
        sourceUrl: "https://api.example.com/token?code=secret",
        remark: "remark",
        importMethod: "url",
      },
    ],
  });

  assert.equal(exportData.version, "1.2");
  assert.deepEqual(exportData.tokens, [
    {
      id: "token-1",
      name: "Role 1",
      server: "s1",
      remark: "remark",
      importMethod: "url",
    },
  ]);
  assert.equal("token" in exportData.tokens[0], false);
  assert.equal("wsUrl" in exportData.tokens[0], false);
  assert.equal("sourceUrl" in exportData.tokens[0], false);
  assert.deepEqual(exportData.scheduledTasks[0].selectedTokens, ["token-1"]);
  assert.equal("ignoredKey" in exportData.batchSettings, false);
});

test("normalizeBatchConfigImportData ignores legacy credential fields and filters missing token ids", () => {
  const normalized = normalizeBatchConfigImportData({
    existingTaskIds: new Set(["existing-task"]),
    importData: {
      version: "1.1",
      tokens: [
        {
          id: "token-1",
          name: "Legacy token",
          token: "raw-token",
          wsUrl: "wss://example.com/agent?p=secret",
          sourceUrl: "https://api.example.com/token?code=secret",
        },
      ],
      scheduledTasks: [
        {
          id: "existing-task",
          selectedTokens: ["token-1"],
        },
        {
          id: "task-2",
          selectedTokens: ["missing-token"],
        },
        {
          id: "task-3",
          selectedTokens: ["token-1", "missing-token"],
        },
      ],
      batchSettings: {
        boxCount: 20,
        ignoredSetting: true,
      },
      tokenSettings: [
        { tokenId: "token-1", settings: { arenaFormation: 3 } },
        { tokenId: "missing-token", settings: { arenaFormation: 1 } },
      ],
    },
    validTokenIds: new Set(["token-1"]),
  });

  assert.equal(normalized.hasTokenReferences, true);
  assert.equal(normalized.hasLegacyCredentialFields, true);
  assert.equal(normalized.scheduledTasksToImport.length, 1);
  assert.deepEqual(normalized.scheduledTasksToImport[0].selectedTokens, ["token-1"]);
  assert.equal(normalized.skippedTaskCount, 2);
  assert.equal(normalized.skippedTaskTokenRefCount, 2);
  assert.equal(normalized.tokenSettingsToApply.length, 1);
  assert.equal(normalized.tokenSettingsToApply[0].tokenId, "token-1");
  assert.equal(normalized.skippedTokenSettingsCount, 1);
  assert.deepEqual(normalized.batchSettings, { boxCount: 20 });
});
