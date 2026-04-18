<template>
  <!-- 俱乐部排位 -->
  <div class="status-card main-card legion-match">
    <div class="card-header">
      <img
        alt="俱乐部图标"
        class="status-icon"
        src="/icons/1733492491706152.png"
      >
      <div class="status-info">
        <span class="card-header__eyebrow">俱乐部赛事</span>
        <h3>俱乐部排位</h3>
        <p>周中赛事入口，保留现有报名命令，只优化状态和说明层级。</p>
      </div>
      <div class="status-badge" :class="{ active: legionMatch.isRegistered }">
        <span>{{ legionMatch.isRegistered ? "已报名" : "未报名" }}</span>
      </div>
    </div>
    <div class="card-content">
      <div class="summary-grid">
        <div class="summary-item">
          <span class="label">比赛周期</span>
          <span class="value">周三至周五</span>
        </div>
        <div class="summary-item">
          <span class="label">当前状态</span>
          <span class="value">{{ legionMatch.isRegistered ? "待参战" : "待报名" }}</span>
        </div>
      </div>
      <p class="description">
        每逢周三周四周五有比赛<br>
        立即报名参与精彩对决！
      </p>
      <button
        class="action-button"
        :disabled="legionMatch.isRegistered"
        @click="registerLegionMatch"
      >
        {{ legionMatch.isRegistered ? "已报名" : "立即报名" }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTokenStore } from "@/stores/tokenStore";
import { useMessage } from "naive-ui/es";
import { ref } from "vue";

const tokenStore = useTokenStore();
const message = useMessage();

const legionMatch = ref({
  isRegistered: false,
});

// 俱乐部排位报名
const registerLegionMatch = () => {
  if (!tokenStore.selectedToken || legionMatch.value.isRegistered) return;

  const tokenId = tokenStore.selectedToken.id;
  tokenStore.sendMessage(tokenId, "legionmatch_rolesignup");

  message.info("报名俱乐部排位");
};
</script>

<style scoped lang="scss">
.legion-match.main-card .summary-grid {
  margin-bottom: 12px;
}

.legion-match.main-card .description {
  margin-bottom: 14px;
}
</style>
