<template>
  <div class="game-roles-page app-page">
    <section class="app-page__hero">
      <div class="app-page__hero-copy">
        <span class="app-page__eyebrow">角色管理</span>
        <h1 class="app-page__title">{{ t("gameRolesPage.title") }}</h1>
        <p class="app-page__description">
          {{ heroDescription }}
        </p>
        <div class="app-chip-row">
          <span class="app-inline-stat">
            <strong>{{ gameRolesStore.gameRoles.length }}</strong>
            角色总数
          </span>
          <span class="app-inline-stat">
            <strong>{{ activeRoleCount }}</strong>
            在线角色
          </span>
          <span class="app-inline-stat">
            <strong>{{ gameRolesStore.selectedRole?.name || "未选择" }}</strong>
            当前主角色
          </span>
        </div>
      </div>

      <div class="app-page__actions">
        <n-button size="large" type="primary" @click="showAddModal = true">
          <template #icon>
            <n-icon><Add></Add></n-icon>
          </template>
          {{ t("gameRolesPage.actions.addRole") }}
        </n-button>
      </div>
    </section>

    <div class="app-page__summary">
      <article v-for="card in summaryCards" :key="card.label" class="app-summary-card">
        <span class="app-summary-card__label">{{ card.label }}</span>
        <strong class="app-summary-card__value">{{ card.value }}</strong>
        <span class="app-summary-card__meta">{{ card.meta }}</span>
      </article>
    </div>

    <section class="app-section-card roles-section">
      <div class="section-head">
        <div>
          <h2>角色列表</h2>
          <p>桌面端保持卡片矩阵，移动端自动收成单列，切换主角色和编辑逻辑不变。</p>
        </div>
      </div>

      <div v-if="gameRolesStore.gameRoles.length" class="roles-grid">
        <div
          v-for="role in gameRolesStore.gameRoles"
          :key="role.id"
          class="role-card"
          :class="{ active: role.id === gameRolesStore.selectedRole?.id }"
          @click="selectRole(role)"
        >
          <div class="card-header">
            <div class="role-avatar">
              <img
                :alt="role.name"
                :src="role.avatar || '/icons/xiaoyugan.png'"
              >
            </div>
            <div class="role-actions">
              <n-dropdown
                :options="roleMenuOptions"
                @select="(key) => handleRoleAction(key, role)"
              >
                <n-button text>
                  <template #icon>
                    <n-icon><EllipsisHorizontal></EllipsisHorizontal></n-icon>
                  </template>
                </n-button>
              </n-dropdown>
            </div>
          </div>

          <div class="card-body">
            <h3 class="role-name">
              {{ role.name }}
            </h3>
            <p class="role-info">{{ role.server }} | {{ role.level }}{{ t("gameRolesPage.labels.levelUnit") }}</p>
            <div class="role-tags">
              <n-tag size="small" :type="role.isActive ? 'success' : 'default'">
                {{ role.isActive ? t("gameRolesPage.status.active") : t("gameRolesPage.status.offline") }}
              </n-tag>
              <n-tag v-if="role.vip" size="small"> VIP </n-tag>
            </div>
          </div>

          <div class="card-footer">
            <div class="role-stats">
              <div class="stat-item">
                <span class="stat-label">{{ t("gameRolesPage.labels.exp") }}</span>
                <span class="stat-value">{{ role.exp || "0" }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">{{ t("gameRolesPage.labels.gold") }}</span>
                <span class="stat-value">{{ formatNumber(role.gold || 0) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-state app-empty-card">
        <n-empty size="large" :description="t('gameRolesPage.empty.description')">
          <template #icon>
            <n-icon size="64">
              <PersonCircle></PersonCircle>
            </n-icon>
          </template>
          <template #extra>
            <n-button size="large" type="primary" @click="showAddModal = true">
              {{ t("gameRolesPage.empty.addFirst") }}
            </n-button>
          </template>
        </n-empty>
      </div>
    </section>

    <n-modal
      preset="card"
      style="width: min(500px, calc(100vw - 24px))"
      v-model:show="showAddModal"
      :title="editingRole ? t('gameRolesPage.modal.editTitle') : t('gameRolesPage.modal.addTitle')"
    >
      <n-form
        ref="roleFormRef"
        label-placement="left"
        label-width="80px"
        :model="roleForm"
        :rules="roleRules"
      >
        <n-form-item path="name" :label="t('gameRolesPage.form.name')">
          <n-input
            v-model:value="roleForm.name"
            :placeholder="t('gameRolesPage.placeholders.name')"
          ></n-input>
        </n-form-item>

        <n-form-item path="server" :label="t('gameRolesPage.form.server')">
          <n-select
            v-model:value="roleForm.server"
            :options="serverOptions"
            :placeholder="t('gameRolesPage.placeholders.server')"
          ></n-select>
        </n-form-item>

        <n-form-item path="profession" :label="t('gameRolesPage.form.profession')">
          <n-select
            v-model:value="roleForm.profession"
            :options="professionOptions"
            :placeholder="t('gameRolesPage.placeholders.profession')"
          ></n-select>
        </n-form-item>

        <n-form-item path="level" :label="t('gameRolesPage.form.level')">
          <n-input-number
            v-model:value="roleForm.level"
            :max="200"
            :min="1"
            :placeholder="t('gameRolesPage.placeholders.level')"
          ></n-input-number>
        </n-form-item>

        <n-form-item :label="t('gameRolesPage.form.account')">
          <n-input
            v-model:value="roleForm.account"
            :placeholder="t('gameRolesPage.placeholders.account')"
          ></n-input>
        </n-form-item>

        <n-form-item :label="t('gameRolesPage.form.note')">
          <n-input
            type="textarea"
            v-model:value="roleForm.note"
            :placeholder="t('gameRolesPage.placeholders.note')"
            :rows="3"
          ></n-input>
        </n-form-item>
      </n-form>

      <template #footer>
        <div class="modal-actions">
          <n-button @click="showAddModal = false">{{ t("gameRolesPage.actions.cancel") }}</n-button>
          <n-button
            type="primary"
            :loading="isSubmitting"
            @click="handleSubmit"
          >
            {{ editingRole ? t("gameRolesPage.actions.save") : t("gameRolesPage.actions.add") }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useDialog, useMessage } from "naive-ui/es";
import { useGameRolesStore } from "@/stores/gameRoles";
import { Add, EllipsisHorizontal, PersonCircle } from "@vicons/ionicons5";

const message = useMessage();
const dialog = useDialog();
const { t } = useI18n();
const gameRolesStore = useGameRolesStore();

const showAddModal = ref(false);
const isSubmitting = ref(false);
const editingRole = ref(null);
const roleFormRef = ref(null);

const roleForm = reactive({
  name: "",
  server: "",
  profession: "",
  level: 1,
  account: "",
  note: "",
});

const roleRules = {
  name: [{ required: true, message: t("gameRolesPage.validation.name"), trigger: "blur" }],
  server: [{ required: true, message: t("gameRolesPage.validation.server"), trigger: "change" }],
  profession: [{ required: true, message: t("gameRolesPage.validation.profession"), trigger: "change" }],
  level: [
    {
      required: true,
      type: "number",
      message: t("gameRolesPage.validation.level"),
      trigger: "blur",
    },
  ],
};

const serverOptions = [
  { label: t("gameRolesPage.options.servers.fengyun"), value: "风云服" },
  { label: t("gameRolesPage.options.servers.shenhua"), value: "神话服" },
  { label: t("gameRolesPage.options.servers.chuanqi"), value: "传奇服" },
  { label: t("gameRolesPage.options.servers.menghuan"), value: "梦幻服" },
  { label: t("gameRolesPage.options.servers.yingxiong"), value: "英雄服" },
];

const professionOptions = [
  { label: t("gameRolesPage.options.professions.warrior"), value: "战士" },
  { label: t("gameRolesPage.options.professions.mage"), value: "法师" },
  { label: t("gameRolesPage.options.professions.taoist"), value: "道士" },
  { label: t("gameRolesPage.options.professions.assassin"), value: "刺客" },
  { label: t("gameRolesPage.options.professions.archer"), value: "弓手" },
  { label: t("gameRolesPage.options.professions.priest"), value: "牧师" },
];

const roleMenuOptions = [
  { label: t("gameRolesPage.menu.edit"), key: "edit" },
  { label: t("gameRolesPage.menu.setPrimary"), key: "set-primary" },
  { label: t("gameRolesPage.menu.viewDetails"), key: "view-details" },
  { type: "divider" },
  { label: t("gameRolesPage.menu.delete"), key: "delete" },
];

const activeRoleCount = computed(() =>
  gameRolesStore.gameRoles.filter((role) => role.isActive).length,
);

const heroDescription = computed(() => {
  if (!gameRolesStore.gameRoles.length) {
    return "还没有添加角色。先建一个角色卡，后续任务页、控制台和游戏功能页都会复用这里的基础资料。";
  }

  return `当前共 ${gameRolesStore.gameRoles.length} 个角色，已按统一壳层重排为桌面端卡片矩阵和手机端单列流式布局。切换主角色、编辑和删除逻辑保持不变。`;
});

const summaryCards = computed(() => [
  {
    label: "角色总数",
    value: String(gameRolesStore.gameRoles.length),
    meta: "集中管理角色资料与主角色选择",
  },
  {
    label: "在线角色",
    value: String(activeRoleCount.value),
    meta: activeRoleCount.value ? "可直接切换使用" : "当前暂无在线角色标记",
  },
  {
    label: "当前主角色",
    value: gameRolesStore.selectedRole?.name || "未选择",
    meta: gameRolesStore.selectedRole?.server || "点击卡片可切换主角色",
  },
  {
    label: "角色职业数",
    value: String(new Set(gameRolesStore.gameRoles.map((role) => role.profession).filter(Boolean)).size),
    meta: "保留原有数据结构，仅优化展示层",
  },
]);

const selectRole = (role) => {
  gameRolesStore.selectRole(role);
  message.success(t("gameRolesPage.messages.switchedRole", { name: role.name }));
};

const handleRoleAction = async (key, role) => {
  switch (key) {
    case "edit":
      editRole(role);
      break;
    case "set-primary":
      selectRole(role);
      break;
    case "view-details":
      viewRoleDetails(role);
      break;
    case "delete":
      deleteRole(role);
      break;
  }
};

const editRole = (role) => {
  editingRole.value = role;
  Object.assign(roleForm, role);
  showAddModal.value = true;
};

const viewRoleDetails = () => {
  message.info(t("gameRolesPage.messages.detailsInProgress"));
};

const deleteRole = (role) => {
  dialog.warning({
    title: t("gameRolesPage.dialog.deleteTitle"),
    content: t("gameRolesPage.dialog.deleteContent", { name: role.name }),
    positiveText: t("gameRolesPage.dialog.confirmDelete"),
    negativeText: t("gameRolesPage.actions.cancel"),
    onPositiveClick: async () => {
      const result = await gameRolesStore.deleteGameRole(role.id);
      if (result.success) {
        message.success(result.message);
      } else {
        message.error(result.message);
      }
    },
  });
};

const handleSubmit = async () => {
  if (!roleFormRef.value) {
    return;
  }

  try {
    await roleFormRef.value.validate();
    isSubmitting.value = true;

    let result;
    if (editingRole.value) {
      result = await gameRolesStore.updateGameRole(
        editingRole.value.id,
        roleForm,
      );
    } else {
      result = await gameRolesStore.addGameRole(roleForm);
    }

    if (result.success) {
      message.success(result.message);
      showAddModal.value = false;
      resetForm();
    } else {
      message.error(result.message);
    }
  } catch {
    // 表单验证失败
  } finally {
    isSubmitting.value = false;
  }
};

const resetForm = () => {
  Object.keys(roleForm).forEach((key) => {
    roleForm[key] = key === "level" ? 1 : "";
  });
  editingRole.value = null;
};

const formatNumber = (num) => {
  if (num >= 100000000) {
    return t("gameRolesPage.units.yi", { value: (num / 100000000).toFixed(1) });
  }
  if (num >= 10000) {
    return t("gameRolesPage.units.wan", { value: (num / 10000).toFixed(1) });
  }
  return num.toString();
};

onMounted(async () => {
  if (gameRolesStore.gameRoles.length === 0) {
    await gameRolesStore.fetchGameRoles();
  }
});
</script>

<style scoped lang="scss">
.game-roles-page {
  min-height: 100dvh;
  padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom));
  animation: roles-fade-in 0.38s ease;
}

.roles-section {
  padding: clamp(18px, 2vw, 24px);
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);

  h2 {
    margin: 0 0 6px;
    font-size: var(--font-size-xl);
    color: var(--text-primary);
  }

  p {
    margin: 0;
    color: var(--text-secondary);
    line-height: 1.6;
  }
}

