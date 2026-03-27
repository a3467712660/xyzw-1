<template>
  <!-- 手动输入表单 -->
  <NForm
    label-placement="top"
    size="large"
    :model="importForm"
    :show-label="true"
  >
    <NFormItem
      :label="t('tokenImportSingleBin.fields.name')"
      :show-label="true"
    >
      <NInput
        clearable
        v-model:value="importForm.name"
        :placeholder="t('tokenImportSingleBin.placeholders.name')"
      ></NInput>
    </NFormItem>

    <NFormItem
      :label="t('tokenImportSingleBin.fields.binFile')"
      :show-label="true"
    >
      <a-upload
        clearable
        draggable
        dropzone
        multiple
        accept="*.bin,*.dmp"
        :placeholder="t('tokenImportSingleBin.placeholders.binFile')"
        @before-upload="uploadBin"
      >
        <!-- <div class="dropzone-content">
          请点击上传或将bind文件拖拽到此处
        </div> -->
      </a-upload>
    </NFormItem>
    <a-list>
      <a-list-item v-for="(role, index) in roleList" :key="index">
        <div class="queued-role-item">
          <strong>{{ t("tokenImportSingleBin.roleLabels.name") }}</strong>
          {{ role.name || t("tokenImportSingleBin.roleFallbacks.unnamed")
          }}<br>
          <strong>{{ t("tokenImportSingleBin.roleLabels.token") }}</strong>
          <span class="word-break-all">{{ maskedRoleToken(role.token) }}</span
          ><br>
          <strong>{{ t("tokenImportSingleBin.roleLabels.server") }}</strong>
          {{
            role.server || t("tokenImportSingleBin.roleFallbacks.unspecified")
          }}
          <div class="queued-role-actions">
            <NButton
              secondary
              size="tiny"
              @click="copyMaskedRoleToken(role.token)"
            >
              {{ t("tokenImport.actions.copyMaskedToken") }}
            </NButton>
            <NButton
              tertiary
              size="tiny"
              @click="copyFullRoleToken(role.token)"
            >
              {{ t("tokenImport.actions.copyFullToken") }}
            </NButton>
          </div>
        </div>
      </a-list-item>
    </a-list>

    <!-- 角色详情 -->
    <NCollapse>
      <NCollapseItem
        name="optional"
        :title="t('tokenImportSingleBin.optional.title')"
      >
        <div class="optional-fields">
          <NFormItem :label="t('tokenImportSingleBin.fields.server')">
            <NInput
              v-model:value="importForm.server"
              :placeholder="t('tokenImportSingleBin.placeholders.server')"
            ></NInput>
          </NFormItem>
        </div>

        <NCollapse class="mt-8">
          <NCollapseItem
            name="advancedWs"
            :title="t('tokenImport.wsSecurity.advancedSettings')"
          >
            <NFormItem :label="t('tokenImportSingleBin.fields.wsUrl')">
              <NInput
                v-model:value="importForm.wsUrl"
                :placeholder="t('tokenImportSingleBin.placeholders.wsUrl')"
              ></NInput>
            </NFormItem>
            <NAlert v-if="wsRisk.shouldWarn" type="error" :show-icon="true">
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
        {{ t("tokenImportSingleBin.actions.submit") }}
      </NButton>

      <NButton v-if="tokenStore.hasTokens" block size="large" @click="cancel">
        {{ t("tokenImportSingleBin.actions.cancel") }}
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
  useDialog,
  useMessage,
} from "naive-ui/es";

import PQueue from "p-queue";
import { getTokenId, transformToken } from "@/utils/token";
import { saveBinBuffer } from "@/utils/binStorage";
import { maskToken } from "@/utils/securitySanitizer";
import {
  confirmAndCopyFullToken,
  copyMaskedToken,
} from "@/utils/sensitiveCopy";

const $emit = defineEmits(["cancel", "ok"]);

const cancel = () => {
  roleList.value = [];
  $emit("cancel");
};

const tokenStore = useTokenStore();
const message = useMessage();
const dialog = useDialog();
const { t } = useI18n();
const isImporting = ref(false);
const importForm = reactive({
  name: "",
  server: "",
  wsUrl: "",
  importMethod: "",
});
const wsRisk = computed(() => analyzeWsUrlSafety(importForm.wsUrl));
const roleList = ref<
  Array<{
    id: string;
    roleId: string;
    roleIndex?: number | string;
    name: string;
    token: string;
    server: string;
    wsUrl: string;
    importMethod: string;
  }>
>([]);
const maskedRoleToken = (token: string) => maskToken(token, 4, 4) || "***";

