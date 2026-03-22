export function useMonthlyTaskActions({
  tokenStore,
  message,
  t,
  monthActivity,
  monthLoading,
  fishToppingUp,
  arenaToppingUp,
  isConnected,
  isArenaActivityOpen,
  fishNum,
  arenaNum,
  fishShouldBe,
  arenaShouldBe,
  FISH_TARGET,
  ARENA_TARGET,
}) {
  const fetchMonthlyActivity = async () => {
    if (!tokenStore.selectedToken) {
      return message.warning(t("monthlyTasksCard.messages.selectTokenFirst"));
    }
    if (!isConnected.value)
      return;
    monthLoading.value = true;
    try {
      const tokenId = tokenStore.selectedToken.id;
      const result = await tokenStore.sendMessageWithPromise(
        tokenId,
        "activity_get",
        {},
        10000,
      );
      const act = result?.activity || result?.body?.activity || result;
      monthActivity.value = act || null;
      if (act) {
        message.success(t("monthlyTasksCard.messages.progressUpdated"));
      }
    } catch (e) {
      message.error(
        t("monthlyTasksCard.messages.fetchFailed", { error: e.message }),
      );
    } finally {
      monthLoading.value = false;
    }
  };

  const getTodayStartSec = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  };

  const isTodayAvailable = (lastTimeSec) => {
    if (!lastTimeSec || typeof lastTimeSec !== "number")
      return true;
    return lastTimeSec < getTodayStartSec();
  };

  const pickArenaTargetId = (targets) => {
    const candidate
      = targets?.rankList?.[0]
        || targets?.roleList?.[0]
        || targets?.targets?.[0]
        || targets?.targetList?.[0]
        || targets?.list?.[0];

    if (candidate?.roleId)
      return candidate.roleId;
    if (candidate?.id)
      return candidate.id;
    return targets?.roleId || targets?.id;
  };

  const autoTopUpFish = async (need, shouldBe, target) => {
    if (!tokenStore.selectedToken) {
      return message.warning(t("monthlyTasksCard.messages.selectTokenFirst"));
    }
    if (!isConnected.value) {
      return message.warning(t("monthlyTasksCard.messages.connectWsFirst"));
    }

    fishToppingUp.value = true;
    try {
      const tokenId = tokenStore.selectedToken.id;
      let role = tokenStore.gameData?.roleInfo?.role;
      if (!role) {
        try {
          await tokenStore.sendGetRoleInfo(tokenId);
        } catch {}
        role = tokenStore.gameData?.roleInfo?.role;
      }

      let freeUsed = 0;
      const lastFreeTime = Number(
        role?.statisticsTime?.["artifact:normal:lottery:time"] || 0,
      );
      if (isTodayAvailable(lastFreeTime)) {
        message.info(t("monthlyTasksCard.messages.freeFishDetected"));
        for (let i = 0; i < 3; i++) {
          try {
            await tokenStore.sendMessageWithPromise(
              tokenId,
              "artifact_lottery",
              { lotteryNumber: 1, newFree: true, type: 1 },
              8000,
            );
            freeUsed++;
            await new Promise((r) => setTimeout(r, 500));
          } catch {
            break;
          }
        }
        if (freeUsed > 0) {
          await fetchMonthlyActivity();
        }
      }

      let remaining = Math.max(0, shouldBe - fishNum.value);
      if (remaining <= 0) {
        return message.success(t("monthlyTasksCard.messages.freeFishDone"));
      }

      message.info(
        t("monthlyTasksCard.messages.paidFishStart", { count: remaining }),
      );
      while (remaining > 0) {
        const batch = Math.min(10, remaining);
        try {
          await tokenStore.sendMessageWithPromise(
            tokenId,
            "artifact_lottery",
            { lotteryNumber: batch, newFree: true, type: 1 },
            12000,
          );
        } catch (e) {
          message.error(
            t("monthlyTasksCard.messages.fishFailed", { error: e.message }),
          );
          break;
        }
        remaining -= batch;
        await new Promise((r) => setTimeout(r, 800));
      }

      await fetchMonthlyActivity();
      if (fishNum.value >= shouldBe || fishNum.value >= target) {
        message.success(t("monthlyTasksCard.messages.fishDone"));
      } else {
        message.warning(t("monthlyTasksCard.messages.fishStopped"));
      }
    } finally {
      fishToppingUp.value = false;
    }
  };

  const autoTopUpArena = async (need, shouldBe, target) => {
    if (!tokenStore.selectedToken) {
      return message.warning(t("monthlyTasksCard.messages.selectTokenFirst"));
    }
    if (!isConnected.value) {
      return message.warning(t("monthlyTasksCard.messages.connectWsFirst"));
    }
    if (!isArenaActivityOpen.value) {
      return message.warning(t("monthlyTasksCard.messages.arenaClosed"));
    }

    arenaToppingUp.value = true;
    try {
      const tokenId = tokenStore.selectedToken.id;
      try {
        await tokenStore.sendMessageWithPromise(
          tokenId,
          "arena_startarea",
          {},
          6000,
        );
      } catch {}

      let safetyCounter = 0;
      const safetyMaxFights = 100;
      let round = 1;
      let remaining = need;
      while (remaining > 0 && safetyCounter < safetyMaxFights) {
        const planFights = Math.ceil(remaining / 2);
        message.info(
          t("monthlyTasksCard.messages.arenaRound", {
            round,
            count: planFights,
          }),
        );

        for (let i = 0; i < planFights && safetyCounter < safetyMaxFights; i++) {
          let targets;
          try {
            targets = await tokenStore.sendMessageWithPromise(
              tokenId,
              "arena_getareatarget",
              {},
              8000,
            );
          } catch (err) {
            message.error(
              t("monthlyTasksCard.messages.arenaTargetFailed", {
                error: err.message,
              }),
            );
            break;
          }

          const targetId = pickArenaTargetId(targets);
          if (!targetId) {
            message.warning(t("monthlyTasksCard.messages.noArenaTarget"));
            break;
          }

          try {
            await tokenStore.sendMessageWithPromise(
              tokenId,
              "fight_startareaarena",
              { targetId },
              15000,
            );
          } catch (e) {
            message.error(
              t("monthlyTasksCard.messages.arenaFightFailed", {
                error: e.message,
              }),
            );
          }
          safetyCounter++;
          await new Promise((r) => setTimeout(r, 1200));
        }

        await fetchMonthlyActivity();
        remaining = Math.max(0, shouldBe - arenaNum.value);
        round++;
      }

      if (arenaNum.value >= shouldBe || arenaNum.value >= target) {
        message.success(t("monthlyTasksCard.messages.arenaDone"));
      } else if (safetyCounter >= safetyMaxFights) {
        message.warning(t("monthlyTasksCard.messages.arenaSafetyStop"));
      } else {
        message.warning(t("monthlyTasksCard.messages.arenaStopped"));
      }
    } finally {
      arenaToppingUp.value = false;
    }
  };

  const topUpMonthly = (type) => {
    const isFish = type === "fish";
    const target = isFish ? FISH_TARGET : ARENA_TARGET;
    const current = isFish ? fishNum.value : arenaNum.value;
    const shouldBe = isFish ? fishShouldBe.value : arenaShouldBe.value;
    const need = Math.max(0, shouldBe - current);
    if (need <= 0) {
      return message.success(t("monthlyTasksCard.messages.alreadyOnTrack"));
    }
    return isFish
      ? autoTopUpFish(need, shouldBe, target)
      : autoTopUpArena(need, shouldBe, target);
  };

  const completeMonthly = (type) => {
    const isFish = type === "fish";
    const target = isFish ? FISH_TARGET : ARENA_TARGET;
    const current = isFish ? fishNum.value : arenaNum.value;
    const need = Math.max(0, target - current);
    if (need <= 0) {
      return message.success(t("monthlyTasksCard.messages.alreadyComplete"));
    }
    return isFish
      ? autoTopUpFish(need, target, target)
      : autoTopUpArena(need, target, target);
  };

  return {
    completeMonthly,
    fetchMonthlyActivity,
    topUpMonthly,
  };
}
