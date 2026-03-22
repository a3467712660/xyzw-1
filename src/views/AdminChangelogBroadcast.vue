<template>
  <div class="broadcast-page">
    <div class="broadcast-container">
      <section class="hero">
        <h1>更新日志广播</h1>
        <p>将最新更新日志作为站内通知发送给全部账户，点击通知可直接打开更新日志页面。</p>
      </section>

      <section class="panel">
        <div class="field">
          <label>版本号</label>
          <n-input placeholder="例如：2026.03.12" v-model:value="form.version"></n-input>
        </div>
        <div class="field">
          <label>通知标题</label>
          <n-input placeholder="例如：系统更新通知" v-model:value="form.title"></n-input>
        </div>
        <div class="field">
          <label>通知内容</label>
          <n-input
            show-count
            maxlength="240"
            placeholder="例如：已发布新版本，点击查看详情"
            type="textarea"
            v-model:value="form.content"
            :rows="4"
          ></n-input>
        </div>
        <div class="actions">
          <n-button type="primary" :loading="isSending" @click="handleSend">
            发送到所有账户
          </n-button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from "vue";
import { useMessage } from "naive-ui/es";
import { useChangelogStore } from "@/stores/changelogStore";
import api from "@/api";

const message = useMessage();
const changelogStore = useChangelogStore();
const latest = changelogStore.latestVersion;

const form = reactive({
  version: latest?.version || "",
  title: latest?.title || (latest?.version ? `更新日志 ${latest.version}` : ""),
  content: latest?.version
    ? `已发布 ${latest.version} 版本，点击查看详情`
    : "已发布新版本，点击查看详情",
});
const isSending = ref(false);

const handleSend = async () => {
  const version = String(form.version || "").trim();
  if (!version) {
    message.error("请先填写版本号");
    return;
  }

  isSending.value = true;
  try {
    const res = await api.admin.notifyChangelogToAll({
      version,
      title: String(form.title || "").trim() || `更新日志 ${version}`,
      content: String(form.content || "").trim() || `已发布 ${version} 版本，点击查看详情`,
      path: "/changelog",
    });
    if (!res?.success) {
      message.error(res?.message || "发送失败");
      return;
    }
    message.success(`发送成功，已通知 ${res?.data?.sentCount ?? 0} 个账号`);
  } catch (error) {
    message.error(error?.message || "发送失败");
  } finally {
    isSending.value = false;
  }
};
</script>

<style scoped lang="scss">
.broadcast-page {
  min-height: 100dvh;
  padding: var(--spacing-lg);
}

.broadcast-container {
  max-width: 900px;
  margin: 0 auto;
  display: grid;
  gap: var(--spacing-md);
}

.hero {
  padding: var(--spacing-lg);
  border-radius: var(--border-radius-large);
  background: var(--surface-glass);
  border: 1px solid var(--surface-glass-border);
  box-shadow: var(--shadow-light);
}

.hero h1 {
  margin: 0;
  font-size: var(--font-size-2xl);
  color: var(--text-primary);
}

.hero p {
  margin: var(--spacing-sm) 0 0;
  color: var(--text-secondary);
}

.panel {
  padding: var(--spacing-lg);
  border-radius: var(--border-radius-large);
  background: var(--surface-glass-strong);
  border: 1px solid var(--surface-glass-border);
  box-shadow: var(--shadow-light);
  display: grid;
  gap: var(--spacing-md);
}

.field {
  display: grid;
  gap: 8px;
}

.field label {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}

.actions {
  margin-top: var(--spacing-xs);
}

@media (max-width: 768px) {
  .broadcast-page {
    padding: var(--spacing-md);
  }
}
</style>
