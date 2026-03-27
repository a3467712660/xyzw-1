<template>
  <!-- 手动输入表单 -->
  <NForm
    label-placement="top"
    size="large"
    :model="importForm"
    :show-label="true"
  >
    <NFormItem :label="t('tokenImportBin.fields.binFile')" :show-label="true">
      <a-upload
        clearable
        draggable
        dropzone
        multiple
        accept="*.bin,*.dmp"
        :placeholder="t('tokenImportBin.placeholders.binFile')"
        @before-upload="uploadBin"
      >
        <!-- <div class="dropzone-content">
          请点击上传或将bind文件拖拽到此处
        </div> -->
      </a-upload>
    </NFormItem>

    <NFormItem
      :label="t('tokenImportBin.fields.nameTemplate')"
      :show-label="true"
    >
      <NInput
        placeholder="{name}"
        v-model:value="importForm.nameTemplate"
      ></NInput>
      <template #feedback>
        {{ t("tokenImportBin.feedback.nameTemplate") }}
      </template>
    </NFormItem>

    <NCard
      v-if="serverListData && serverListData.length > 0"
      class="mb-16"
      :title="t('tokenImportBin.serverListTitle')"
    >
      <NDataTable
        :columns="columns"
        :data="serverListData"
        :pagination="{ pageSize: 5 }"
        :scroll-x="600"
      ></NDataTable>
    </NCard>

    <a-list>
      <a-list-item v-for="(role, index) in roleList" :key="index">
        <div class="role-item-row">
          <div>
            <strong>{{ t("tokenImportBin.roleLabels.name") }}</strong>
            {{ role.name || t("tokenImportBin.roleFallbacks.unnamed") }}<br>
            <strong>{{ t("tokenImportBin.roleLabels.token") }}</strong>
            <span class="word-break-all">{{ maskedRoleToken(role.token) }}</span
            ><br>
            <strong>{{ t("tokenImportBin.roleLabels.server") }}</strong>
            {{ role.server || t("tokenImportBin.roleFallbacks.unspecified")
            }}<br>
            <strong>{{ t("tokenImportBin.roleLabels.roleIndex") }}</strong>
            {{ role.roleIndex }}
          </div>
          <div class="role-item-actions">
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
            <NButton size="small" type="error" @click="removeRole(index)">
              {{ t("tokenImportBin.actions.delete") }}
            </NButton>
          </div>
        </div>
      </a-list-item>
    </a-list>

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
        {{ t("tokenImportBin.actions.submit") }}
      </NButton>

      <NButton v-if="tokenStore.hasTokens" block size="large" @click="cancel">
        {{ t("tokenImportBin.actions.cancel") }}
      </NButton>
    </div>
  </NForm>
</template>

<script lang="ts" setup>
import { computed, h, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useTokenStore } from "@/stores/tokenStore";
import { triggerBlobDownload } from "@/utils/download";
import { CloudUpload } from "@vicons/ionicons5";

import {
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  useDialog,
  useMessage,
} from "naive-ui/es";

import PQueue from "p-queue";
import { getServerList, getTokenId, transformToken } from "@/utils/token";
import { g_utils } from "@/utils/bonProtocol";
import { formatPower } from "@/utils/legionWar";
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

const removeRole = (index: number) => {
  roleList.value.splice(index, 1);
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
  nameTemplate: "{name}",
});
const roleList = ref<
  Array<{
    id: string;
    name: string;
    roleId: string;
    token: string;
    server: string;
    roleIndex?: number;
    wsUrl: string;
    importMethod: string;
  }>
>([]);
const serverListData = ref<any[]>([]);
const currentBinData = ref<ArrayBuffer | null>(null);
const binDecodedResult = ref("");
const originalBinData = ref<any>(null);

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

const columns = computed(() => [
  {
    title: t("tokenImportBin.columns.server"),
    key: "serverId",
    render(row: any) {
      let sid = Number(row.serverId);
      if (sid >= 2000000) sid -= 2000000;
      else if (sid >= 1000000) sid -= 1000000;
      return sid - 27;
    },
  },
  {
    title: t("tokenImportBin.columns.roleIndex"),
    key: "roleIndex",
    render(row: any) {
      const sid = Number(row.serverId);
      if (sid >= 2000000) return 2;
      if (sid >= 1000000) return 1;
      return 0;
    },
  },
  {
    title: t("tokenImportBin.columns.roleId"),
    key: "roleId",
  },
  {
    title: t("tokenImportBin.columns.name"),
    key: "name",
  },
  {
    title: t("tokenImportBin.columns.power"),
    key: "power",
    render(row: any) {
      return formatPower(row.power);
    },
    sorter: (row1: any, row2: any) => row1.power - row2.power,
  },
  {
    title: t("tokenImportBin.columns.actions"),
    key: "actions",
    render(row: any) {
      return h("div", { style: "display: flex; gap: 8px;" }, [
        h(
          NButton,
          {
            size: "small",
            type: "primary",
            onClick: () => addSelectedRole(row),
          },
          { default: () => t("tokenImportBin.actions.add") },
        ),
        h(
          NButton,
          {
            size: "small",
            type: "info",
            onClick: () => handleDownload(row),
          },
          { default: () => t("tokenImportBin.actions.download") },
        ),
      ]);
    },
  },
]);

const tQueue = new PQueue({ concurrency: 1, interval: 1000 });

const resolveRoleIndex = (roleInfo: any) => {
  const candidate = [
    roleInfo?.roleIndex,
    roleInfo?.index,
    roleInfo?.role?.index,
  ]
    .map((value) => String(value ?? "").trim())
    .find((value) => /^\d+$/.test(value));
  if (candidate !== undefined) {
    return Number(candidate);
  }
  const sid = Number(roleInfo?.serverId);
  if (!Number.isFinite(sid)) {
    return 0;
  }
  if (sid >= 2000000) {
    return 2;
  }
  if (sid >= 1000000) {
    return 1;
  }
  return 0;
};

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

