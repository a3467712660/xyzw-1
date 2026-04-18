<template>
  <div class="public-support-page wechat-contact-page">
    <div aria-hidden="true" class="public-support-page__backdrop"></div>

    <div class="public-support-container public-support-container--narrow">
      <button class="public-support-back" type="button" @click="router.push('/pricing')">
        返回价格菜单
      </button>

      <n-spin :show="loading">
        <section
          v-if="status === 'ready' && contact"
          class="public-support-panel wechat-contact-page__panel"
        >
          <div class="wechat-contact-page__head">
            <div>
              <span class="public-support-eyebrow">微信联系</span>
              <h1 class="public-support-title">{{ contact.title }}</h1>
              <p
                v-if="contact.subtitle"
                class="public-support-description"
              >
                {{ contact.subtitle }}
              </p>
            </div>

            <div class="wechat-contact-page__chips">
              <span class="support-chip">{{ contactTypeLabel }}</span>
              <span v-if="targetHostname" class="support-chip support-chip--accent">
                {{ targetHostname }}
              </span>
            </div>
          </div>

          <template v-if="contact.contactType === 'landing_qr'">
            <div class="wechat-contact-page__ready-grid">
              <div class="wechat-contact-page__qr-shell">
                <img
                  :alt="`${contact.title || '微信联系'} 二维码`"
                  :src="contact.qrImageDataUrl"
                >
              </div>

              <div class="wechat-contact-page__info">
                <div class="public-support-meta-grid">
                  <div class="public-support-meta-card">
                    <span>联系类型</span>
                    <strong>{{ contactTypeLabel }}</strong>
                  </div>
                  <div class="public-support-meta-card">
                    <span>微信号</span>
                    <strong>{{ contact.wechatId || "未提供" }}</strong>
                  </div>
                </div>

                <div class="public-support-note">
                  <strong>使用方式：</strong>
                  保存二维码或复制微信号后，在微信中搜索并联系对应入口。
                </div>

                <div class="public-support-actions">
                  <n-button
                    type="primary"
                    :disabled="!contact.wechatId"
                    @click="copyWechatId"
                  >
                    复制微信号
                  </n-button>
                  <n-button @click="router.push('/pricing')">返回价格菜单</n-button>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="contact.contactType === 'external_url'">
            <div class="public-support-note">
              <strong>即将离开本站：</strong>
              目标站点为 {{ targetHostname || "链接解析失败" }}。请确认这是你期望打开的联系入口。
            </div>

            <div class="public-support-meta-grid">
              <div class="public-support-meta-card">
                <span>链接类型</span>
                <strong>{{ contactTypeLabel }}</strong>
              </div>
              <div class="public-support-meta-card">
                <span>目标站点</span>
                <strong>{{ targetHostname || "无效链接" }}</strong>
              </div>
            </div>

            <div class="public-support-actions">
              <n-button
                type="primary"
                :disabled="!safeTargetUrl"
                @click="goToTarget"
              >
                继续前往
              </n-button>
              <n-button @click="router.push('/pricing')">返回价格菜单</n-button>
            </div>
          </template>

          <template v-else>
            <div class="public-support-note">
              <strong>正在跳转：</strong>
              当前入口会直接跳转到企业微信客服。如果没有自动打开，请使用下方按钮继续。
            </div>

            <div class="public-support-meta-grid">
              <div class="public-support-meta-card">
                <span>联系类型</span>
                <strong>{{ contactTypeLabel }}</strong>
              </div>
              <div class="public-support-meta-card">
                <span>目标站点</span>
                <strong>{{ targetHostname || "企业微信客服" }}</strong>
              </div>
            </div>

            <div class="public-support-actions">
              <n-button type="primary" @click="goToTarget">立即跳转</n-button>
              <n-button @click="router.push('/pricing')">返回价格菜单</n-button>
            </div>
          </template>
        </section>

        <section
          v-else-if="status === 'loading'"
          class="public-support-panel wechat-contact-page__state-panel"
        >
          <span class="public-support-eyebrow">微信联系</span>
          <h1 class="public-support-title">正在加载联系入口</h1>
          <p class="public-support-description">
            正在读取当前链接对应的公开联系信息，请稍候。
          </p>
        </section>

        <section
          v-else-if="status === 'missing'"
          class="public-support-panel wechat-contact-page__state-panel"
        >
          <span class="public-support-eyebrow">微信联系</span>
          <h1 class="public-support-title">联系人不存在或已停用</h1>
          <p class="public-support-description">
            这个联系入口可能已被下线，请返回价格菜单查看最新入口。
          </p>
          <div class="public-support-actions">
            <n-button type="primary" @click="router.push('/pricing')">
              返回价格菜单
            </n-button>
          </div>
        </section>

        <section
          v-else-if="status === 'error'"
          class="public-support-panel wechat-contact-page__state-panel"
        >
          <span class="public-support-eyebrow">微信联系</span>
          <h1 class="public-support-title">联系人加载失败</h1>
          <p class="public-support-description">
            {{ errorText || "请稍后再试" }}
          </p>
          <div class="public-support-actions">
            <n-button type="primary" @click="loadContact">重试</n-button>
            <n-button @click="router.push('/pricing')">返回价格菜单</n-button>
          </div>
        </section>
      </n-spin>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useMessage } from "naive-ui/es";