.roles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-lg);
}

.role-card {
  background: var(--bg-elevated);
  border-radius: var(--border-radius-large);
  box-shadow: var(--shadow-light);
  overflow: hidden;
  cursor: pointer;
  transition: all var(--transition-normal);
  border: 1px solid var(--border-light);

  &:hover {
    box-shadow: var(--shadow-medium);
    transform: translateY(-3px);
    border-color: rgba(15, 107, 255, 0.26);
  }

  &.active {
    border-color: var(--primary-color);
    box-shadow:
      0 0 0 3px rgba(15, 107, 255, 0.12),
      var(--shadow-medium);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg) var(--spacing-lg) 0;
}

.role-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid var(--border-light);
  box-shadow: var(--shadow-light);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.role-actions {
  opacity: 0;
  transition: opacity var(--transition-fast);

  .role-card:hover & {
    opacity: 1;
  }
}

.card-body {
  padding: var(--spacing-md) var(--spacing-lg);
  text-align: center;
}

.role-name {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.role-info {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-md);
}

.role-tags {
  display: flex;
  gap: var(--spacing-xs);
  justify-content: center;
  flex-wrap: wrap;
}

.card-footer {
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
  border-top: 1px solid var(--border-light);
}

.role-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.stat-item {
  text-align: center;
}

.stat-label {
  display: block;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  margin-bottom: var(--spacing-xs);
}

.stat-value {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
}

.empty-state {
  min-height: 300px;
}

.modal-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .game-roles-page :deep(.n-button) {
    min-height: 40px;
  }

  .roles-section {
    padding: var(--spacing-lg);
  }

  .roles-grid {
    grid-template-columns: 1fr;
  }

  .role-stats {
    grid-template-columns: 1fr;
  }

  .role-actions {
    opacity: 1;
  }

  .modal-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}

@keyframes roles-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