const handleDownload = (roleInfo: any) => {
  if (!originalBinData.value) {
    message.error(t("tokenImportBin.messages.binMissingUpload"));
    return;
  }
  try {
    const newData = { ...originalBinData.value };
    newData.serverId = roleInfo.serverId; // 确保类型一致
    const newBinBuffer = g_utils.encode(newData) as ArrayBuffer;

    // 构造文件名: bin-{server}-0-{roleId}-{name}.bin
    let sid = Number(roleInfo.serverId);
    const roleIndex = resolveRoleIndex(roleInfo);
    if (sid >= 2000000) {
      sid -= 2000000;
    } else if (sid >= 1000000) {
      sid -= 1000000;
    }

    const serverNum = sid - 27;
    const fileName = `bin-${serverNum}服-${roleIndex}-${roleInfo.roleId}-${roleInfo.name}.bin`;

    downloadBinFile(fileName, newBinBuffer);
    message.success(t("tokenImportBin.messages.downloadStarted", { fileName }));
  } catch (e: any) {
    console.error("下载失败", e);
    message.error(
      t("tokenImportBin.messages.downloadFailed", { error: e.message }),
    );
  }
};

const addSelectedRole = async (roleInfo: any) => {
  if (!originalBinData.value) {
    message.error(t("tokenImportBin.messages.binMissingUpload"));
    return;
  }

  try {
    const newData = { ...originalBinData.value };
    newData.serverId = roleInfo.serverId; // 确保类型一致
    const newBinBuffer = g_utils.encode(newData) as ArrayBuffer;
    const tokenId = getTokenId(newBinBuffer);
    const roleToken = await transformToken(newBinBuffer);
    const roleName =
      roleInfo.name ||
      t("tokenImportBin.messages.roleFallback", { roleId: roleInfo.roleId });

    // 刷新indexDB数据库token数据 (保存原始bin)
    await saveBinBuffer(tokenId, newBinBuffer);

    let sid = Number(roleInfo.serverId);
    const roleIndex = resolveRoleIndex(roleInfo);
    if (sid >= 2000000) {
      sid -= 2000000;
    } else if (sid >= 1000000) {
      sid -= 1000000;
    }
    const serverNum = sid - 27;

    const finalName = roleName;

    // 检查是否已存在相同配置 (根据角色名称和roleId)
    const exists = roleList.value.some(
      (r) => r.roleId === roleInfo.roleId && r.name === finalName,
    );

    if (exists) {
      message.warning(
        t("tokenImportBin.messages.roleAlreadyQueued", { name: finalName }),
      );
      return;
    }

    roleList.value.push({
      id: tokenId,
      roleId: roleInfo.roleId,
      activationRoleId: String(roleInfo.roleId || ""),
      activationGameAccountId: String(roleInfo.roleId || ""),
      token: roleToken,
      name: finalName,
      server: `${String(serverNum)}服`,
      roleIndex,
      wsUrl: importForm.wsUrl || "",
      importMethod: "bin",
      binSourceState: "available",
      binSourceMissingAt: null,
    });

    message.success(
      t("tokenImportBin.messages.roleAdded", { name: finalName }),
    );
  } catch (e: any) {
    console.error("添加角色失败", e);
    message.error(
      t("tokenImportBin.messages.addRoleFailed", { error: e.message }),
    );
  }
};

const uploadBin = (binFile: File) => {
  tQueue.add(async () => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const userToken = e.target?.result as ArrayBuffer;
      currentBinData.value = userToken;

      // 获取服务器角色列表
      try {
        const listStr = await getServerList(userToken);
        const parsedList = JSON.parse(listStr);
        // 转换为数组
        if (parsedList && typeof parsedList === "object") {
          serverListData.value = Object.values(parsedList).sort(
            (a: any, b: any) => b.power - a.power,
          );
        } else {
          serverListData.value = [];
        }
        message.success(t("tokenImportBin.messages.serverListLoaded"));
      } catch (err) {
        console.error("Failed to get server list", err);
        message.warning(t("tokenImportBin.messages.serverListLoadFailed"));
        serverListData.value = [];
      }

      // 尝试解析 bin 文件内容
      try {
        const binMsg = g_utils.parse(userToken);
        let binData = binMsg.getData();
        if (!binData && (binMsg as any)._raw) {
          binData = { ...(binMsg as any)._raw };
        }

        binDecodedResult.value = JSON.stringify(binData, null, 2);
        originalBinData.value = binData;
      } catch (err: any) {
        console.error("Bin文件解析失败", err);
        binDecodedResult.value = t("tokenImportBin.messages.parseFailed", {
          error: err.message || err,
        });
      }
    };
    reader.onerror = () => {
      message.error(t("tokenImportBin.messages.readFailed"));
    };
    reader.readAsArrayBuffer(binFile);
  });
  return false; // 阻止自动上传
};

const handleImport = async () => {
  if (roleList.value.length === 0) {
    message.error(t("tokenImportBin.messages.uploadFirst"));
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
  message.success(t("tokenImportBin.messages.importSuccess"));
  roleList.value = [];
  $emit("ok");
};

const downloadBinFile = (fileName, bin) => {
  const blob = new Blob([new Uint8Array(bin)], {
    type: "application/octet-stream",
  });
  triggerBlobDownload({ blob, fileName });
};
</script>

<style scoped lang="scss">
.mb-16 {
  margin-bottom: 16px;
}

.role-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.word-break-all {
  word-break: break-all;
}

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

.role-item-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
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
