<template>
  <!-- 手动输入表单 -->
  <NForm
    ref="importFormRef"
    label-placement="top"
    size="large"
    :model="importForm"
    :rules="importRules"
    :show-label="true"
  >
    <NFormItem path="name" :label="t('tokenImportManual.fields.name')" :show-label="true">
      <NInput
        clearable
        v-model:value="importForm.name"
        :placeholder="t('tokenImportManual.placeholders.name')"
      ></NInput>
    </NFormItem>

    <NFormItem
      path="base64Token"
      :label="t('tokenImportManual.fields.token')"
      :show-label="true"
    >
      <NInput
        clearable
        type="textarea"
        v-model:value="importForm.base64Token"
        :placeholder="t('tokenImportManual.placeholders.token')"
        :rows="3"
      >
        <template #suffix>
          <n-popover placement="right" trigger="hover">
            <template #trigger>
              <NIcon :depth="1">
                <AlertCircleOutline></AlertCircleOutline>
              </NIcon>
            </template>
            <div class="large-text">
              {{ t("tokenImportManual.tokenFormat") }}
            </div>
          </n-popover>
        </template>
      </NInput>
    </NFormItem>

    <!-- 角色详情 -->
    <NCollapse>
      <NCollapseItem name="optional" :title="t('tokenImportManual.optional.title')">
        <div class="optional-fields">
          <NFormItem :label="t('tokenImportManual.fields.server')">
            <NInput
              v-model:value="importForm.server"
              :placeholder="t('tokenImportManual.placeholders.server')"
            ></NInput>
          </NFormItem>
        </div>

        <NCollapse class="mt-8">
          <NCollapseItem name="advancedWs" :title="t('tokenImport.wsSecurity.advancedSettings')">
            <NFormItem :label="t('tokenImportManual.fields.wsUrl')">
              <NInput
                v-model:value="importForm.wsUrl"
                :placeholder="t('tokenImportManual.placeholders.wsUrl')"
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
        @click="handleImport"
      >
        <template #icon>
          <NIcon>
            <CloudUpload></CloudUpload>
          </NIcon>
        </template>
        {{ t("tokenImportManual.actions.submit") }}
      </NButton>

      <NButton v-if="tokenStore.hasTokens" block size="large" @click="cancel">
        {{ t("tokenImportManual.actions.cancel") }}
      </NButton>
    </div>
  </NForm>
</template>

<script lang="ts" setup>
import { useTokenStore } from "@/stores/tokenStore";
import { analyzeWsUrlSafety } from "@/services/tokenImport/wsUrlSafety";
import { AlertCircleOutline, CloudUpload } from "@vicons/ionicons5";
import { useI18n } from "vue-i18n";
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
import { computed, reactive, ref } from "vue";

const $emit = defineEmits(["cancel", "ok"]);

const cancel = () => {
  $emit("cancel");
};

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();
const importFormRef = ref();
const isImporting = ref(false);
const importForm = reactive({
  name: "",
  base64Token: "",
  server: "",
  wsUrl: "",
});
const wsRisk = computed(() => analyzeWsUrlSafety(importForm.wsUrl));
const importRules = {
  name: [
    { required: true, message: t("tokenImportManual.validation.nameRequired"), trigger: "blur" },
    {
      min: 1,
      max: 50,
      message: t("tokenImportManual.validation.nameLength"),
      trigger: "blur",
    },
  ],
  base64Token: [
    { required: true, message: t("tokenImportManual.validation.tokenRequired"), trigger: "blur" },
    { min: 20, message: t("tokenImportManual.validation.tokenLength"), trigger: "blur" },
  ],
};
const handleImport = () => {
  isImporting.value = true;
  try {
    tokenStore.addToken({
      name: importForm.name,
      token: importForm.base64Token,
      server: importForm.server,
      wsUrl: importForm.wsUrl,
    });
    message.success(t("tokenImportManual.messages.addSuccess"));
    importForm.name = "";
    importForm.base64Token = "";
    importForm.server = "";
    importForm.wsUrl = "";
    $emit("ok");
  } catch (error: any) {
    message.error(
      t("tokenImportManual.messages.addFailed", {
        error: error.message || error,
      }),
    );
  } finally {
    isImporting.value = false;
  }
};
</script>

<style lang="scss" scoped>
.optional-fields {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;

  n-form-item {
    flex: 1 1 45%;
    min-width: 200px;
  }
}

.form-actions {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-tips {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
  font-size: 12px;
  color: #888;
}

.cors-tip {
  color: #e67e22;
}
</style>
