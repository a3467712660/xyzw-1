<template>
  <div class="temp-page">
    <div class="temp-shell">
      <section class="temp-header">
        <button class="back-btn" type="button" @click="goBack">
          ← {{ t("temporaryInvites.actions.back") }}
        </button>
        <h1>{{ t("temporaryInvites.title") }}</h1>
        <p>{{ t("temporaryInvites.subtitle") }}</p>
      </section>

      <section class="temp-panel">
        <div class="panel-actions">
          <n-button secondary :loading="isLoading" @click="loadCodes">
            {{ t("temporaryInvites.actions.refresh") }}
          </n-button>
        </div>

        <div v-if="codes.length" class="codes-grid">
          <article v-for="item in codes" :key="item.id" class="code-card">
            <div class="code-line">{{ item.code }}</div>
            <div class="meta-line">
              {{ t("temporaryInvites.fields.expiresAt") }}: {{ formatDate(item.expiresAt) }}
            </div>
            <n-button size="small" @click="copyCode(item.code)">
              {{ t("temporaryInvites.actions.copy") }}
            </n-button>
          </article>
        </div>

        <n-empty v-else :description="t('temporaryInvites.empty')"></n-empty>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import api from "@/api";

const router = useRouter();
const message = useMessage();
const { t } = useI18n();
const codes = ref([]);
const isLoading = ref(false);

const formatDate = (value) => (value ? new Date(value).toLocaleString() : "-");

const loadCodes = async () => {
  isLoading.value = true;
  try {
    const res = await api.auth.listTemporaryInvites(20);
    if (!res?.success) {
      message.error(res?.message || t("temporaryInvites.messages.loadFailed"));
      return;
    }
    codes.value = Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    message.error(error?.message || t("temporaryInvites.messages.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const copyCode = async (code) => {
  try {
    await navigator.clipboard.writeText(String(code || ""));
    message.success(t("temporaryInvites.messages.copySuccess"));
  } catch {
    message.error(t("temporaryInvites.messages.copyFailed"));
  }
};

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push("/login");
};

onMounted(() => {
  loadCodes();
});
</script>

<style scoped lang="scss">
.temp-page {
  min-height: 100dvh;
  padding: 20px;
}

.temp-shell {
  max-width: 920px;
  margin: 0 auto;
  display: grid;
  gap: var(--spacing-md);
}

.temp-header,
.temp-panel {
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-large);
  background: var(--surface-glass);
  box-shadow: var(--shadow-light);
  padding: var(--spacing-lg);
}

.temp-header h1 {
  margin: var(--spacing-sm) 0 0;
  color: var(--text-primary);
}

.temp-header p {
  margin: 8px 0 0;
  color: var(--text-secondary);
}

.back-btn {
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-medium);
  background: var(--bg-elevated);
  color: var(--text-primary);
  cursor: pointer;
}

.panel-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--spacing-sm);
}

.codes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--spacing-sm);
}

.code-card {
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-medium);
  background: var(--surface-glass-strong);
  padding: 14px;
  display: grid;
  gap: 8px;
}

.code-line {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.meta-line {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}
</style>
