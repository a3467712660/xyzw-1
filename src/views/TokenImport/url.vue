<template>
  <!-- URL获取表单 -->
  <NForm
    ref="urlFormRef"
    label-placement="top"
    size="large"
    :model="urlForm"
    :rules="urlRules"
  >
    <NFormItem path="name" :label="t('tokenImportUrl.fields.name')">
      <NInput
        clearable
        v-model:value="urlForm.name"
        :placeholder="t('tokenImportUrl.placeholders.name')"
      ></NInput>
    </NFormItem>

    <NFormItem path="url" :label="t('tokenImportUrl.fields.url')">
      <NInput
        clearable
        v-model:value="urlForm.url"
        :placeholder="t('tokenImportUrl.placeholders.url')"
      ></NInput>
      <template #feedback>
        <div class="form-tips">
          <span class="form-tip">{{ t("tokenImportUrl.feedback.tokenField") }}</span>
          <span class="form-tip cors-tip">
            {{ t("tokenImportUrl.feedback.cors") }}
          </span>
        </div>
      </template>
    </NFormItem>

    <!-- 角色详情 -->
    <NCollapse>
      <NCollapseItem name="optional" :title="t('tokenImportUrl.optional.title')">
        <div class="optional-fields">
          <NFormItem :label="t('tokenImportUrl.fields.server')">
            <NInput v-model:value="urlForm.server" :placeholder="t('tokenImportUrl.placeholders.server')"></NInput>
          </NFormItem>
        </div>

        <NCollapse class="mt-8">
          <NCollapseItem name="advancedWs" :title="t('tokenImport.wsSecurity.advancedSettings')">
            <NFormItem :label="t('tokenImportUrl.fields.wsUrl')">
              <NInput
                v-model:value="urlForm.wsUrl"
                :placeholder="t('tokenImportUrl.placeholders.wsUrl')"
              ></NInput>
            </NFormItem>
            <NAlert
              v-if="wsRisk.shouldWarn"
              type="error"
              :show-icon="true"
            >
              {{ t("tokenImport.wsSecurity.riskWarning") }}
            </NAlert>
          </NCollapseItem>
        </NCollapse>
      </NCollapseItem>
    </NCollapse>

    <div class="form-actions">
      <NButton
        block
        size="large"
        type="primary"
        :loading="isImporting"
        @click="handleUrlImport"
      >
        <template #icon>
          <NIcon>
            <CloudUpload></CloudUpload>
          </NIcon>
        </template>
        {{ t("tokenImportUrl.actions.submit") }}
      </NButton>

      <NButton v-if="tokenStore.hasTokens" block size="large" @click="cancel">
        {{ t("tokenImportUrl.actions.cancel") }}
      </NButton>
    </div>
  </NForm>
</template>

<script lang="ts" setup>
import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useTokenStore } from "@/stores/tokenStore";
import { analyzeWsUrlSafety } from "@/services/tokenImport/wsUrlSafety";
import { CloudUpload } from "@vicons/ionicons5";

import {
  NAlert,
  NButton,
  NCollapse,
  NCollapseItem,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  useMessage,
} from "naive-ui/es";
import {
  fetchTokenPayloadFromUrl,
  isTrustedTokenImportUrl,
} from "@/services/tokenImport/tokenRemoteSource";

const $emit = defineEmits(["cancel", "ok"]);
const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();
const urlFormRef = ref();
const isImporting = ref(false);

const cancel = () => {
  $emit("cancel");
};

const urlForm = reactive({
  name: "",
  url: "",
  server: "",
  wsUrl: "",
});
const wsRisk = computed(() => analyzeWsUrlSafety(urlForm.wsUrl));

const urlRules = {
  name: [
    { required: true, message: t("tokenImportUrl.validation.nameRequired"), trigger: "blur" },
    {
      min: 1,
      max: 50,
      message: t("tokenImportUrl.validation.nameLength"),
      trigger: "blur",
    },
  ],
  url: [
    { required: true, message: t("tokenImportUrl.validation.urlRequired"), trigger: "blur" },
    { type: "url", message: t("tokenImportUrl.validation.urlValid"), trigger: "blur" },
  ],
};

const handleUrlImport = async () => {
  if (!urlFormRef.value)
    return;

  try {
    await urlFormRef.value.validate();
  } catch {
    message.error(t("tokenImportUrl.messages.fixFormErrors"));
    return;
  }

  isImporting.value = true;
  try {
    if (!isTrustedTokenImportUrl(urlForm.url)) {
      message.error(t("tokenImportUrl.messages.fetchFailed"));
      return;
    }

    const data = await fetchTokenPayloadFromUrl(urlForm.url, {
      trustedOnly: true,
    });
    if (data?.token) {
      const newToken = {
        name: urlForm.name,
        token: data.token,
        server: urlForm.server || data.server || t("tokenImportUrl.messages.unknownServer"),
        wsUrl: urlForm.wsUrl || "",
        id: Date.now().toString(),
        sourceUrl: urlForm.url,
        importMethod: "url",
      };
      tokenStore.addToken(newToken);
      message.success(t("tokenImportUrl.messages.addSuccess"));
      // 重置表单
      urlForm.name = "";
      urlForm.url = "";
      urlForm.server = "";
      urlForm.wsUrl = "";
      $emit("ok");
    } else {
      message.error(t("tokenImportUrl.messages.invalidResponse"));
    }
  } catch {
    message.error(t("tokenImportUrl.messages.fetchFailed"));
  } finally {
    isImporting.value = false;
  }
};
</script>

<style lang="scss" scoped>
.form-tips {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;

  .form-tip {
    font-size: 12px;
    color: #888;
  }

  .cors-tip {
    color: #e67e22;
  }
}

.optional-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 8px;
}

.form-actions {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
