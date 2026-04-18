<template>
  <div class="broadcast-page admin-surface-page">
    <div class="container broadcast-container">
      <div class="page-header">
        <div class="page-header__main">
          <h1>更新日志广播</h1>
          <p>将最新更新日志作为站内通知发送给全部账户，点击通知后直接打开更新日志页面。</p>
        </div>
        <div class="page-header__actions">
          <n-button type="primary" :loading="isSending" @click="handleSend">
            发送到所有账户
          </n-button>
        </div>
      </div>

      <div class="page-overview">
        <div class="overview-card">
          <span class="overview-label">当前版本</span>
          <strong class="overview-value">{{ versionDisplay }}</strong>
        </div>
        <div class="overview-card">
          <span class="overview-label">标题字数</span>
          <strong class="overview-value">{{ titleLength }}</strong>
        </div>
        <div class="overview-card">
          <span class="overview-label">内容字数</span>
          <strong class="overview-value">{{ contentLength }}</strong>
        </div>
        <div class="overview-card">
          <span class="overview-label">跳转路径</span>
          <strong class="overview-value overview-value--path">/changelog</strong>
        </div>
      </div>

      <div class="broadcast-grid">
        <n-card embedded class="list-card">
          <div class="list-card__head">
            <div>
              <h2>广播内容</h2>
              <span>保留当前发送逻辑，只统一输入区层级和说明信息。</span>
            </div>
          </div>

          <div class="broadcast-form">
            <div class="field">
              <label>版本号</label>
              <n-input placeholder="例如：2026.03.12" v-model:value="form.version"></n-input>
              <span class="field__hint">为空时不会阻止输入其它字段，但发送前必须填写。</span>
            </div>

            <div class="field">
              <label>通知标题</label>
              <n-input
                placeholder="例如：系统更新通知"
                v-model:value="form.title"
              ></n-input>
              <span class="field__hint">留空时会自动回退为“更新日志 {{ versionDisplay }}”。</span>
            </div>

            <div class="field">
              <label>通知内容</label>
              <n-input
                show-count
                maxlength="240"
                placeholder="例如：已发布新版本，点击查看详情"
                type="textarea"
                v-model:value="form.content"
                :rows="5"
              ></n-input>
              <span class="field__hint">建议保持在一屏内读完，突出版本和点击动作。</span>
            </div>
          </div>
        </n-card>

        <n-card embedded class="list-card">
          <div class="list-card__head">
            <div>
              <h2>发送预览</h2>
              <span>预览通知内容和固定跳转路径，方便发出前复核。</span>
            </div>
          </div>

          <div aria-live="polite" class="broadcast-preview">
            <div class="broadcast-preview__meta">
              <span class="chip">全部账户</span>
              <span class="type-chip">/changelog</span>
            </div>

            <div class="broadcast-preview__card">
              <span class="broadcast-preview__eyebrow">
                {{ versionDisplay === "未填写" ? "待填写版本" : `版本 ${versionDisplay}` }}
              </span>
              <strong class="broadcast-preview__title">{{ previewTitle }}</strong>
              <p class="broadcast-preview__content">{{ previewContent }}</p>
              <div class="broadcast-preview__footer">
                <span class="info-label">通知路径</span>
                <strong>/changelog</strong>
              </div>
            </div>

            <ul class="broadcast-notes">
              <li>发送后会向全部账户下发站内通知。</li>
              <li>用户点击通知后直接进入更新日志页面。</li>
              <li>标题和内容的默认兜底逻辑保持现有实现。</li>
            </ul>
          </div>
        </n-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
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

const versionDisplay = computed(
  () => String(form.version || "").trim() || "未填写",
);
const titleLength = computed(() => String(form.title || "").trim().length);
const contentLength = computed(() => String(form.content || "").trim().length);
const previewTitle = computed(
  () => String(form.title || "").trim() || `更新日志 ${versionDisplay.value}`,
);
const previewContent = computed(
  () =>
    String(form.content || "").trim()
    || `已发布 ${versionDisplay.value} 版本，点击查看详情`,
);

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
.broadcast-page.admin-surface-page {
  .broadcast-container {
    max-width: 1240px;
    padding: 0 16px;
    gap: 16px;
  }

  .broadcast-grid {
    gap: 16px;
  }

  .list-card {
    border-radius: 24px;
  }

  .broadcast-preview__card {
    border-radius: 20px;
  }
}

.broadcast-page {
  min-height: 100dvh;
  padding: 16px 0;
}

.broadcast-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 14px;
  display: grid;
  gap: 12px;
}

.page-header__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.overview-value--path {
  font-size: clamp(20px, 2vw, 28px);
}

.broadcast-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.9fr);
  gap: 12px;
  align-items: start;
}

.list-card {
  border-radius: 22px;
  border: 1px solid var(--surface-glass-border);
  background:
    linear-gradient(135deg, rgba(15, 107, 255, 0.08), transparent 78%),
    var(--surface-glass-strong);
  box-shadow: var(--shadow-light);
  backdrop-filter: blur(12px);
}

.broadcast-form,
.broadcast-preview {
  display: grid;
  gap: 16px;
}

.field {
  display: grid;
  gap: 8px;
}

.field label {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 700;
}

.field__hint {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.broadcast-preview__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.broadcast-preview__card {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--surface-glass-border);
  background: var(--console-panel);
}

.broadcast-preview__eyebrow {
  font-size: 12px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-family: var(--font-family-mono);
}

.broadcast-preview__title {
  color: var(--text-primary);
  font-size: 20px;
  line-height: 1.3;
}

.broadcast-preview__content {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.7;
}

.broadcast-preview__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--console-divider);
}

.broadcast-notes {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 8px;
  color: var(--text-secondary);
  line-height: 1.6;
}

@media (max-width: 960px) {
  .broadcast-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .broadcast-page {
    padding: 12px 0;
  }

  .broadcast-container {
    padding: 0 12px;
  }

  .broadcast-preview__footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
