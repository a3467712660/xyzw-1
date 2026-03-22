<template>
  <div>
    <div v-if="inline" class="inline-wrapper">
      <div class="weird-tower-content">
        <div v-if="loading" class="loading-state">
          <NSpin size="large">
            <template #description>正在加载赛车数据...</template>
          </NSpin>
        </div>

        <div
          ref="exportDom"
          v-else-if="memberScores.length > 0"
          class="records-list"
        >
          <NDataTable
            striped
            size="small"
            :bordered="false"
            :columns="columns"
            :data="memberScores"
            :max-height="isExporting ? undefined : 600"
            :row-key="(row) => row.roleId"
          ></NDataTable>
        </div>

        <div v-else class="empty-state">
          <NEmpty description="暂无数据"></NEmpty>
        </div>
      </div>
    </div>

    <NModal
      v-else
      preset="card"
      style="width: 90%; max-width: 800px"
      title="俱乐部赛车信息"
      v-model:show="showModal"
      @after-leave="handleClose"
    >
      <template #header-extra>
        <div class="header-actions">
          <NButton size="small" :disabled="loading" @click="handleRefresh">
            <template #icon>
              <NIcon>
                <Refresh></Refresh>
              </NIcon>
            </template>
            刷新
          </NButton>

          <NButton
            size="small"
            type="primary"
            :disabled="!memberScores.length || loading"
            :loading="isExporting"
            @click="handleExport"
          >
            <template #icon>
              <NIcon>
                <Copy></Copy>
              </NIcon>
            </template>
            导出
          </NButton>
        </div>
      </template>

      <div class="weird-tower-content">
        <div v-if="loading" class="loading-state">
          <NSpin size="large">
            <template #description>正在加载赛车数据...</template>
          </NSpin>
        </div>

        <div
          ref="exportDom"
          v-else-if="memberScores.length > 0"
          class="records-list"
        >
          <NDataTable
            striped
            size="small"
            :bordered="false"
            :columns="columns"
            :data="memberScores"
            :max-height="isExporting ? undefined : 600"
            :row-key="(row) => row.roleId"
          ></NDataTable>
        </div>

        <div v-else class="empty-state">
          <NEmpty description="暂无数据"></NEmpty>
        </div>
      </div>
    </NModal>
  </div>
</template>

<script setup>
import { computed, h, nextTick, onMounted, ref } from "vue";
import {
  NAvatar,
  NButton,
  NDataTable,
  NEmpty,
  NIcon,
  NModal,
  NSpin,
  useMessage,
} from "naive-ui/es";
import { Copy, Refresh } from "@vicons/ionicons5";
import { useTokenStore } from "@/stores/tokenStore";
import { gettoday } from "@/utils/clubWarrankUtils";
import { captureWithHtml2canvas } from "@/utils/html2canvasLoader";
import { downloadCanvasAsImage } from "@/utils/imageExport";

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  inline: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:visible"]);

const exportDom = ref(null);
const message = useMessage();
const tokenStore = useTokenStore();
const isExporting = ref(false);
const loading = ref(false);
const memberScores = ref([]);

const showModal = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val),
});

const buildHeaderActions = () => {
  if (isExporting.value) {
    return null;
  }

  return h("div", { style: { display: "flex", gap: "8px" } }, [
    h(
      NButton,
      {
        size: "tiny",
        type: "primary",
        secondary: true,
        disabled: loading.value,
        onClick: (e) => {
          e.stopPropagation();
          handleRefresh();
        },
      },
      {
        default: () => "刷新",
        icon: () => h(NIcon, null, { default: () => h(Refresh) }),
      },
    ),
    h(
      NButton,
      {
        size: "tiny",
        type: "info",
        secondary: true,
        disabled: isExporting.value,
        onClick: (e) => {
          e.stopPropagation();
          handleExport();
        },
      },
      {
        default: () => "导出图片",
        icon: () => h(NIcon, null, { default: () => h(Copy) }),
      },
    ),
  ]);
};

