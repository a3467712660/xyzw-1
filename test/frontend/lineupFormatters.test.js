import assert from "node:assert/strict";
import test from "node:test";
import {
  formatLineupFishCaption,
  formatLineupPower,
  getLineupFishInfoByArtifactId,
  getLineupFishNameById,
  getLineupHeroDisplayName,
  getLineupPearlDataByArtifactId,
  getLineupPearlSkillNameByArtifactId,
  getLineupPearlSkillNameById,
  getLineupSlotColors,
  getLineupSlotColorsByArtifactId,
} from "../../src/components/cards/lineup/lineupFormatters.js";

test("lineup formatters keep power display semantics stable", () => {
  assert.equal(formatLineupPower(0), "0");
  assert.equal(formatLineupPower(12345), "1.23万");
  assert.equal(formatLineupPower(200000000), "2.00亿");
});

test("lineup hero and fish captions keep fallback semantics stable", () => {
  assert.equal(getLineupHeroDisplayName("吕布", 1001), "吕布");
  assert.equal(getLineupHeroDisplayName("", 1001), "武将1001");
  assert.equal(getLineupHeroDisplayName(null, null), "未知武将");

  assert.equal(formatLineupFishCaption("霸王", ""), "霸王");
  assert.equal(formatLineupFishCaption("霸王", "破甲"), "霸王 破甲");
  assert.equal(formatLineupFishCaption("", "破甲"), "");
});

test("lineup artifact helpers keep fish and pearl mapping semantics stable", () => {
  const artifactBooks = {
    2001: { artifactId: 400150, claimedStar: 3 },
  };
  const fishMap = {
    2001: { name: "霸王" },
  };
  const pearlRecords = {
    9001: {
      artifactId: 400150,
      skillId: 501,
      slotMap: {
        1: { colorId: 6 },
        2: { colorId: 5 },
      },
    },
  };
  const pearlSkillMap = {
    501: { name: "破甲" },
  };
  const colorMap = {
    5: { value: "orange" },
    6: { value: "red" },
  };

  assert.deepEqual(
    getLineupFishInfoByArtifactId(400150, artifactBooks, fishMap),
    {
      artifactId: 400150,
      fishId: 2001,
      name: "霸王",
      star: 3,
    },
  );
  assert.equal(getLineupFishNameById(2001, fishMap), "霸王");
  assert.equal(getLineupFishNameById(2002, fishMap), "鱼灵2002");

  assert.deepEqual(
    getLineupPearlDataByArtifactId(400150, pearlRecords),
    pearlRecords[9001],
  );
  assert.equal(getLineupPearlSkillNameById(501, pearlSkillMap), "破甲");
  assert.equal(
    getLineupPearlSkillNameByArtifactId(400150, pearlRecords, pearlSkillMap),
    "破甲",
  );
  assert.deepEqual(getLineupSlotColors(pearlRecords[9001].slotMap, colorMap), [
    "red",
    "orange",
  ]);
  assert.deepEqual(
    getLineupSlotColorsByArtifactId(400150, pearlRecords, colorMap),
    ["red", "orange"],
  );
});
