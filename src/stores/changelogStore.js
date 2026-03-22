import { defineStore } from "pinia";
import { computed, ref } from "vue";
import changelogMarkdown from "../../CHANGELOG.md?raw";
import { parseChangelogMarkdown } from "@/utils/changelogParser";

const DEFAULT_CHANGELOGS = parseChangelogMarkdown(changelogMarkdown);

const mergeChangelogs = (baseLogs = [], localLogs = []) => {
  const allowedVersions = new Set(baseLogs.map((item) => String(item?.version || "").trim()));
  const orderMap = new Map(
    baseLogs.map((item, index) => [String(item?.version || "").trim(), index]),
  );
  const byVersion = new Map();
  // 同版本时以内置日志为准，避免旧的本地缓存覆盖仓库中的最新变更
  [...localLogs, ...baseLogs].forEach((item) => {
    const version = String(item?.version || "").trim();
    if (!version) return;
    if (!allowedVersions.has(version)) return;
    byVersion.set(version, item);
  });
  return [...byVersion.values()].sort(
    (a, b) =>
      (orderMap.get(String(a?.version || "").trim()) ?? Number.MAX_SAFE_INTEGER)
      - (orderMap.get(String(b?.version || "").trim()) ?? Number.MAX_SAFE_INTEGER),
  );
};

/**
 * 更新日志数据存储
 * 管理系统更新日志的状态和数据
 */
export const useChangelogStore = defineStore("changelog", () => {
  // ==================== State ====================

  /**
   * 更新日志列表
   * 按照时间倒序排列
   */
  const changelogs = ref([...DEFAULT_CHANGELOGS]);

  // ==================== Computed ====================

  /**
   * 最新版本
   */
  const latestVersion = computed(() => {
    return changelogs.value.length > 0 ? changelogs.value[0] : null;
  });

  /**
   * 获取最近N条更新日志
   */
  const getRecentChangelogs = computed(() => {
    return (count = 3) => {
      return changelogs.value.slice(0, count);
    };
  });

  /**
   * 按类型筛选更新日志
   */
  const getChangelogsByType = computed(() => {
    return (type) => {
      return changelogs.value.filter((log) => log.type === type);
    };
  });

  /**
   * 统计数据
   */
  const statistics = computed(() => {
    return {
      totalVersions: changelogs.value.length,
      majorVersions: changelogs.value.filter((log) => log.type === "major")
        .length,
      minorVersions: changelogs.value.filter((log) => log.type === "minor")
        .length,
      patchVersions: changelogs.value.filter((log) => log.type === "patch")
        .length,
      hotfixVersions: changelogs.value.filter((log) => log.type === "hotfix")
        .length,
    };
  });

  // ==================== Actions ====================

  /**
   * 添加新的更新日志
   * @param {object} changelog - 更新日志对象
   */
  const addChangelog = (changelog) => {
    changelogs.value.unshift(changelog);
    saveToLocalStorage();
  };

  /**
   * 更新指定版本的日志
   * @param {string} version - 版本号
   * @param {object} updates - 更新内容
   */
  const updateChangelog = (version, updates) => {
    const index = changelogs.value.findIndex((log) => log.version === version);
    if (index !== -1) {
      changelogs.value[index] = {
        ...changelogs.value[index],
        ...updates,
      };
      saveToLocalStorage();
    }
  };

  /**
   * 删除指定版本的日志
   * @param {string} version - 版本号
   */
  const deleteChangelog = (version) => {
    const index = changelogs.value.findIndex((log) => log.version === version);
    if (index !== -1) {
      changelogs.value.splice(index, 1);
      saveToLocalStorage();
    }
  };

  /**
   * 保存到本地存储
   */
  const saveToLocalStorage = () => {
    try {
      localStorage.setItem("changelogs", JSON.stringify(changelogs.value));
    } catch (error) {
      console.error("保存更新日志到本地存储失败:", error);
    }
  };

  /**
   * 从本地存储加载
   */
  const loadFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem("changelogs");
      if (stored) {
        const parsed = JSON.parse(stored);
        changelogs.value = mergeChangelogs(
          DEFAULT_CHANGELOGS,
          Array.isArray(parsed) ? parsed : [],
        );
      } else {
        changelogs.value = [...DEFAULT_CHANGELOGS];
      }
    } catch (error) {
      console.error("从本地存储加载更新日志失败:", error);
      changelogs.value = [...DEFAULT_CHANGELOGS];
    }
  };

  /**
   * 获取版本之间的差异
   * @param {string} fromVersion - 起始版本
   * @param {string} toVersion - 结束版本
   * @returns {Array} 版本差异列表
   */
  const getVersionDiff = (fromVersion, toVersion) => {
    const fromIndex = changelogs.value.findIndex(
      (log) => log.version === fromVersion,
    );
    const toIndex = changelogs.value.findIndex(
      (log) => log.version === toVersion,
    );

    if (fromIndex === -1 || toIndex === -1) {
      return [];
    }

    // 返回两个版本之间的所有更新日志
    return changelogs.value.slice(
      Math.min(fromIndex, toIndex),
      Math.max(fromIndex, toIndex) + 1,
    );
  };

  /**
   * 检查是否有新版本
   * @param {string} currentVersion - 当前版本
   * @returns {boolean} 是否有新版本
   */
  const hasNewVersion = (currentVersion) => {
    if (!latestVersion.value)
      return false;
    return latestVersion.value.version !== currentVersion;
  };

  /**
   * 获取未读的更新日志
   * @returns {Array} 未读的更新日志列表
   */
  const getUnreadChangelogs = () => {
    try {
      const lastReadVersion = localStorage.getItem(
        "last_read_changelog_version",
      );
      if (!lastReadVersion)
        return changelogs.value;

      const lastReadIndex = changelogs.value.findIndex(
        (log) => log.version === lastReadVersion,
      );

      if (lastReadIndex === -1)
        return changelogs.value;

      return changelogs.value.slice(0, lastReadIndex);
    } catch (error) {
      console.error("获取未读更新日志失败:", error);
      return [];
    }
  };

  /**
   * 标记为已读
   * @param {string} version - 版本号
   */
  const markAsRead = (version) => {
    try {
      localStorage.setItem("last_read_changelog_version", version);
    } catch (error) {
      console.error("标记更新日志为已读失败:", error);
    }
  };

  // 初始化时从本地存储加载
  loadFromLocalStorage();

  return {
    // State
    changelogs,

    // Computed
    latestVersion,
    getRecentChangelogs,
    getChangelogsByType,
    statistics,

    // Actions
    addChangelog,
    updateChangelog,
    deleteChangelog,
    saveToLocalStorage,
    loadFromLocalStorage,
    getVersionDiff,
    hasNewVersion,
    getUnreadChangelogs,
    markAsRead,
  };
});
