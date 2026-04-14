import assert from "node:assert/strict";
import test from "node:test";
import {
  buildArtifactToHeroMap,
  findBestLineupEquipmentHolder,
  getArtifactIdForTargetHero,
  getCurrentArtifactIdForTargetHero,
  getEquipmentMatchScore,
  getLineupSlotCandidates,
  getPearlSkillId,
  isArtifactAssignedToTargetHero,
  reviewLineupEquipment,
} from "../../src/components/cards/lineup/lineupMatching.js";

test("lineup matching keeps artifact and slot helpers stable", () => {
  const targetHero = { heroId: 101, position: 1, fishId: 2001, pearlId: 9001 };
  const pearlMap = { 9001: { artifactId: 400150, skillId: 501 } };
  const artifactBooks = { 2001: { artifactId: 400150 } };
  const heroesData = { 101: { artifactId: 400150 }, 202: { artifactId: 400160 } };
  const teamInfo = { 1: { heroId: 101, artifactId: 400150 } };
  const artifactToHeroMap = buildArtifactToHeroMap(heroesData, teamInfo);

  assert.equal(getArtifactIdForTargetHero(targetHero, pearlMap, artifactBooks), 400150);
  assert.equal(getPearlSkillId(pearlMap, 9001), 501);
  assert.equal(getCurrentArtifactIdForTargetHero(targetHero, heroesData, teamInfo), 400150);
  assert.equal(
    isArtifactAssignedToTargetHero(targetHero, 400150, heroesData, teamInfo, artifactToHeroMap),
    true,
  );
  assert.deepEqual(
    getLineupSlotCandidates([{ position: 1 }, { position: 3 }], [{ position: 2 }]),
    [1, 2, 3, 4, 5],
  );
});

test("lineup equipment matching preserves exact and candidate ranking semantics", () => {
  const exactEquipment = {
    0: {
      quenches: {
        1: { attrId: 1, attrNum: 10, colorId: 6 },
      },
      quenchAttackExt: 12,
    },
  };
  const partialEquipment = {
    0: {
      quenches: {
        1: { attrId: 1, attrNum: 8, colorId: 5 },
      },
      quenchAttackExt: 8,
    },
  };

  const exactScore = getEquipmentMatchScore(exactEquipment, exactEquipment);
  const partialScore = getEquipmentMatchScore(exactEquipment, partialEquipment);

  assert.equal(exactScore.exact, true);
  assert.equal(partialScore.hasSignal, true);

  const holder = findBestLineupEquipmentHolder(
    { heroId: 101, equipment: exactEquipment },
    {
      202: { equipment: exactEquipment },
      303: { equipment: partialEquipment },
    },
    { 1: { heroId: 202 } },
  );
  assert.equal(holder.heroId, 202);
});

test("lineup equipment review reports mismatched heroes with stable fallback names", () => {
  const targetHeroes = [
    { heroId: 101, equipment: { 0: { quenches: { 1: { colorId: 6 } } } } },
    { heroId: 202, equipment: { 0: { quenches: { 1: { colorId: 5 } } } } },
  ];
  const review = reviewLineupEquipment(
    targetHeroes,
    {
      101: { equipment: { 0: { quenches: { 1: { colorId: 6 } } } } },
      202: { equipment: { 0: { quenches: { 1: { colorId: 6 } } } } },
    },
    (heroId) => `武将${heroId}`,
  );

  assert.equal(review.success, false);
  assert.deepEqual(review.mismatched, [{ heroId: 202, heroName: "武将202" }]);
});