const copyMaskedRoleToken = async (token: string) => {
  await copyMaskedToken({
    token,
    message,
    successMessage: t("tokenImport.messages.tokenCopiedMasked"),
    failureMessage: t("tokenImport.messages.clipboardCopyFailed"),
  });
};

const copyFullRoleToken = (token: string) => {
  confirmAndCopyFullToken({
    token,
    dialog,
    message,
    title: t("tokenImport.dialogs.copyFullToken.title"),
    content: t("tokenImport.dialogs.copyFullToken.content"),
    placeholder: t("tokenImport.dialogs.copyFullToken.placeholder"),
    positiveText: t("tokenImport.common.confirm"),
    negativeText: t("tokenImport.common.cancel"),
    successMessage: t("tokenImport.messages.tokenCopiedFull"),
    failureMessage: t("tokenImport.messages.clipboardCopyFailed"),
    missingConfirmMessage: t("tokenImport.messages.copyFullConfirmMissing"),
  });
};

const tQueue = new PQueue({ concurrency: 1, interval: 1000 });

const initName = (fileName: string) => {
  if (!fileName) return;
  fileName = fileName.trim();
  const binRes = fileName.match(/^bin-(.*?)服-([0-2])-(\d{6,12})-(.*)\.bin$/);
  if (binRes) {
    importForm.name = `${binRes[1]}_${binRes[2]}_${binRes[4]}`;
    return {
      server: binRes[1],
      roleIndex: binRes[2],
      roleId: binRes[3],
      roleName: binRes[4],
    };
  }
  return {
    server: "",
    roleIndex: "",
    roleId: "",
    roleName: importForm.name || "",
  };
};

const uploadBin = (binFile: File) => {
  tQueue.add(async () => {
    const roleMeta = initName(binFile.name) as any;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const userToken = e.target?.result as ArrayBuffer;
      const tokenId = getTokenId(userToken);
      const roleToken = await transformToken(userToken);
      const roleName = roleMeta.roleName || binFile.name.split(".")?.[0] || "";
      // 刷新indexDB数据库token数据
      await saveBinBuffer(tokenId, userToken);

      // 上传列表中发现已存在的重复名称，提示消息
      if (roleList.value.some((role) => role.id === tokenId)) {
        message.error(t("tokenImportSingleBin.messages.duplicateUpload"));
        return;
      }
      // 检查待上传的角色是否已在tokenStore中存在
      const existingToken = tokenStore.gameTokens.find((t) => t.id === tokenId);
      if (existingToken) {
        message.warning(
          t("tokenImportSingleBin.messages.roleExistsWillUpdate", {
            name: roleName,
          }),
        );
      }
      message.success(t("tokenImportSingleBin.messages.tokenReadSuccess"));
      roleList.value.push({
        id: tokenId,
        roleId: String(roleMeta.roleId || ""),
        roleIndex: String(roleMeta.roleIndex || "").trim(),
        activationRoleId: String(roleMeta.roleId || ""),
        activationGameAccountId: String(roleMeta.roleId || ""),
        token: roleToken,
        name: roleName,
        server: roleMeta.server ? `${roleMeta.server}服` : "",
        wsUrl: importForm.wsUrl || "",
        importMethod: "bin",
        binSourceState: "available",
        binSourceMissingAt: null,
      });
    };
    reader.onerror = () => {
      message.error(t("tokenImportSingleBin.messages.readFailed"));
    };
    reader.readAsArrayBuffer(binFile);
  });
  return false; // 阻止自动上传
};

const handleImport = async () => {
  if (roleList.value.length === 0) {
    message.error(t("tokenImportSingleBin.messages.uploadFirst"));
    return;
  }
  roleList.value.forEach((role) => {
    // tokenStore.gameTokens中发现已存在的重复名称，则移出token后重新添加
    const gameToken = tokenStore.gameTokens.find((t) => t.id === role.id);
    if (gameToken) {
      // tokenStore.removeToken(gameToken.id);
      tokenStore.updateToken(gameToken.id, {
        ...role,
      });
    } else {
      tokenStore.addToken({
        ...role,
      });
    }
  });
  message.success(t("tokenImportSingleBin.messages.importSuccess"));
  roleList.value = [];
  $emit("ok");
};
</script>

<style scoped lang="scss">
.optional-fields {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;

  n-form-item {
    flex: 1;
    min-width: 200px;
  }
}

.form-actions {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.queued-role-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.queued-role-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dropzone-content {
  width: 100%;
  border: 1px dashed #fcc;
  border-radius: 8px;
  text-align: center;
  color: #888;
  padding: 40px 20px;
  font-size: 12px;
}
</style>
