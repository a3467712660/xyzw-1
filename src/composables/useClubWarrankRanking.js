import { computed, ref } from "vue";

export function useClubWarrankRanking({
  allianceincludes,
  battleRecords,
  message,
}) {
  const activeAlliance = ref("all");
  const currentSortType = ref("manual");
  const isEditMode = ref(false);
  const manualRankings = ref({});
  const manualAlliances = ref({});
  const editingSortOrder = ref([]);
  const tempOldRanks = ref({});

  const allianceOptions = [
    { label: "大联盟", value: "大联盟" },
    { label: "梦盟", value: "梦盟" },
    { label: "正义联盟", value: "正义联盟" },
    { label: "龙盟", value: "龙盟" },
    { label: "未知联盟", value: "未知联盟" },
  ];

  const redQuenchRankings = computed(() => {
    if (!battleRecords.value?.legionRankList) {
      return {};
    }

    const sortedByRedQuench = [...battleRecords.value.legionRankList].sort(
      (a, b) => (b.redQuench || 0) - (a.redQuench || 0),
    );

    const rankMap = {};
    sortedByRedQuench.forEach((club, index) => {
      rankMap[club.id] = index + 1;
    });

    return rankMap;
  });

  const getMemberName = (id) => {
    const member = battleRecords.value?.legionRankList.find(
      (item) => String(item.id) === String(id),
    );
    return member ? member.name : "未知俱乐部";
  };

  const getMemberAlliance = (member) => {
    if (manualAlliances.value[member.id] !== undefined) {
      return manualAlliances.value[member.id];
    }
    return allianceincludes(member.announcement) || "未知联盟";
  };

  const getMemberRank = (member) => {
    if (manualRankings.value[member.id] !== undefined) {
      return manualRankings.value[member.id];
    }
    return redQuenchRankings.value[member.id];
  };

  const sortMembers = (members) => {
    return [...members].sort((a, b) => {
      if (isEditMode.value) {
        return editingSortOrder.value.indexOf(a.id) - editingSortOrder.value.indexOf(b.id);
      }
      if (currentSortType.value === "manual") {
        return getMemberRank(a) - getMemberRank(b);
      }
      if (currentSortType.value === "redQuench") {
        return (b.redQuench || 0) - (a.redQuench || 0);
      }
      if (currentSortType.value === "score") {
        return (b.sRScore || 0) - (a.sRScore || 0);
      }
      return 0;
    });
  };

  const toggleEditMode = () => {
    if (!isEditMode.value && battleRecords.value?.legionRankList) {
      battleRecords.value.legionRankList.forEach((member) => {
        if (manualRankings.value[member.id] === undefined) {
          manualRankings.value[member.id] = redQuenchRankings.value[member.id];
        }
        if (manualAlliances.value[member.id] === undefined) {
          manualAlliances.value[member.id]
            = allianceincludes(member.announcement) || "未知联盟";
        }
      });

      editingSortOrder.value = sortMembers(
        battleRecords.value.legionRankList,
      ).map((member) => member.id);
    } else if (isEditMode.value) {
      message.success("已保存调整");
    }

    isEditMode.value = !isEditMode.value;
  };

  const handleRankFocus = (member) => {
    tempOldRanks.value[member.id] = manualRankings.value[member.id];
  };

  const handleRankBlur = (member) => {
    const newRank = manualRankings.value[member.id];
    const oldRank = tempOldRanks.value[member.id];

    delete tempOldRanks.value[member.id];

    if (!newRank || newRank < 1 || newRank > 20) {
      manualRankings.value[member.id] = oldRank;
      if (newRank !== null && newRank !== undefined) {
        message.warning("排名必须在 1-20 之间");
      }
      return;
    }

    if (newRank === oldRank) {
      return;
    }

    const targetMemberId = Object.keys(manualRankings.value).find(
      (id) =>
        String(id) !== String(member.id) && manualRankings.value[id] === newRank,
    );

    if (targetMemberId) {
      manualRankings.value[targetMemberId] = oldRank;
      message.success(`排名已交换：${member.name} ↔ ${getMemberName(targetMemberId)}`);
    }

    currentSortType.value = "manual";
  };

  const filteredLegionList = computed(() => {
    if (!battleRecords.value?.legionRankList) {
      return [];
    }

    const legionRankList = battleRecords.value.legionRankList;
    if (activeAlliance.value === "all") {
      return sortMembers(legionRankList);
    }

    return sortMembers(
      legionRankList.filter((member) => {
        const memberAlliance = getMemberAlliance(member);
        if (activeAlliance.value === "空白") {
          return (
            !member.announcement
            || member.announcement === 0
            || member.announcement === "0"
          );
        }
        return memberAlliance === activeAlliance.value;
      }),
    );
  });

  const setActiveAlliance = (alliance) => {
    activeAlliance.value = alliance;
  };

  const getActiveAllianceCount = (alliance) => {
    if (!battleRecords.value?.legionRankList) {
      return 0;
    }

    return battleRecords.value.legionRankList.filter((member) => {
      const memberAlliance = getMemberAlliance(member);
      if (alliance === "空白") {
        return (
          !member.announcement
          || member.announcement === 0
          || member.announcement === "0"
        );
      }
      return memberAlliance === alliance;
    }).length;
  };

  const resetManualRanksBy = (scoreSelector, successMessage) => {
    if (!battleRecords.value?.legionRankList) {
      return;
    }

    const sortedList = [...battleRecords.value.legionRankList].sort(
      (a, b) => scoreSelector(b) - scoreSelector(a),
    );

    sortedList.forEach((member, index) => {
      manualRankings.value[member.id] = index + 1;
    });

    currentSortType.value = "manual";

    if (isEditMode.value) {
      editingSortOrder.value = sortedList.map((member) => member.id);
    }

    message.success(successMessage);
  };

  const hcSort = () => {
    resetManualRanksBy((member) => member.redQuench || 0, "已按红淬数量重置排名");
  };

  const scoreSort = () => {
    resetManualRanksBy((member) => member.sRScore || 0, "已按积分重置排名");
  };

  return {
    activeAlliance,
    allianceOptions,
    currentSortType,
    filteredLegionList,
    getActiveAllianceCount,
    getMemberAlliance,
    getMemberRank,
    handleRankBlur,
    handleRankFocus,
    hcSort,
    isEditMode,
    manualAlliances,
    manualRankings,
    redQuenchRankings,
    scoreSort,
    setActiveAlliance,
    toggleEditMode,
  };
}
