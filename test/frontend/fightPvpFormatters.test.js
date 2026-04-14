import assert from "node:assert/strict";
import test from "node:test";
import {
  countFightPvpPearlOrangeSlots,
  formatFightPvpPower,
  formatFightPvpUpdatedAt,
  getFightPvpEquipmentQuenchSlots,
  isFightPvpOrangeQuenchSlot,
  isFightPvpRedQuenchSlot,
} from "../../src/components/cards/pvp/fightPvpFormatters.js";

test("fight pvp formatters keep power and time display semantics stable", () => {
  assert.equal(formatFightPvpPower(0), "0");
  assert.equal(formatFightPvpPower(12345), "1.23万");
  assert.equal(formatFightPvpPower(200000000), "2.00亿");
  assert.match(formatFightPvpUpdatedAt(1710000000000, "zh-CN"), /\d{4}/);
});

test("fight pvp quench helpers preserve equipment slot semantics", () => {
  const equipment = {
    0: {
      curQuenchId: 1,
      quenches: {
        1: { colorId: 6 },
        2: { colorId: 5 },
      },
    },
  };

  const slots = getFightPvpEquipmentQuenchSlots(equipment, 0);
  assert.equal(slots.length, 2);
  assert.equal(isFightPvpRedQuenchSlot(slots[0], equipment), true);
  assert.equal(isFightPvpOrangeQuenchSlot(slots[1], equipment), true);
});

test("fight pvp pearl orange slot counter stays stable", () => {
  assert.equal(countFightPvpPearlOrangeSlots([{ colorId: 5 }, { colorId: 6 }]), 1);
  assert.equal(countFightPvpPearlOrangeSlots(null), 0);
});