const columns = computed(() => {
  const baseColumns = [
    {
      title: "序号",
      key: "index",
      width: 60,
      align: "center",
      render: (_row, index) => index + 1,
    },
    {
      title: "头像",
      key: "headImg",
      width: 60,
      align: "center",
      render: (row) => {
        if (row.headImg) {
          return h(NAvatar, {
            size: 32,
            src: row.headImg,
            round: true,
            fallbackSrc: "/icons/xiaoyugan.png",
          });
        }

        return h(
          "div",
          {
            style: {
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "#f0f0f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              color: "#999",
              margin: "0 auto",
            },
          },
          row.name?.charAt(0) || "?",
        );
      },
    },
    {
      title: "成员",
      key: "name",
      align: "left",
      render: (row) =>
        h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              whiteSpace: "nowrap",
            },
          },
          [
            h(
              "span",
              {
                style: {
                  fontWeight: "500",
                  color: "#1890ff",
                  lineHeight: "1.2",
                },
              },
              row.name,
            ),
            h(
              "span",
              {
                style: {
                  fontSize: "12px",
                  color: "#999",
                  lineHeight: "1.2",
                  marginTop: "2px",
                },
              },
              `ID: ${row.roleId}`,
            ),
          ],
        ),
    },
    {
      title: "赛车积分",
      key: "score",
      align: "center",
      render: (row) => row.score || "0",
    },
  ];

  if (!props.inline) {
    return baseColumns;
  }

  return [
    {
      title: () =>
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              padding: "0 8px",
            },
          },
          [
            h(
              "span",
              {
                style: {
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: "#333",
                },
              },
              "俱乐部赛车信息",
            ),
            buildHeaderActions(),
          ],
        ),
      key: "title_group",
      align: "center",
      children: baseColumns,
    },
  ];
});

const fetchWeirdTowerInfo = async () => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择游戏角色");
    return;
  }

  const tokenId = tokenStore.selectedToken.id;
  const wsStatus = tokenStore.getWebSocketStatus(tokenId);
  if (wsStatus !== "connected") {
    message.error("WebSocket未连接，无法查询爬塔数据");
    return;
  }

  loading.value = true;

  try {
    const result = await tokenStore.sendMessageWithPromise(
      tokenId,
      "car_getmemberrank",
      {},
      10000,
    );

    const clubMembers = tokenStore.gameData?.legionInfo?.info?.members || {};
    const allMembers = Object.values(clubMembers);
    const participantMap = new Map();
    if (result?.list) {
      result.list.forEach((member) => {
        participantMap.set(member.roleId, member);
      });
    }

    let members = [];
    if (allMembers.length > 0) {
      members = allMembers.map((member) => {
        const participant = participantMap.get(member.roleId);
        return {
          roleId: member.roleId,
          name: member.name,
          headImg: member.headImg,
          score: participant ? participant.score : 0,
          power: member.power,
          rank: participant ? participant.rank : 9999,
          serverId: member.serverId,
        };
      });
    } else if (result?.list) {
      members = result.list.map((member) => ({
        roleId: member.roleId,
        name: member.name,
        headImg: member.headImg?.replace(/`/g, "").trim(),
        score: member.score,
        power: member.power,
        rank: member.rank,
        serverId: member.serverId,
      }));
    }

    members.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (b.power || 0) - (a.power || 0);
    });

    memberScores.value = members;

    if (members.length > 0) {
      message.success("赛车数据加载成功，已按积分从高到低排序");
    } else {
      message.warning("未查询到数据");
    }
  } catch (error) {
    console.error("查询赛车数据失败:", error);
    message.error(`查询失败: ${error.message}`);
    memberScores.value = [];
  } finally {
    loading.value = false;
  }
};

const handleRefresh = () => {
  fetchWeirdTowerInfo();
};

const exportToImage = async () => {
  if (!exportDom.value) {
    throw new Error("未找到要导出的DOM元素");
  }

  const canvas = await captureWithHtml2canvas(exportDom.value, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const dateStr = gettoday();
  const filename = `${dateStr.replace("/", "年").replace("/", "月")}日俱乐部赛车数据.png`;
  downloadCanvasAsImage(canvas, filename);
};

const handleExport = async () => {
  if (!memberScores.value.length) {
    message.warning("没有可导出的数据");
    return;
  }

  try {
    isExporting.value = true;
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await exportToImage();
    message.success("导出成功");
  } catch (error) {
    console.error("导出失败:", error);
    message.error("导出失败，请重试");
  } finally {
    isExporting.value = false;
  }
};

const handleClose = () => {};

defineExpose({
  fetchWeirdTowerInfo,
});

onMounted(() => {
  if (props.inline) {
    fetchWeirdTowerInfo();
  }
});
</script>

<style scoped lang="scss">
.inline-wrapper {
  background: var(--bg-primary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-md);
}

.inline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
  flex-wrap: wrap;
}

.inline-title {
  font-weight: var(--font-weight-semibold);
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.weird-tower-content {
  min-height: 200px;
}

.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.records-info {
  display: flex;
  gap: var(--spacing-md);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--border-light);
  align-items: center;
}

.member-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-sm);
  transition: all var(--transition-fast);

  &:hover {
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  & + & {
    margin-top: var(--spacing-sm);
  }
}

.member-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.member-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 200px;
  max-width: 200px;
  flex-shrink: 0;
}

.ranking-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  flex-shrink: 0;
}

.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.member-avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  flex-shrink: 0;
}

.member-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.member-stats-inline {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
  flex: 1;
}

.stat-inline {
  padding: 4px 8px;
  border-radius: var(--border-radius-small);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tower-count {
  background: rgba(32, 192, 80, 0.1);
  color: var(--color-success);
}
</style>