import { useRoute, useRouter } from "vue-router";
import api from "@/api";

const route = useRoute();
const router = useRouter();
const message = useMessage();

const loading = ref(false);
const status = ref("loading");
const errorText = ref("");
const contact = ref(null);

const contactTypeLabelMap = {
  landing_qr: "二维码落地页",
  external_url: "外部链接",
  wecom_kf_link: "企业微信客服",
};

const contactTypeLabel = computed(
  () => contactTypeLabelMap[contact.value?.contactType] || "公开联系入口",
);

const safeTargetUrl = computed(() => {
  const raw = String(contact.value?.targetUrl || "").trim();
  if (!raw) {
    return "";
  }
  try {
    return new URL(raw).toString();
  } catch {
    return "";
  }
});

const targetHostname = computed(() => {
  if (!safeTargetUrl.value) {
    return "";
  }
  try {
    return new URL(safeTargetUrl.value).hostname || "";
  } catch {
    return "";
  }
});

const copyText = async (text) => {
  if (!text) {
    return false;
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  return ok;
};

const goToTarget = () => {
  const targetUrl = safeTargetUrl.value;
  if (!targetUrl) {
    message.error("目标链接无效");
    return;
  }
  window.location.href = targetUrl;
};

const maybeRedirect = () => {
  const current = contact.value;
  if (!current) {
    return;
  }
  if (current.contactType === "wecom_kf_link") {
    goToTarget();
  }
};

const loadContact = async () => {
  const slug = String(route.params.slug || "").trim();
  if (!slug) {
    status.value = "missing";
    contact.value = null;
    return;
  }

  loading.value = true;
  status.value = "loading";
  errorText.value = "";
  try {
    const res = await api.publicWechat.detail(slug);
    if (!res?.success || !res?.data) {
      status.value = "error";
      errorText.value = res?.message || "联系人加载失败";
      return;
    }
    contact.value = res.data;
    status.value = "ready";
    maybeRedirect();
  } catch (error) {
    const messageText = String(error?.message || "");
    contact.value = null;
    if (messageText.includes("不存在")) {
      status.value = "missing";
      return;
    }
    status.value = "error";
    errorText.value = messageText || "联系人加载失败";
  } finally {
    loading.value = false;
  }
};

const copyWechatId = async () => {
  const wechatId = String(contact.value?.wechatId || "").trim();
  if (!wechatId) {
    message.error("当前联系人没有填写微信号");
    return;
  }
  try {
    const ok = await copyText(wechatId);
    if (!ok) {
      message.error("复制失败，请手动复制");
      return;
    }
    message.success("微信号已复制");
  } catch (error) {
    message.error(error?.message || "复制失败，请手动复制");
  }
};

watch(
  () => route.params.slug,
  () => {
    loadContact();
  },
);

onMounted(() => {
  loadContact();
});
</script>

<style scoped lang="scss">
.wechat-contact-page__panel,
.wechat-contact-page__state-panel {
  gap: 18px;
}

.wechat-contact-page__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.wechat-contact-page__chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.wechat-contact-page__ready-grid {
  display: grid;
  grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}

.wechat-contact-page__qr-shell {
  width: min(320px, 100%);
  margin: 0 auto;
  padding: 14px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 18px 34px rgba(15, 107, 255, 0.12);
}

.wechat-contact-page__qr-shell img {
  width: 100%;
  display: block;
  object-fit: contain;
}

.wechat-contact-page__info {
  display: grid;
  gap: 16px;
}

.support-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(15, 107, 255, 0.14);
  background: rgba(15, 107, 255, 0.08);
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 700;
}

.support-chip--accent {
  background: rgba(20, 184, 166, 0.1);
  border-color: rgba(20, 184, 166, 0.18);
  color: var(--secondary-color);
}

@media (max-width: 768px) {
  .wechat-contact-page__head,
  .wechat-contact-page__ready-grid {
    grid-template-columns: 1fr;
  }

  .wechat-contact-page__chips {
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .wechat-contact-page__panel :deep(.n-button),
  .wechat-contact-page__state-panel :deep(.n-button) {
    width: 100%;
  }
}
</style>
