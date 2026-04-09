<template>
  <div class="settings-content">
    <div class="settings-grid">
      <div class="setting-item">
        <label class="setting-label">接收者ID</label>
        <n-space>
          <n-input-number
            class="input-w-180"
            placeholder="ID"
            :show-button="false"
            :value="recipientIdInput"
            @update:value="updateRecipientId"
          ></n-input-number>
          <n-input
            class="input-w-180"
            placeholder="请输入安全密码"
            type="password"
            :value="securityPassword"
            @update:value="updateSecurityPassword"
          ></n-input>
          <n-button
            type="primary"
            :disabled="!recipientIdInput || isQueryingRecipient || !securityPassword"
            @click="onQueryRecipientInfo"
          >
            查询
          </n-button>
        </n-space>
        <n-text v-if="recipientIdError" class="recipient-error-text" type="error">
          {{ recipientIdError }}
        </n-text>
      </div>

      <div v-if="recipientInfo" class="setting-item">
        <label class="setting-label">接收者信息</label>
        <div class="recipient-info recipient-card">
          <div class="avatar-container">
            <img
              v-if="recipientInfo.avatarUrl && !avatarLoadError"
              alt="角色头像"
              class="avatar-image"
              :src="recipientInfo.avatarUrl"
              @error="handleAvatarError"
              @load="handleAvatarLoad"
            >
            <div v-else class="avatar-fallback">
              {{ (recipientInfo.name || "未知角色")[0] || "?" }}
            </div>
            <div v-if="isAvatarLoading" class="avatar-loading">
              <div class="loading-spinner"></div>
            </div>
          </div>

          <div class="role-info">
            <div class="role-name">
              {{ recipientInfo.name || "未知角色" }}
            </div>
            <div class="role-info-grid">
              <div class="info-item">
                <div class="info-label">角色ID</div>
                <div class="info-value">
                  {{ recipientInfo.roleId }}
                </div>
              </div>
              <div class="info-item">
                <div class="info-label">服务器</div>
                <div class="info-value">
                  {{ recipientInfo.serverName }}
                </div>
              </div>
              <div class="info-item">
                <div class="info-label">战力</div>
                <div class="info-value info-value-power">
                  {{ recipientInfo.power }} {{ recipientInfo.powerUnit }}
                </div>
              </div>
              <div class="info-item">
                <div class="info-label">军团</div>
                <div class="info-value">
                  {{ recipientInfo.legionName || "无" }}
                </div>
              </div>
              <div class="info-item info-item-full">
                <div class="info-label">军团ID</div>
                <div class="info-value">
                  {{ recipientInfo.legionId || "无" }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-label">赠送数量</label>
        <n-input-number
          placeholder="请输入赠送数量"
          :max="1000"
          :min="1"
          :step="1"
          :value="giftQuantity"
          @update:value="$emit('update:gift-quantity', $event)"
        ></n-input-number>
      </div>
    </div>

    <div class="modal-actions modal-actions-right">
      <n-button class="btn-mr" @click="$emit('close')">
        取消
      </n-button>
      <n-button
        type="primary"
        :disabled="!recipientIdInput || !recipientInfo"
        @click="onConfirmLegacyGift"
      >
        开始赠送
      </n-button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  avatarLoadError: Boolean,
  clearRecipientError: {
    type: Function,
    required: true,
  },
  giftQuantity: {
    type: Number,
    default: 1,
  },
  handleAvatarError: {
    type: Function,
    required: true,
  },
  handleAvatarLoad: {
    type: Function,
    required: true,
  },
  isAvatarLoading: Boolean,
  isQueryingRecipient: Boolean,
  onConfirmLegacyGift: {
    type: Function,
    required: true,
  },
  onQueryRecipientInfo: {
    type: Function,
    required: true,
  },
  recipientIdError: {
    type: String,
    default: "",
  },
  recipientIdInput: {
    type: Number,
    default: null,
  },
  recipientInfo: {
    type: Object,
    default: null,
  },
  securityPassword: {
    type: String,
    default: "",
  },
});

const emit = defineEmits([
  "close",
  "update:gift-quantity",
  "update:recipient-id-input",
  "update:security-password",
]);

const updateRecipientId = (value) => {
  emit("update:recipient-id-input", value);
  props.clearRecipientError();
};

const updateSecurityPassword = (value) => {
  emit("update:security-password", value);
  props.clearRecipientError();
};
</script>

<style scoped lang="scss">
.settings-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.input-w-180 {
  width: 180px;
}

.btn-mr {
  margin-right: 12px;
}

.modal-actions-right {
  margin-top: 20px;
  text-align: right;
}

.recipient-error-text {
  margin-top: 5px;
  display: block;
}

.recipient-card {
  background: var(--surface-glass);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--surface-glass-border);
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.avatar-container {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #fff;
  font-size: 24px;
  font-weight: bold;
}

.avatar-loading {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.role-info {
  flex: 1;
  min-width: 0;
}

.role-name {
  margin-bottom: 12px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.role-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.info-item-full {
  grid-column: 1 / -1;
}

.info-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 2px;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
