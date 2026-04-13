const LEGION_COLOR_ARRAY = [
  "#ff000033",
  "#00ff0033",
  "#0000ff33",
  "#FFFF0033",
  "#FF00FF33",
  "#00ffff33",
  "#66666633",
  "#cdcdcd",
  "#f77aff",
  "#c9a0ff",
  "#a0c6ff",
  "#a0fffb",
  "#a0ffb0",
  "#cdffa0",
  "#fffca0",
  "#ffdda0",
  "#ffbfa0",
  "#f16f5a",
  "#fb9494",
  "#dcdd9a",
];

const formatState = (state) => {
  switch (state) {
    case "idle":
      return "空闲";
    case "march":
      return "行进";
    case "watching":
      return "观看";
    case "over":
      return "死亡";
    default:
      return "未知";
  }
};

export const typeBg = (type) => {
  switch (type) {
    case 1:
      return "orange";
    case 2:
      return "yellow";
    case 3:
      return "gray";
    case 4:
      return "red";
    case 5:
      return "green";
    case 6:
      return "#1bd7d7";
    case 9:
      return "#2452f7";
    default:
      return "未知";
  }
};

export const typeName = (type) => {
  switch (type) {
    case 1:
      return "30分据点";
    case 2:
      return "50分据点";
    case 3:
      return "80分据点";
    case 4:
      return "大本营";
    case 5:
      return "100分据点";
    case 6:
      return "核心";
    case 9:
      return "道路";
    default:
      return "未知";
  }
};

export const formatPower = (power) => {
  if (!power) {
    return "0";
  }
  if (power >= 100000000) {
    return `${(power / 100000000).toFixed(2)}亿`;
  }
  if (power >= 10000) {
    return `${(power / 10000).toFixed(2)}万`;
  }
  return power.toString();
};

export const extractValidData = (result) => {
  const rawResult = result;
  if (!rawResult || !rawResult.battlefield) {
    return false;
  }

  const buildingData = rawResult.battlefield.buildingData;
  const legionInfo = Object.fromEntries(
    Object.values(rawResult.battlefield.legions).map((item) => [
      item.id,
      {
        blessingCount: item.blessingIdList.length,
        blessingScore: item.blessingScore,
        buildings: item.buildings,
        redCount: item.custom["red:quench"] || 0,
        killCnt: item.killCnt,
        level: item.level,
        name: item.name,
        color: LEGION_COLOR_ARRAY[item.color],
        id: item.id,
        memberCount: Object.keys(item.membersV2).length,
        point: item.point,
        position: item.position,
        strongholdId: item.strongholdId,
        score:
          Object.keys(item?.buildings || {})
            .map((buildingId) => buildingData[buildingId]?.point ?? 0)
            .reduce((total, current) => total + current, 0)
          + item.blessingScore,
        power: item.power,
        OnlineCount: 0,
        participantsCount: 0,
        danCount: 0,
        reviveCount: 0,
        serverId: item.serverId,
      },
    ]),
  );

  const memberInfo = Object.values(rawResult.battlefield.roles).map((item) => {
    legionInfo[`${item.legionID}`].participantsCount++;
    if (item.isOnline) {
      legionInfo[`${item.legionID}`].OnlineCount++;
    }
    legionInfo[item.legionID].reviveCount += item.revive;
    legionInfo[item.legionID].danCount += item.d - 6 > 0 ? item.d - 6 : 0;
    return {
      name: item.name,
      legionName: legionInfo[item.legionID].name,
      legionId: item.legionID,
      lastState: formatState(item.state),
      digGround: item.aB,
      kill: item.killCnt,
      revive: item.revive,
      die: item.d,
      dan: item.d - 6 > 0 ? item.d - 6 : 0,
      score: item.point,
    };
  });

  return {
    buildingData,
    memberInfo,
    legionInfo,
  };
};
