export const GAME_STATUS_MODULE_IDS = Object.freeze({
  daily: "daily",
  legionOps: "legionOps",
  activity: "activity",
  tools: "tools",
  pvp: "pvp",
  dataAnalysis: "dataAnalysis",
});

export const buildGameStatusModules = (
  t,
  {
    canAccessRestrictedGameSections = false,
    enableToolsTab = true,
  } = {},
) => {
  const modules = [
    {
      id: GAME_STATUS_MODULE_IDS.daily,
      label: t("gameStatus.modules.daily.label"),
      description: t("gameStatus.modules.daily.description"),
      defaultSection: "daily",
      sections: [
        {
          id: "daily",
          label: t("gameStatus.sections.daily"),
          description: t("gameStatus.moduleSections.daily"),
        },
      ],
    },
    {
      id: GAME_STATUS_MODULE_IDS.legionOps,
      label: t("gameStatus.modules.legionOps.label"),
      description: t("gameStatus.modules.legionOps.description"),
      defaultSection: "club",
      hidden: !canAccessRestrictedGameSections,
      sections: canAccessRestrictedGameSections
        ? [
            {
              id: "club",
              label: t("gameStatus.sections.club"),
              description: t("gameStatus.moduleSections.club"),
            },
          ]
        : [],
    },
    {
      id: GAME_STATUS_MODULE_IDS.activity,
      label: t("gameStatus.modules.activity.label"),
      description: t("gameStatus.modules.activity.description"),
      defaultSection: "activity",
      sections: [
        {
          id: "activity",
          label: t("gameStatus.sections.activity"),
          description: t("gameStatus.moduleSections.activity"),
        },
      ],
    },
    {
      id: GAME_STATUS_MODULE_IDS.tools,
      label: t("gameStatus.modules.tools.label"),
      description: t("gameStatus.modules.tools.description"),
      defaultSection: "tools",
      hidden: !enableToolsTab,
      sections: enableToolsTab
        ? [
            {
              id: "tools",
              label: t("gameStatus.sections.tools"),
              description: t("gameStatus.moduleSections.tools"),
            },
          ]
        : [],
    },
    {
      id: GAME_STATUS_MODULE_IDS.pvp,
      label: t("gameStatus.modules.pvp.label"),
      description: t("gameStatus.modules.pvp.description"),
      defaultSection: "fightPvp",
      sections: [
        {
          id: "fightPvp",
          label: t("gameStatus.sections.fightPvp"),
          description: t("gameStatus.moduleSections.fightPvp"),
        },
        {
          id: "arenaPvp",
          label: t("gameStatus.sections.arenaPvp"),
          description: t("gameStatus.moduleSections.arenaPvp"),
        },
      ],
    },
    {
      id: GAME_STATUS_MODULE_IDS.dataAnalysis,
      label: t("gameStatus.modules.dataAnalysis.label"),
      description: t("gameStatus.modules.dataAnalysis.description"),
      defaultSection: "rankGroup",
      sections: [
        {
          id: "rankGroup",
          label: t("gameStatus.sections.rankGroup"),
          description: t("gameStatus.moduleSections.rankGroup"),
        },
        {
          id: "resourceChanges",
          label: t("gameStatus.sections.resourceChanges"),
          description: t("gameStatus.moduleSections.resourceChanges"),
        },
        {
          id: "goldFishCalc",
          label: t("gameStatus.sections.goldFishCalc"),
          description: t("gameStatus.moduleSections.goldFishCalc"),
        },
        {
          id: "tenHall",
          label: t("gameStatus.sections.tenHall"),
          description: t("gameStatus.moduleSections.tenHall"),
        },
      ],
    },
  ];

  return modules.filter((module) => !module.hidden && module.sections.length > 0);
};

export const getDefaultSectionForModule = (module) =>
  module?.defaultSection || module?.sections?.[0]?.id || null;

export const findGameStatusModuleById = (modules, moduleId) =>
  modules.find((module) => module.id === moduleId) || null;

export const findGameStatusModuleBySection = (modules, sectionId) =>
  modules.find((module) => module.sections.some((section) => section.id === sectionId)) || null;

export const findGameStatusSectionMeta = (module, sectionId) =>
  module?.sections?.find((section) => section.id === sectionId) || null;
