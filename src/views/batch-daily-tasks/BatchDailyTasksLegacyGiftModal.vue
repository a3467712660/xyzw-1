<template>
  <n-modal
    class="modal-w-600"
    preset="card"
    :show="show"
    :title="title"
    @update:show="$emit('update:show', $event)"
  >
    <TaskControlLegacyGiftModalBody
      :avatar-load-error="avatarLoadError"
      :clear-recipient-error="clearRecipientError"
      :gift-quantity="giftQuantity"
      :handle-avatar-error="handleAvatarError"
      :handle-avatar-load="handleAvatarLoad"
      :is-avatar-loading="isAvatarLoading"
      :is-querying-recipient="isQueryingRecipient"
      :on-confirm-legacy-gift="onConfirmLegacyGift"
      :on-query-recipient-info="onQueryRecipientInfo"
      :recipient-id-error="recipientIdError"
      :recipient-id-input="recipientIdInput"
      :recipient-info="recipientInfo"
      :security-password="securityPassword"
      @close="$emit('update:show', false)"
      @update:gift-quantity="$emit('update:gift-quantity', $event)"
      @update:recipient-id-input="$emit('update:recipient-id-input', $event)"
      @update:security-password="$emit('update:security-password', $event)"
    ></TaskControlLegacyGiftModalBody>
  </n-modal>
</template>

<script setup>
import { defineAsyncComponent } from "vue";

defineProps({
  avatarLoadError: {
    type: [Object, String, Boolean],
    default: null,
  },
  clearRecipientError: {
    type: Function,
    required: true,
  },
  giftQuantity: {
    type: [String, Number],
    default: "",
  },
  handleAvatarError: {
    type: Function,
    required: true,
  },
  handleAvatarLoad: {
    type: Function,
    required: true,
  },
  isAvatarLoading: {
    type: Boolean,
    default: false,
  },
  isQueryingRecipient: {
    type: Boolean,
    default: false,
  },
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
    type: [String, Number],
    default: "",
  },
  recipientInfo: {
    type: Object,
    default: null,
  },
  securityPassword: {
    type: String,
    default: "",
  },
  show: Boolean,
  title: {
    type: String,
    default: "批量功法残卷赠送",
  },
});

defineEmits([
  "update:gift-quantity",
  "update:recipient-id-input",
  "update:security-password",
  "update:show",
]);

const TaskControlLegacyGiftModalBody = defineAsyncComponent(
  () => import("@/components/task-control/TaskControlLegacyGiftModalBody.vue"),
);
</script>

<style scoped lang="scss">
.modal-w-600 {
  width: 90%;
  max-width: 600px;
}
</style>
