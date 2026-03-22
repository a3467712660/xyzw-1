import type { Ref } from "vue";

export function createTokenGameDataReader(
  gameData: Ref<any>,
  logger: { warn: (...args: any[]) => void; error: (...args: any[]) => void },
) {
  const getCurrentTowerLevel = () => {
    try {
      const roleInfo = gameData.value.roleInfo;
      if (!roleInfo || !roleInfo.role) {
        logger.warn("角色信息不存在");
        return null;
      }

      const tower = roleInfo.role.tower;
      if (!tower) {
        logger.warn("塔信息不存在");
        return null;
      }

      return tower.level || tower.currentLevel || tower.floor || tower.stage;
    } catch (error) {
      logger.error("获取塔层数失败:", error);
      return null;
    }
  };

  const getTowerInfo = () => {
    try {
      const roleInfo = gameData.value.roleInfo;
      if (!roleInfo || !roleInfo.role) {
        return null;
      }

      return roleInfo.role.tower || null;
    } catch (error) {
      logger.error("获取塔信息失败:", error);
      return null;
    }
  };

  return {
    getCurrentTowerLevel,
    getTowerInfo,
  };
}
