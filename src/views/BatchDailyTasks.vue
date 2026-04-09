<template>
  <div class="batch-daily-tasks">
    <div class="main-layout">
      <!-- Left Column -->
      <div class="left-column">
        <!-- Header -->
        <div class="page-header">
          <div class="header-left-wrap">
            <h2>批量日常任务</h2>
            <div class="header-info-chip">
              <div class="chip-text-main">
                共 {{ scheduledTasks.length }} 个定时任务
              </div>
              <div v-if="shortestCountdownTask" class="chip-text-highlight">
                即将执行：{{ shortestCountdownTask.task.name }} ({{
                  shortestCountdownTask.countdown.formatted
                }})
              </div>
              <div v-else class="chip-text-muted">暂无定时任务</div>
              <div class="chip-actions">
                <n-button size="small" type="primary" @click="openTaskModal">
                  新增定时任务
                </n-button>
                <n-button size="small" @click="showTasksModal = true">
                  查看定时任务
                </n-button>
                <n-button size="small" @click="exportConfig">
                  导出配置
                </n-button>
                <n-upload
                  accept=".json"
                  :custom-request="importConfig"
                  :show-file-list="false"
                >
                  <n-button size="small">导入配置</n-button>
                </n-upload>
              </div>
            </div>
          </div>
          <div class="header-action-chip">
            <n-button
              size="medium"
              type="primary"
              :disabled="isRunning || selectedTokens.length === 0"
              @click="startBatch"
            >
              {{ isRunning ? "执行中..." : "开始执行" }}
            </n-button>
            <n-button
              size="medium"
              type="error"
              :disabled="!isRunning"
              @click="stopBatch"
            >
              停止
            </n-button>
            <n-button
              size="medium"
              type="info"
              @click="openTemplateManagerModal"
            >
              任务模板
            </n-button>
            <n-button size="medium" type="default" @click="openBatchSettings">
              <template #icon>
                <n-icon>
                  <Settings></Settings>
                </n-icon>
              </template>
              设置
            </n-button>
          </div>
        </div>

        <!-- Token Selection -->
        <n-card class="token-list-card" title="账号列表">
          <div class="token-selection-top">
            <!-- 分组管理和选择 -->
            <n-space vertical class="w-full">
              <!-- 分组选择部分 -->
              <div
                v-if="tokenGroups.length > 0"
                class="group-selection-section"
              >
                <div class="group-selection-header">
                  <label class="group-selection-label">分组选择</label>
                  <n-button
                    text
                    size="small"
                    type="error"
                    @click="clearAllGroupSelection"
                  >
                    一键清除所有分组选择
                  </n-button>
                </div>
                <div class="group-tags-row">
                  <div
                    v-for="group in tokenGroups"
                    :key="group.id"
                    class="group-select-chip"
                    :class="{ 'is-selected': isGroupSelected(group.id) }"
                    :style="{ '--group-color': group.color }"
                    @click="toggleGroupSelection(group.id)"
                  >
                    {{ group.name }} ({{
                      getValidGroupTokenIds(group.id).length
                    }})
                  </div>
                </div>
              </div>

              <!-- 分组管理按钮 -->
              <div class="group-manage-row">
                <n-button
                  size="small"
                  type="info"
                  @click="showGroupManageModal = true"
                >
                  管理分组
                </n-button>
                <span
                  v-if="selectedGroups.length > 0"
                  class="group-selected-hint"
                >
                  已选择 {{ selectedGroups.length }} 个分组，包含
                  {{ selectedTokens.length }} 个账号
                </span>
              </div>
            </n-space>
          </div>

          <!-- 排序按钮组 -->
          <div class="sort-buttons">
            <n-space align="center">
              <n-button-group size="small">
                <n-button
                  :type="sortConfig.field === 'name' ? 'primary' : 'default'"
                  @click="toggleSort('name')"
                >
                  名称 {{ getSortIcon("name") }}
                </n-button>
                <n-button
                  :type="sortConfig.field === 'server' ? 'primary' : 'default'"
                  @click="toggleSort('server')"
                >
                  服务器 {{ getSortIcon("server") }}
                </n-button>
                <n-button
                  :type="
                    sortConfig.field === 'createdAt' ? 'primary' : 'default'
                  "
                  @click="toggleSort('createdAt')"
                >
                  创建时间 {{ getSortIcon("createdAt") }}
                </n-button>
                <n-button
                  :type="
                    sortConfig.field === 'lastUsed' ? 'primary' : 'default'
                  "
                  @click="toggleSort('lastUsed')"
                >
                  最后使用 {{ getSortIcon("lastUsed") }}
                </n-button>
              </n-button-group>
            </n-space>
          </div>

          <n-space vertical>
            <n-checkbox
              :checked="isAllSelected"
              :indeterminate="isIndeterminate"
              @update:checked="handleSelectAll"
            >
              全选
            </n-checkbox>
            <n-checkbox-group v-model:value="selectedTokens">
              <n-grid
                :cols="batchSettings.tokenListColumns"
                :x-gap="12"
                :y-gap="8"
              >
                <n-grid-item v-for="token in sortedTokens" :key="token.id">
                  <div class="token-row">
                    <n-checkbox
                      class="token-checkbox-main"
                      :label="token.name"
                      :value="token.id"
                    >
                      <div class="token-item">
                        <span>{{ token.name }}</span>
                        <n-tag
                          class="ml-8"
                          size="small"
                          :type="getStatusType(token.id)"
                        >
                          {{ getStatusText(token.id) }}
                        </n-tag>
                        <!-- 显示token所属的分组 -->
                        <div
                          v-if="tokenStore.getTokenGroups(token.id).length > 0"
                          class="token-group-list"
                        >
                          <n-tag
                            v-for="group in tokenStore.getTokenGroups(token.id)"
                            :key="group.id"
                            class="token-group-tag"
                            size="small"
                            :color="{ color: group.color, textColor: 'white' }"
                          >
                            {{ group.name }}
                          </n-tag>
                        </div>
                      </div>
                    </n-checkbox>
                    <n-button
                      circle
                      size="tiny"
                      @click.stop="openSettings(token)"
                    >
                      <template #icon>
                        <n-icon>
                          <Settings></Settings>
                        </n-icon>
                      </template>
                    </n-button>
                  </div>
                </n-grid-item>
              </n-grid>
            </n-checkbox-group>
          </n-space>
        </n-card>

        <!-- Batch Functions -->
        <n-card class="mt-16" title="批量功能列表">
          <n-tabs animated type="line">
            <n-tab-pane name="daily" tab="日常">
              <n-space>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="claimHangUpRewards"
                >
                  领取挂机
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchAddHangUpTime"
                >
                  一键加钟
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="resetBottles"
                >
                  重置罐子
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchlingguanzi"
                >
                  一键领取罐子
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchclubsign"
                >
                  一键俱乐部签到
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchClaimMailAttachment"
                >
                  一键领邮件
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchStudy"
                >
                  一键答题
                </n-button>
                <n-button
                  size="small"
                  :disabled="
                    isRunning
                      || selectedTokens.length === 0
                      || !isarenaActivityOpen
                  "
                  @click="batcharenafight"
                >
                  一键竞技场战斗3次
                </n-button>
                <n-button
                  size="small"
                  :disabled="
                    isRunning
                      || selectedTokens.length === 0
                      || !isCarActivityOpen
                  "
                  @click="batchSmartSendCar"
                >
                  智能发车
                </n-button>
                <n-button
                  size="small"
                  :disabled="
                    isRunning
                      || selectedTokens.length === 0
                      || !isCarActivityOpen
                  "
                  @click="batchClaimCars"
                >
                  一键收车
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="store_purchase"
                >
                  一键黑市采购
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="collection_claimfreereward"
                >
                  一键领取珍宝阁
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchGenieSweep"
                >
                  一键灯神扫荡
                </n-button>
              </n-space>
            </n-tab-pane>
            <n-tab-pane name="dungeon" tab="副本">
              <n-space>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="climbTower"
                >
                  一键爬塔
                </n-button>
                <n-button
                  size="small"
                  :disabled="
                    isRunning
                      || selectedTokens.length === 0
                      || !ismengjingActivityOpen
                  "
                  @click="batchmengjing"
                >
                  一键梦境
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="skinChallenge"
                >
                  一键换皮闯关
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchClaimPeachTasks"
                >
                  一键领取蟠桃园任务
                </n-button>
                <n-button
                  size="small"
                  :disabled="
                    isRunning
                      || selectedTokens.length === 0
                      || !ismengjingActivityOpen
                  "
                  @click="batchBuyDreamItems"
                >
                  一键购买梦境商品
                </n-button>
              </n-space>
            </n-tab-pane>
            <n-tab-pane name="baoku" tab="宝库">
              <n-space>
                <n-button
                  size="small"
                  :disabled="
                    isRunning
                      || selectedTokens.length === 0
                      || !isbaokuActivityOpen
                  "
                  @click="batchbaoku13"
                >
                  一键宝库前3层
                </n-button>
                <n-button
                  size="small"
                  :disabled="
                    isRunning
                      || selectedTokens.length === 0
                      || !isbaokuActivityOpen
                  "
                  @click="batchbaoku45"
                >
                  一键宝库4,5层
                </n-button>
              </n-space>
            </n-tab-pane>
            <n-tab-pane name="weirdTower" tab="怪异塔">
              <n-space>
                <n-button
                  size="small"
                  :disabled="
                    isRunning
                      || selectedTokens.length === 0
                      || !isWeirdTowerActivityOpen
                  "
                  @click="climbWeirdTower"
                >
                  一键爬怪异塔
                </n-button>
                <n-button
                  size="small"
                  :disabled="
                    isRunning
                      || selectedTokens.length === 0
                      || !isWeirdTowerActivityOpen
                  "
                  @click="batchUseItems"
                >
                  一键使用怪异塔道具
                </n-button>
                <n-button
                  size="small"
                  :disabled="
                    isRunning
                      || selectedTokens.length === 0
                      || !isWeirdTowerActivityOpen
                  "
                  @click="batchMergeItems"
                >
                  一键怪异塔合成
                </n-button>
                <n-button
                  size="small"
                  :disabled="
                    isRunning
                      || selectedTokens.length === 0
                      || !isWeirdTowerActivityOpen
                  "
                  @click="batchClaimFreeEnergy"
                >
                  一键领取怪异塔免费道具
                </n-button>
              </n-space>
            </n-tab-pane>
            <n-tab-pane name="resource" tab="资源">
              <n-space>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="openHelperModal('box')"
                >
                  批量开箱
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchClaimBoxPointReward"
                >
                  领取宝箱积分
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="openHelperModal('fish')"
                >
                  批量钓鱼
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="openHelperModal('recruit')"
                >
                  批量招募
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchHeroUpgrade"
                >
                  一键英雄升星
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchBookUpgrade"
                >
                  一键图鉴升星
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchClaimStarRewards"
                >
                  一键领取图鉴奖励
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="legion_storebuygoods"
                >
                  一键购买四圣碎片
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="legionStoreBuySkinCoins"
                >
                  一键购买俱乐部5皮肤币
                </n-button>
              </n-space>
            </n-tab-pane>
            <n-tab-pane name="legacy" tab="功法">
              <n-space>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchLegacyClaim"
                >
                  批量功法残卷领取
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="showLegacyGiftModal = true"
                >
                  批量功法残卷赠送
                </n-button>
              </n-space>
            </n-tab-pane>
            <n-tab-pane name="monthly" tab="月度">
              <n-space>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchTopUpFish"
                >
                  一键钓鱼补齐
                </n-button>
                <n-button
                  size="small"
                  :disabled="
                    isRunning
                      || selectedTokens.length === 0
                      || !isarenaActivityOpen
                  "
                  @click="batchTopUpArena"
                >
                  一键竞技场补齐
                </n-button>
                <n-button
                  size="small"
                  :disabled="
                    isRunning
                      || selectedTokens.length === 0
                      || !isWarGuessActivityOpen
                  "
                  :title="isWarGuessActivityOpen ? '' : warGuessActivityTip"
                  @click="openWarGuessModal"
                >
                  月赛助威
                </n-button>
              </n-space>
            </n-tab-pane>
          </n-tabs>
        </n-card>
      </div>

      <!-- Right Column - Execution Log -->
      <div class="right-column">
        <n-card class="log-card">
          <template #header>
            <div class="custom-card-header">
              <div class="card-title">
                {{
                  currentRunningTokenName
                    ? `正在执行: ${currentRunningTokenName}`
                    : "执行日志"
                }}
                <span class="log-count-meta">
                  {{ logs.length }}/{{ batchSettings.maxLogEntries || 1000 }}
                </span>
              </div>
              <div class="log-header-controls">
                <n-checkbox size="small" v-model:checked="autoScrollLog">
                  自动滚动
                </n-checkbox>
                <n-checkbox size="small" v-model:checked="filterErrorsOnly">
                  只看错误
                </n-checkbox>
                <n-tag v-if="errorCount > 0" size="small" type="error">
                  {{ errorCount }} 个错误
                </n-tag>
                <n-button size="small" @click="clearLogs"> 清空日志 </n-button>
                <n-button size="small" @click="copyLogs"> 复制日志 </n-button>
              </div>
            </div>
          </template>
          <n-progress
            processing
            indicator-placement="inside"
            type="line"
            :percentage="currentProgress"
          ></n-progress>
          <div ref="logContainer" class="log-container">
            <div
              v-for="(log, index) in filteredLogs"
              :key="index"
              class="log-item"
              :class="log.type"
            >
              <span class="time">{{ log.time }}</span>
              <span class="message">{{ log.message }}</span>
            </div>
          </div>
        </n-card>
      </div>
    </div>

    <!-- Settings Modal -->
    <n-modal
      class="modal-w-400"
      preset="card"
      v-model:show="showSettingsModal"
      :title="`任务设置 - ${currentSettingsTokenName}`"
    >
      <div class="settings-content">
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label">竞技场阵容</label>
            <n-select
              size="small"
              v-model:value="currentSettings.arenaFormation"
              :options="formationOptions"
            ></n-select>
          </div>
          <div class="setting-item">
            <label class="setting-label">爬塔阵容</label>
            <n-select
              size="small"
              v-model:value="currentSettings.towerFormation"
              :options="formationOptions"
            ></n-select>
          </div>
          <div class="setting-item">
            <label class="setting-label">BOSS阵容</label>
            <n-select
              size="small"
              v-model:value="currentSettings.bossFormation"
              :options="formationOptions"
            ></n-select>
          </div>
          <div class="setting-item">
            <label class="setting-label">BOSS次数</label>
            <n-select
              size="small"
              v-model:value="currentSettings.bossTimes"
              :options="bossTimesOptions"
            ></n-select>
          </div>
          <div class="setting-switches">
            <div class="switch-row">
              <span class="switch-label">领罐子</span><n-switch v-model:value="currentSettings.claimBottle"></n-switch>
            </div>
            <div class="switch-row">
              <span class="switch-label">领挂机</span><n-switch v-model:value="currentSettings.claimHangUp"></n-switch>
            </div>
            <div class="switch-row">
              <span class="switch-label">竞技场</span><n-switch v-model:value="currentSettings.arenaEnable"></n-switch>
            </div>
            <div class="switch-row">
              <span class="switch-label">开宝箱</span><n-switch v-model:value="currentSettings.openBox"></n-switch>
            </div>
            <div class="switch-row">
              <span class="switch-label">领取邮件奖励</span><n-switch v-model:value="currentSettings.claimEmail"></n-switch>
            </div>
            <div class="switch-row">
              <span class="switch-label">黑市购买物品</span><n-switch v-model:value="currentSettings.blackMarketPurchase"></n-switch>
            </div>
            <div class="switch-row">
              <span class="switch-label">付费招募</span><n-switch v-model:value="currentSettings.payRecruit"></n-switch>
            </div>
          </div>
        </div>
        <div class="modal-actions modal-actions-right">
          <n-button type="primary" @click="saveSettings">保存设置</n-button>
        </div>
      </div>
    </n-modal>

    <!-- Task Template Modal -->
    <n-modal
      class="modal-w-400"
      preset="card"
      v-model:show="showTaskTemplateModal"
      :title="currentTemplateId ? '编辑任务模板' : '任务模板设置'"
    >
      <div class="settings-content">
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label">模板名称</label>
            <n-input
              placeholder="请输入模板名称"
              size="small"
              v-model:value="currentTemplateName"
            ></n-input>
          </div>
          <div class="setting-item">
            <label class="setting-label">竞技场阵容</label>
            <n-select
              size="small"
              v-model:value="currentTemplate.arenaFormation"
              :options="formationOptions"
            ></n-select>
          </div>
          <div class="setting-item">
            <label class="setting-label">爬塔阵容</label>
            <n-select
              size="small"
              v-model:value="currentTemplate.towerFormation"
              :options="formationOptions"
            ></n-select>
          </div>
          <div class="setting-item">
            <label class="setting-label">BOSS阵容</label>
            <n-select
              size="small"
              v-model:value="currentTemplate.bossFormation"
              :options="formationOptions"
            ></n-select>
          </div>
          <div class="setting-item">
            <label class="setting-label">BOSS次数</label>
            <n-select
              size="small"
              v-model:value="currentTemplate.bossTimes"
              :options="bossTimesOptions"
            ></n-select>
          </div>
          <div class="setting-switches">
            <div class="switch-row">
              <span class="switch-label">领罐子</span><n-switch v-model:value="currentTemplate.claimBottle"></n-switch>
            </div>
            <div class="switch-row">
              <span class="switch-label">领挂机</span><n-switch v-model:value="currentTemplate.claimHangUp"></n-switch>
            </div>
            <div class="switch-row">
              <span class="switch-label">竞技场</span><n-switch v-model:value="currentTemplate.arenaEnable"></n-switch>
            </div>
            <div class="switch-row">
              <span class="switch-label">开宝箱</span><n-switch v-model:value="currentTemplate.openBox"></n-switch>
            </div>
            <div class="switch-row">
              <span class="switch-label">领取邮件奖励</span><n-switch v-model:value="currentTemplate.claimEmail"></n-switch>
            </div>
            <div class="switch-row">
              <span class="switch-label">黑市购买物品</span><n-switch v-model:value="currentTemplate.blackMarketPurchase"></n-switch>
            </div>
            <div class="switch-row">
              <span class="switch-label">付费招募</span><n-switch v-model:value="currentTemplate.payRecruit"></n-switch>
            </div>
          </div>
        </div>
        <div class="modal-actions modal-actions-right">
          <n-button
            class="btn-mr"
            @click="showTaskTemplateModal = false"
          >
            取消
          </n-button>
          <n-button type="primary" @click="saveTaskTemplate">保存模板</n-button>
        </div>
      </div>
    </n-modal>

    <!-- Apply Template Modal -->
    <n-modal
      class="modal-w-600"
      preset="card"
      title="应用任务模板"
      v-model:show="showApplyTemplateModal"
    >
      <div class="settings-content">
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label">选择模板</label>
            <n-select
              class="input-w-full"
              label-field="name"
              placeholder="请选择要应用的模板"
              size="small"
              value-field="id"
              v-model:value="selectedTemplateId"
              :options="taskTemplates"
            ></n-select>
          </div>
          <div class="setting-item">
            <label class="setting-label">选择账号</label>

            <!-- 分组快速选择 -->
            <div class="apply-group-quick">
              <div class="apply-group-quick-label">快速选择分组：</div>
              <div class="apply-group-buttons">
                <n-button
                  v-for="group in tokenGroups"
                  :key="group.id"
                  ghost
                  class="apply-group-btn"
                  size="small"
                  :style="{ '--group-color': group.color }"
                  @click="
                    () => {
                      const groupTokenIds = getValidGroupTokenIds(group.id);
                      groupTokenIds.forEach((id) => {
                        if (!selectedTokensForApply.includes(id)) {
                          selectedTokensForApply.push(id);
                        }
                      });
                    }
                  "
                >
                  {{ group.name }}
                </n-button>
                <div v-if="tokenGroups.length === 0" class="apply-group-empty">
                  暂无分组
                </div>
              </div>
            </div>

            <n-checkbox
              :checked="isAllSelectedForApply"
              :indeterminate="isIndeterminateForApply"
              @update:checked="handleSelectAllForApply"
            >
              全选
            </n-checkbox>
            <n-checkbox-group
              class="apply-token-checklist"
              v-model:value="selectedTokensForApply"
            >
              <n-grid :cols="2" :x-gap="12" :y-gap="8">
                <n-grid-item v-for="token in sortedTokens" :key="token.id">
                  <n-checkbox :value="token.id">{{ token.name }}</n-checkbox>
                </n-grid-item>
              </n-grid>
            </n-checkbox-group>
          </div>
        </div>
        <div class="modal-actions modal-actions-right">
          <n-button @click="showApplyTemplateModal = false">取消</n-button>
          <n-button
            type="success"
            :disabled="
              !selectedTemplateId || selectedTokensForApply.length === 0
            "
            @click="applyTemplate"
          >
            应用模板
          </n-button>
        </div>
      </div>
    </n-modal>

    <!-- Template Manager Modal -->
    <n-modal
      class="modal-w-800"
      preset="card"
      title="任务模板管理"
      v-model:show="showTemplateManagerModal"
    >
      <div class="settings-content">
        <div class="template-header-row">
          <div class="template-header-actions">
            <n-button
              type="primary"
              @click="openNewTemplateModal"
            >
              新增模板
            </n-button>
            <n-button
              class="btn-ml"
              type="success"
              @click="openApplyTemplateModal"
            >
              应用模板
            </n-button>
            <n-button
              class="btn-ml"
              type="info"
              @click="openAccountTemplateModal"
            >
              查看账号模板引用
            </n-button>
          </div>
          <n-input
            class="template-search-input"
            placeholder="搜索模板"
            size="small"
          ></n-input>
        </div>

        <!-- Template List -->
        <div class="template-list template-list-box">
          <n-card
            v-for="template in filteredTaskTemplates"
            :key="template.id"
            class="template-item-card"
            size="small"
          >
            <div class="template-item-row">
              <div>
                <h4 class="template-item-title">
                  {{ template.name }}
                </h4>
                <div class="template-item-meta">
                  创建时间: {{ new Date(template.createdAt).toLocaleString() }}
                  <span v-if="template.updatedAt">, 更新时间:
                    {{ new Date(template.updatedAt).toLocaleString() }}</span>
                </div>
              </div>
              <div class="template-item-actions">
                <n-button
                  size="small"
                  @click="openEditTemplateModal(template)"
                >
                  编辑
                </n-button>
                <n-button
                  size="small"
                  type="error"
                  @click="deleteTaskTemplate(template.id)"
                >
                  删除
                </n-button>
              </div>
            </div>
          </n-card>
          <div
            v-if="filteredTaskTemplates.length === 0"
            class="template-empty-state"
          >
            暂无模板
          </div>
        </div>

        <!-- Actions -->
        <div class="modal-actions modal-actions-right">
          <n-button @click="showTemplateManagerModal = false">关闭</n-button>
        </div>
      </div>
    </n-modal>

    <!-- Account Template References Modal -->
    <n-modal
      class="modal-w-800"
      preset="card"
      title="账号模板引用查看"
      v-model:show="showAccountTemplateModal"
    >
      <div class="settings-content">
        <div class="template-header-row">
          <div>
            <span>共 {{ filteredAccountTemplates.length }} 个账号</span>
          </div>
          <div class="account-filter-row">
            <label class="account-filter-label">按模板筛选:</label>
            <n-select
              class="account-filter-select"
              label-field="name"
              placeholder="全部模板"
              size="small"
              value-field="id"
              v-model:value="selectedTemplateForFilter"
              :options="taskTemplates"
              @update:value="filterAccountTemplates"
            ></n-select>
          </div>
        </div>

        <!-- Account Template List -->
        <div class="account-template-list template-list-box">
          <n-card
            v-for="item in filteredAccountTemplates"
            :key="item.tokenId"
            class="template-item-card"
            size="small"
          >
            <div class="template-item-row">
              <div>
                <h4 class="template-item-title-small">
                  {{ item.tokenName }}
                </h4>
              </div>
              <div>
                <n-tag
                  size="small"
                  :type="item.templateId ? 'success' : 'default'"
                >
                  {{ item.templateName }}
                </n-tag>
              </div>
            </div>
          </n-card>
          <div
            v-if="filteredAccountTemplates.length === 0"
            class="template-empty-state"
          >
            暂无账号数据
          </div>
        </div>

        <!-- Actions -->
        <div class="modal-actions modal-actions-right">
          <n-button @click="showAccountTemplateModal = false">关闭</n-button>
        </div>
      </div>
    </n-modal>

    <!-- Legacy Gift Modal -->
    <n-modal
      class="modal-w-600"
      preset="card"
      title="批量功法残卷赠送"
      v-model:show="showLegacyGiftModal"
    >
      <TaskControlLegacyGiftModalBody
        :avatar-load-error="avatarLoadError"
        :clear-recipient-error="clearRecipientError"
        :gift-quantity="giftQuantity"
        :handle-avatar-error="handleAvatarError"
        :handle-avatar-load="handleAvatarLoad"
        :is-avatar-loading="isAvatarLoading"
        :is-querying-recipient="isQueryingRecipient"
        :on-confirm-legacy-gift="confirmLegacyGift"
        :on-query-recipient-info="queryRecipientInfo"
        :recipient-id-error="recipientIdError"
        :recipient-id-input="recipientIdInput"
        :recipient-info="recipientInfo"
        :security-password="securityPassword"
        @close="showLegacyGiftModal = false"
        @update:gift-quantity="giftQuantity = $event"
        @update:recipient-id-input="recipientIdInput = $event"
        @update:security-password="securityPassword = $event"
      ></TaskControlLegacyGiftModalBody>
    </n-modal>

    <!-- Helper Modal (开箱/钓鱼/招募) -->
    <n-modal
      class="modal-w-400"
      preset="card"
      v-model:show="showHelperModal"
      :title="helperModalTitle"
    >
      <div class="settings-content">
        <div class="settings-grid">
          <div v-if="helperType === 'box'" class="setting-item">
            <label class="setting-label">宝箱类型</label>
            <n-select
              size="small"
              v-model:value="helperSettings.boxType"
              :options="boxTypeOptions"
            ></n-select>
          </div>
          <div v-if="helperType === 'fish'" class="setting-item">
            <label class="setting-label">鱼竿类型</label>
            <n-select
              size="small"
              v-model:value="helperSettings.fishType"
              :options="fishTypeOptions"
            ></n-select>
          </div>
          <div class="setting-item">
            <label class="setting-label">消耗数量（10的倍数）</label>
            <n-input-number
              size="small"
              v-model:value="helperSettings.count"
              :max="10000"
              :min="10"
              :step="10"
            ></n-input-number>
          </div>
        </div>
        <div class="modal-actions modal-actions-right">
          <n-button
            class="btn-mr"
            @click="showHelperModal = false"
          >
            取消
          </n-button>
          <n-button type="primary" @click="executeHelper">开始执行</n-button>
        </div>
      </div>
    </n-modal>

    <!-- Dream Buy Modal -->
    <n-modal
      class="modal-w-600"
      preset="card"
      title="梦境商品购买配置"
      v-model:show="showDreamBuyModal"
    >
      <div class="settings-content">
        <div class="settings-grid">
          <n-alert show-icon class="dream-alert" type="info">
            请勾选需要购买的商品。只会购买列表中存在的商品。
          </n-alert>

          <div class="dream-actions-row">
            <n-button size="small" type="warning" @click="selectGoldItems">
              一键勾选金币商品
            </n-button>
            <n-button size="small" @click="selectAllItems"> 全选所有 </n-button>
            <n-button size="small" @click="clearAllItems"> 清空选择 </n-button>
          </div>

          <div
            v-for="(merchant, id) in merchantConfig"
            :key="id"
            class="dream-merchant-block"
          >
            <div class="dream-merchant-title">{{ merchant.name }}</div>
            <n-grid :cols="3" :x-gap="12" :y-gap="8">
              <n-grid-item v-for="(item, index) in merchant.items" :key="index">
                <n-checkbox
                  :checked="dreamBuyList.includes(`${id}-${index}`)"
                  :value="`${id}-${index}`"
                  @update:checked="
                    (checked) => toggleDreamItem(`${id}-${index}`, checked)
                  "
                >
                  {{ item }}
                </n-checkbox>
              </n-grid-item>
            </n-grid>
          </div>
        </div>
        <div class="modal-actions modal-actions-right">
          <n-button
            class="btn-mr"
            @click="showDreamBuyModal = false"
          >
            取消
          </n-button>
          <n-button
            type="primary"
            @click="saveDreamBuyConfig"
          >
            保存配置
          </n-button>
        </div>
      </div>
    </n-modal>

    <!-- Tasks List Modal -->
    <n-modal
      class="modal-w-800"
      preset="card"
      title="定时任务列表"
      v-model:show="showTasksModal"
    >
      <TaskControlScheduledTasksList
        :executing-task-ids="executingTaskIds"
        :on-delete-task="deleteTask"
        :on-edit-task="editTask"
        :on-manual-execute-task="manualExecuteTask"
        :on-toggle-task-enabled="toggleTaskEnabled"
        :scheduled-tasks="scheduledTasks"
        :task-countdowns="taskCountdowns"
      ></TaskControlScheduledTasksList>
    </n-modal>

    <!-- Task Modal -->
    <n-modal
      class="modal-w-600"
      preset="card"
      v-model:show="showTaskModal"
      :title="editingTask ? '编辑定时任务' : '新增定时任务'"
    >
      <div class="settings-content">
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label">任务名称</label>
            <n-input
              placeholder="请输入任务名称"
              v-model:value="taskForm.name"
            ></n-input>
          </div>
          <div class="setting-item">
            <label class="setting-label">运行类型</label>
            <n-radio-group
              v-model:value="taskForm.runType"
              @update:value="resetRunType"
            >
              <n-radio value="daily">每天固定时间</n-radio>
              <n-radio value="cron">Cron表达式</n-radio>
            </n-radio-group>
          </div>
          <div v-if="taskForm.runType === 'daily'" class="setting-item">
            <label class="setting-label">运行时间</label>
            <n-time-picker format="HH:mm" v-model:value="taskForm.runTime"></n-time-picker>
          </div>
          <div v-if="taskForm.runType === 'cron'" class="setting-item">
            <label class="setting-label">Cron表达式</label>
            <n-input
              placeholder="请输入Cron表达式"
              v-model:value="taskForm.cronExpression"
              @input="parseCronExpression"
            ></n-input>

            <!-- Cron表达式解析结果 -->
            <div v-if="taskForm.cronExpression" class="cron-parser">
              <div v-if="cronValidation.valid" class="cron-validation success">
                <n-text type="success">✓ {{ cronValidation.message }}</n-text>
              </div>
              <div v-else class="cron-validation error">
                <n-text type="error">✗ {{ cronValidation.message }}</n-text>
              </div>

              <!-- 未来执行时间 -->
              <div
                v-if="cronValidation.valid && cronNextRuns.length > 0"
                class="cron-next-runs"
              >
                <h4>未来5次执行时间：</h4>
                <ul>
                  <li v-for="(run, index) in cronNextRuns" :key="index">
                    {{ run }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-header-row">
              <label class="setting-label">选择账号</label>
              <n-space size="small">
                <n-button size="small" @click="selectAllTokens">
                  全选
                </n-button>
                <n-button size="small" @click="deselectAllTokens">
                  全不选
                </n-button>
              </n-space>
            </div>

            <!-- 分组快速选择 (仅在定时任务中显示) -->
            <div class="task-group-quick">
              <div class="task-group-quick-head">
                <div class="task-group-quick-text">快速选择分组：</div>
                <n-button
                  text
                  size="tiny"
                  type="primary"
                  @click="showGroupManageModal = true"
                >
                  管理分组
                </n-button>
              </div>
              <div v-if="tokenGroups.length === 0" class="task-group-empty">
                暂无分组
              </div>
              <div class="task-group-buttons">
                <n-button
                  v-for="group in tokenGroups"
                  :key="group.id"
                  class="task-group-btn"
                  size="small"
                  :style="{ '--group-color': group.color }"
                  :type="
                    taskScheduleSelectedGroupIds.includes(group.id)
                      ? 'primary'
                      : 'default'
                  "
                  @click="
                    () => {
                      const index = taskScheduleSelectedGroupIds.indexOf(
                        group.id,
                      );
                      const groupTokenIds = getValidGroupTokenIds(group.id);

                      if (index > -1) {
                        // 取消选择该分组
                        taskScheduleSelectedGroupIds.splice(index, 1);
                        taskForm.selectedTokens
                          = taskForm.selectedTokens.filter(
                            (id) => !groupTokenIds.includes(id),
                          );
                      }
                      else {
                        // 选择该分组
                        taskScheduleSelectedGroupIds.push(group.id);
                        groupTokenIds.forEach((id) => {
                          if (!taskForm.selectedTokens.includes(id)) {
                            taskForm.selectedTokens.push(id);
                          }
                        });
                      }
                    }
                  "
                >
                  {{ group.name }}
                </n-button>
              </div>
            </div>

            <n-checkbox-group v-model:value="taskForm.selectedTokens">
              <n-grid :cols="2" :x-gap="12" :y-gap="8">
                <n-grid-item v-for="token in sortedTokens" :key="token.id">
                  <n-checkbox :value="token.id">{{ token.name }}</n-checkbox>
                </n-grid-item>
              </n-grid>
            </n-checkbox-group>
          </div>
          <div class="setting-item">
            <div class="setting-header-row">
              <label class="setting-label">选择任务</label>
              <n-space size="small">
                <n-button size="small" @click="selectAllTasks"> 全选 </n-button>
                <n-button size="small" @click="deselectAllTasks">
                  全不选
                </n-button>
              </n-space>
            </div>

            <n-checkbox-group v-model:value="taskForm.selectedTasks">
              <n-tabs
                animated
                class="task-tabs"
                default-value="daily"
                size="small"
                type="line"
              >
                <n-tab-pane
                  v-for="group in taskGroupDefinitions"
                  :key="group.name"
                  :name="group.name"
                  :tab="group.label"
                >
                  <n-grid :cols="2" :x-gap="12" :y-gap="8">
                    <n-grid-item
                      v-for="task in groupedAvailableTasks[group.name]"
                      :key="task.value"
                    >
                      <n-checkbox :value="task.value">
                        {{
                          task.label
                        }}
                      </n-checkbox>
                    </n-grid-item>
                  </n-grid>
                </n-tab-pane>

                <n-tab-pane
                  v-if="
                    groupedAvailableTasks.other
                      && groupedAvailableTasks.other.length > 0
                  "
                  name="other"
                  tab="其他"
                >
                  <n-grid :cols="2" :x-gap="12" :y-gap="8">
                    <n-grid-item
                      v-for="task in groupedAvailableTasks.other"
                      :key="task.value"
                    >
                      <n-checkbox :value="task.value">
                        {{
                          task.label
                        }}
                      </n-checkbox>
                    </n-grid-item>
                  </n-grid>
                </n-tab-pane>
              </n-tabs>
            </n-checkbox-group>
          </div>
        </div>
        <div class="modal-actions modal-actions-right">
          <n-button
            class="btn-mr"
            @click="showTaskModal = false"
          >
            取消
          </n-button>
          <n-button type="primary" @click="saveTask">保存</n-button>
        </div>
      </div>
    </n-modal>

    <!-- Batch Settings Modal -->
    <n-modal
      class="modal-w-700"
      preset="card"
      title="任务设置"
      v-model:show="showBatchSettingsModal"
    >
      <div class="settings-content">
        <n-grid :cols="2" :x-gap="24">
          <!-- 左列：批量操作设置 -->
          <n-grid-item>
            <n-divider
              class="divider-tight"
              title-placement="left"
            >
              批量操作设置
            </n-divider>
            <div class="settings-grid">
              <div class="setting-item setting-item-row">
                <label class="setting-label">开箱数量(10倍)</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.boxCount"
                  :max="10000"
                  :min="10"
                  :step="10"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">钓鱼数量(10倍)</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.fishCount"
                  :max="10000"
                  :min="10"
                  :step="10"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">招募数量(10倍)</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.recruitCount"
                  :max="10000"
                  :min="10"
                  :step="10"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">默认宝箱类型</label>
                <n-select
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.defaultBoxType"
                  :options="boxTypeOptions"
                ></n-select>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">默认鱼竿类型</label>
                <n-select
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.defaultFishType"
                  :options="fishTypeOptions"
                ></n-select>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">梦境商品购买配置</label>
                <n-button
                  size="small"
                  @click="openDreamBuyModal"
                >
                  点击配置
                </n-button>
              </div>
            </div>
            <n-divider
              class="divider-normal"
              title-placement="left"
            >
              智能发车条件设置(0为不限制)
            </n-divider>
            <div class="settings-grid">
              <div class="setting-item setting-item-row">
                <label class="setting-label">保底车辆颜色</label>
                <n-select
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.carMinColor"
                  :options="[
                    { label: '绿·普通', value: 1 },
                    { label: '蓝·稀有', value: 2 },
                    { label: '紫·史诗', value: 3 },
                    { label: '橙·传说', value: 4 },
                    { label: '红·神话', value: 5 },
                    { label: '金·传奇', value: 6 },
                  ]"
                ></n-select>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">车辆强制刷新保底</label>
                <n-switch
                  v-model:value="batchSettings.useGoldRefreshFallback"
                ></n-switch>
              </div>
            </div>
            <div
              v-if="batchSettings.useGoldRefreshFallback"
              class="settings-grid settings-grid-top-gap"
            >
              <div class="setting-item setting-item-row">
                <label class="setting-label">需同时满足所有条件</label>
                <n-switch
                  v-model:value="batchSettings.smartDepartureMatchAll"
                ></n-switch>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">金砖 >=</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.smartDepartureGoldThreshold"
                  :min="0"
                  :step="100"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">招募令 >=</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.smartDepartureRecruitThreshold"
                  :min="0"
                  :step="10"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">白玉 >=</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.smartDepartureJadeThreshold"
                  :min="0"
                  :step="100"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">刷新卷 >=</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.smartDepartureTicketThreshold"
                  :min="0"
                  :step="1"
                ></n-input-number>
              </div>
            </div>
            <div class="settings-grid settings-grid-top-gap">
              <div class="setting-item setting-item-row">
                <label class="setting-label">护卫阵容分析</label>
                <n-switch
                  v-model:value="batchSettings.helperLineupAnalysisEnabled"
                ></n-switch>
              </div>
              <div
                v-if="batchSettings.helperLineupAnalysisEnabled"
                class="setting-item setting-item-row"
              >
                <label class="setting-label">优先阵容关键词</label>
                <n-select
                  clearable
                  filterable
                  multiple
                  class="input-w-100"
                  placeholder="选择优先匹配的阵容关键词"
                  size="small"
                  v-model:value="batchSettings.helperPreferredLineups"
                  :options="helperLineupKeywordOptions"
                ></n-select>
              </div>
            </div>
            <n-divider
              class="divider-normal"
              title-placement="left"
            >
              功法赠送设置
            </n-divider>
            <div class="settings-grid">
              <div class="setting-item setting-item-row">
                <label class="setting-label">接收者ID</label>
                <n-input-number
                  class="input-w-100"
                  placeholder="ID"
                  size="small"
                  v-model:value="batchSettings.receiverId"
                  :show-button="false"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">密码</label>
                <n-input
                  class="input-w-100"
                  placeholder="密码"
                  size="small"
                  type="password"
                  v-model:value="batchSettings.password"
                ></n-input>
              </div>
            </div>
          </n-grid-item>
          <!-- 右列：延迟与连接设置 -->
          <n-grid-item>
            <n-divider
              class="divider-tight"
              title-placement="left"
            >
              延迟设置(ms)
            </n-divider>
            <div class="settings-grid">
              <div class="setting-item setting-item-row">
                <label class="setting-label">命令延迟</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.commandDelay"
                  :max="2000"
                  :min="100"
                  :step="100"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">任务间延迟</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.taskDelay"
                  :max="2000"
                  :min="100"
                  :step="100"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">操作延迟</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.actionDelay"
                  :max="2000"
                  :min="100"
                  :step="100"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">战斗延迟</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.battleDelay"
                  :max="2000"
                  :min="100"
                  :step="100"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">刷新延迟</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.refreshDelay"
                  :max="3000"
                  :min="500"
                  :step="100"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">长延迟</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.longDelay"
                  :max="10000"
                  :min="1000"
                  :step="500"
                ></n-input-number>
              </div>
            </div>
            <n-divider
              class="divider-normal"
              title-placement="left"
            >
              连接设置
            </n-divider>
            <div class="settings-grid">
              <div class="setting-item setting-item-row">
                <label class="setting-label">最大并发数</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.maxActive"
                  :max="20"
                  :min="1"
                  :step="1"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">连接超时(ms)</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.connectionTimeout"
                  :max="30000"
                  :min="1000"
                  :step="1000"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">重连等待(ms)</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.reconnectDelay"
                  :max="5000"
                  :min="100"
                  :step="100"
                ></n-input-number>
              </div>
            </div>
            <n-divider
              class="divider-normal"
              title-placement="left"
            >
              系统设置
            </n-divider>
            <div class="settings-grid">
              <div class="setting-item setting-item-row">
                <label class="setting-label">列表每行数量</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.tokenListColumns"
                  :max="10"
                  :min="1"
                  :step="1"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">最大日志条目</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.maxLogEntries"
                  :max="5000"
                  :min="100"
                  :step="100"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">定时刷新页面</label>
                <n-switch v-model:value="batchSettings.enableRefresh"></n-switch>
              </div>
              <div
                v-if="batchSettings.enableRefresh"
                class="setting-item setting-item-row"
              >
                <label class="setting-label">刷新间隔(分钟)</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.refreshInterval"
                  :max="1440"
                  :min="10"
                  :step="30"
                ></n-input-number>
              </div>
            </div>
          </n-grid-item>
        </n-grid>
        <div class="modal-actions modal-actions-right">
          <n-button
            class="btn-mr"
            @click="showBatchSettingsModal = false"
          >
            取消
          </n-button>
          <n-button
            type="primary"
            @click="saveBatchSettings"
          >
            保存设置
          </n-button>
        </div>
      </div>
    </n-modal>

    <!-- War Guess Modal -->
    <n-modal
      class="modal-w-800"
      preset="card"
      title="月赛助威"
      v-model:show="showWarGuessModal"
    >
      <div class="settings-content">
        <div class="settings-grid settings-grid-block">
          <div class="war-guess-toolbar">
            <span class="war-guess-label">拍手器:</span>
            <n-input-number
              class="input-w-120"
              placeholder="拍手器"
              v-model:value="warGuessCoin"
              :max="20"
              :min="1"
            >
            </n-input-number>
            <n-button
              type="primary"
              :disabled="!selectedWarGuessLegionId || isRunning"
              @click="handleWarGuessCheer"
            >
              助威
            </n-button>
            <n-button :loading="warGuessLoading" @click="fetchWarGuessRank">
              刷新数据
            </n-button>
          </div>

          <n-data-table
            flex-height
            class="war-guess-table"
            :checked-row-keys="
              selectedWarGuessLegionId ? [selectedWarGuessLegionId] : []
            "
            :columns="warGuessColumns"
            :data="warGuessList"
            :loading="warGuessLoading"
            :row-key="(row) => row.id"
            :row-props="warGuessRowProps"
            @update:checked-row-keys="
              (keys) => (selectedWarGuessLegionId = keys[0])
            "
          ></n-data-table>
        </div>
        <div class="modal-actions modal-actions-right">
          <n-button @click="showWarGuessModal = false">关闭</n-button>
        </div>
      </div>
    </n-modal>

    <!-- Token Group Management Modal -->
    <n-modal
      class="modal-w-800"
      preset="card"
      title="分组管理"
      v-model:show="showGroupManageModal"
    >
      <div class="settings-content">
        <!-- 创建新分组 -->
        <n-divider class="divider-section" title-placement="left">
          创建新分组
        </n-divider>
        <div class="group-create-section">
          <div class="group-create-row">
            <n-input
              class="input-w-200"
              placeholder="输入分组名称"
              size="small"
              v-model:value="newGroupName"
            ></n-input>
            <div class="group-color-row">
              <span class="group-color-label">选择颜色:</span>
              <div class="group-color-list">
                <div
                  v-for="color in groupColors"
                  :key="color"
                  class="color-swatch color-swatch-md"
                  :class="{ 'is-selected': newGroupColor === color }"
                  :style="{ '--swatch-color': color }"
                  @click="newGroupColor = color"
                ></div>
              </div>
            </div>
            <n-button size="small" type="primary" @click="createNewGroup">
              创建分组
            </n-button>
          </div>

          <!-- 选择包含的账号 -->
          <div class="group-account-box">
            <div class="group-account-header">
              <span class="group-account-title">包含账号 ({{ newGroupSelectedTokens.length }})</span>
              <n-space size="small">
                <n-button size="tiny" @click="selectAllNewGroup">全选</n-button>
                <n-button
                  size="tiny"
                  @click="deselectAllNewGroup"
                >
                  全不选
                </n-button>
              </n-space>
            </div>
            <div class="group-account-list">
              <n-checkbox-group v-model:value="newGroupSelectedTokens">
                <n-grid :cols="3" :x-gap="12" :y-gap="8">
                  <n-grid-item v-for="token in sortedTokens" :key="token.id">
                    <n-checkbox :value="token.id">{{ token.name }}</n-checkbox>
                  </n-grid-item>
                </n-grid>
              </n-checkbox-group>
            </div>
          </div>
        </div>

        <!-- 分组列表 -->
        <n-divider class="divider-section" title-placement="left">
          分组列表
        </n-divider>
        <div class="group-list-container">
          <div
            v-for="group in tokenGroups"
            :key="group.id"
            class="group-list-item"
          >
            <div class="group-list-item-row">
              <div class="group-list-main">
                <!-- 编辑模式 -->
                <div v-if="editingGroupId === group.id" class="group-edit-row">
                  <n-input
                    class="input-w-150"
                    placeholder="分组名称"
                    size="small"
                    v-model:value="editingGroupName"
                  ></n-input>
                  <div class="group-color-list">
                    <div
                      v-for="color in groupColors"
                      :key="color"
                      class="color-swatch color-swatch-sm"
                      :class="{ 'is-selected': editingGroupColor === color }"
                      :style="{ '--swatch-color': color }"
                      @click="editingGroupColor = color"
                    ></div>
                  </div>
                  <n-button
                    class="group-mini-btn"
                    size="small"
                    type="primary"
                    @click="saveEditGroup"
                  >
                    保存
                  </n-button>
                  <n-button
                    class="group-mini-btn"
                    size="small"
                    @click="cancelEditGroup"
                  >
                    取消
                  </n-button>
                </div>
                <!-- 显示模式 -->
                <div v-else>
                  <div class="group-name-row">
                    <div
                      class="group-color-dot"
                      :style="{ '--dot-color': group.color }"
                    ></div>
                    <span class="group-name-text">
                      {{ group.name }}
                    </span>
                    <n-tag size="small" type="info">
                      {{ getValidGroupTokenIds(group.id).length }} 个账号
                    </n-tag>
                  </div>
                  <div class="group-token-tags">
                    <div
                      v-for="tokenId in getValidGroupTokenIds(group.id)"
                      :key="tokenId"
                      class="group-token-tag"
                    >
                      {{ tokens.find((t) => t.id === tokenId)?.name }}
                      <n-button
                        text
                        size="tiny"
                        type="error"
                        @click="removeTokenFromSelectedGroup(group.id, tokenId)"
                      >
                        ×
                      </n-button>
                    </div>
                  </div>
                  <!-- 添加token到分组 -->
                  <div class="group-add-token-row">
                    <n-select
                      filterable
                      placeholder="添加账号到分组"
                      size="small"
                      :options="
                        tokens
                          .filter(
                            (t) =>
                              !getValidGroupTokenIds(group.id).includes(t.id),
                          )
                          .map((t) => ({ label: t.name, value: t.id }))
                      "
                      @update:value="
                        (tokenId) => {
                          if (tokenId) {
                            addTokenToSelectedGroup(group.id, tokenId);
                          }
                        }
                      "
                    ></n-select>
                  </div>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div
                v-if="editingGroupId !== group.id"
                class="group-item-actions"
              >
                <n-button size="small" @click="startEditGroup(group.id)">
                  编辑
                </n-button>
                <n-button
                  size="small"
                  type="error"
                  @click="deleteGroup(group.id)"
                >
                  删除
                </n-button>
              </div>
            </div>
          </div>

          <div v-if="tokenGroups.length === 0" class="group-empty-state">
            暂无分组，请创建一个新分组
          </div>
        </div>

        <!-- 关闭按钮 -->
        <div class="modal-actions modal-actions-right">
          <n-button @click="showGroupManageModal = false">关闭</n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup>
// Import required dependencies
import {
  computed,
  defineAsyncComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { tokenGroups, useTokenStore } from "@/stores/tokenStore";
import { useBatchTaskPersistence } from "@/composables/useBatchTaskPersistence";
import { useBatchConnectionManager } from "@/composables/useBatchConnectionManager";
import { useBatchConfigTransfer } from "@/composables/useBatchConfigTransfer";
import { useBatchLogManager } from "@/composables/useBatchLogManager";
import { useBatchTaskRuntime } from "@/composables/useBatchTaskRuntime";
import { useDreamBuyManager } from "@/composables/useDreamBuyManager";
import { useLegacyGiftManager } from "@/composables/useLegacyGiftManager";
import { useScheduledTaskCountdown } from "@/composables/useScheduledTaskCountdown";
import { useBatchTokenSelection } from "@/composables/useBatchTokenSelection";
import { useScheduledTaskRunner } from "@/composables/useScheduledTaskRunner";
import { useTaskTemplateManager } from "@/composables/useTaskTemplateManager";
import { useTokenTaskSettings } from "@/composables/useTokenTaskSettings";
import { useTokenGroupManager } from "@/composables/useTokenGroupManager";
import { useWarGuessManager } from "@/composables/useWarGuessManager";
import { DailyTaskRunner } from "@/utils/dailyTaskRunner";
import { useMessage } from "naive-ui/es";
import { Settings } from "@vicons/ionicons5";
import {
  ARENA_LINEUP_PRESET_OPTIONS,
  ARENA_LINEUP_PRESET_VALUES,
} from "@/utils/arenaLineupPresets";

// Import batch task modules
import {
  addTaskSaveLog,
  availableTasks,
  bossTimesOptions,
  // Constants
  boxTypeOptions,
  calculateMonthProgress,
  calculateNextExecutionTime,
  calculateNextRuns,
  canClaim,
  fishTypeOptions,
  formationOptions,
  formatTimeDifference,
  getTodayStartSec,
  gradeLabel,
  isTodayAvailable,
  matchesCronExpression,
  // Car utilities
  normalizeCars,
  pickArenaTargetId,
  shouldSendCar,
  validateCronExpression,
} from "@/utils/batch";

import { goldItemsConfig, merchantConfig } from "@/utils/dreamConstants";

const TaskControlLegacyGiftModalBody = defineAsyncComponent(
  () => import("@/components/task-control/TaskControlLegacyGiftModalBody.vue"),
);
const TaskControlScheduledTasksList = defineAsyncComponent(
  () => import("@/components/task-control/TaskControlScheduledTasksList.vue"),
);

// Initialize token store, message service, and task runner
const tokenStore = useTokenStore();
const message = useMessage();
const helperLineupKeywordOptions = [...ARENA_LINEUP_PRESET_OPTIONS];
const helperLineupKeywordSet = new Set(ARENA_LINEUP_PRESET_VALUES);

// 排序配置（从localStorage读取，与TokenImport共享）
const savedSortConfig = localStorage.getItem("tokenSortConfig");
const sortConfig = ref(
  savedSortConfig
    ? JSON.parse(savedSortConfig)
    : {
        field: "createdAt", // 排序字段：name, server, createdAt, lastUsed
        direction: "asc", // 排序方向：asc, desc
      },
);

// 计算属性 - 从gameData中获取塔相关信息
const evoTowerInfo = computed(() => {
  const data = tokenStore.gameData?.evoTowerInfo || null;
  return data;
});

const weirdTowerData = computed(() => {
  return evoTowerInfo.value?.evoTower || null;
});

const currentTowerId = computed(() => {
  return weirdTowerData.value?.towerId || 0;
});

const towerEnergy = computed(() => {
  return weirdTowerData.value?.energy || 0;
});

// 排序后的游戏角色Token列表
const sortedTokens = computed(() => {
  return [...tokenStore.gameTokens].sort((tokenA, tokenB) => {
    let valueA, valueB;

    // 根据排序字段获取比较值
    switch (sortConfig.value.field) {
      case "name":
        valueA = tokenA.name?.toLowerCase() || "";
        valueB = tokenB.name?.toLowerCase() || "";
        break;
      case "server":
        valueA = tokenA.server?.toLowerCase() || "";
        valueB = tokenB.server?.toLowerCase() || "";
        break;
      case "createdAt":
        valueA = new Date(tokenA.createdAt || 0).getTime();
        valueB = new Date(tokenB.createdAt || 0).getTime();
        break;
      case "lastUsed":
        valueA = new Date(tokenA.lastUsed || 0).getTime();
        valueB = new Date(tokenB.lastUsed || 0).getTime();
        break;
      default:
        valueA = tokenA.name?.toLowerCase() || "";
        valueB = tokenB.name?.toLowerCase() || "";
    }

    // 根据排序方向比较值
    if (valueA < valueB) {
      return sortConfig.value.direction === "asc" ? -1 : 1;
    }
    if (valueA > valueB) {
      return sortConfig.value.direction === "asc" ? 1 : -1;
    }
    return 0;
  });
});

// 切换排序
const toggleSort = (field) => {
  if (sortConfig.value.field === field) {
    // 如果点击的是当前排序字段，则切换排序方向
    sortConfig.value.direction
      = sortConfig.value.direction === "asc" ? "desc" : "asc";
  } else {
    // 如果点击的是新的排序字段，则默认升序
    sortConfig.value.field = field;
    sortConfig.value.direction = "asc";
  }

  // 保存排序设置到localStorage
  localStorage.setItem("tokenSortConfig", JSON.stringify(sortConfig.value));
};

// 获取排序图标
const getSortIcon = (field) => {
  if (sortConfig.value.field !== field)
    return null;
  return sortConfig.value.direction === "asc" ? "↑" : "↓";
};

const tokens = computed(() => tokenStore.gameTokens);
const isCarActivityOpen = computed(() => {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  // 1=Mon, 2=Tue, 3=Wed; 6点之后
  return day >= 1 && day <= 3 && hour >= 6;
});
const ismengjingActivityOpen = computed(() => {
  const day = new Date().getDay();
  return day === 0 || day === 1 || day === 3 || day === 4;
});
const isbaokuActivityOpen = computed(() => {
  const day = new Date().getDay();
  return day != 1 && day != 2;
});
const isarenaActivityOpen = computed(() => {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 22;
});
const getCurrentActivityWeek = computed(() => {
  const now = new Date();
  const start = new Date("2025-12-12T12:00:00"); // 起始时间：黑市周开始
  const weekDuration = 7 * 24 * 60 * 60 * 1000; // 一周毫秒数
  const cycleDuration = 3 * weekDuration; // 三周期毫秒数

  const elapsed = now - start;
  if (elapsed < 0)
    return null; // 活动开始前

  const cyclePosition = elapsed % cycleDuration;

  if (cyclePosition < weekDuration) {
    return "黑市周";
  } else if (cyclePosition < 2 * weekDuration) {
    return "招募周";
  } else {
    return "宝箱周";
  }
});

const isWeirdTowerActivityOpen = computed(() => {
  if (getCurrentActivityWeek.value !== "黑市周")
    return false;

  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  // 如果是周五，必须在12点之后
  if (day === 5) {
    return hour >= 12;
  }
  return true;
});

// 获取本月第四个周日的日期
const getFourthSundayOfMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // 当月第一天
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay(); // 0-6

  // 计算第一个周日的日期 (1号是周日则为1，否则为 1 + 7 - dayOfWeek)
  let firstSundayDate = 1 + ((7 - dayOfWeek) % 7);

  // 仅针对2026年3月进行特殊处理
  if (year === 2026 && month === 2 && dayOfWeek === 0) {
    firstSundayDate = 8;
  }

  // 第四个周日 = 第一个周日 + 21天
  return new Date(year, month, firstSundayDate + 21);
};

const isWarGuessActivityOpen = computed(() => {
  const now = new Date();

  // 手动修正：2026年3月1日开放
  if (
    now.getFullYear() === 2026
    && now.getMonth() === 2
    && now.getDate() === 1
  ) {
    const hour = now.getHours();
    const minute = now.getMinutes();
    if (hour < 19 || (hour === 19 && minute <= 55))
      return true;
  }

  const fourthSunday = getFourthSundayOfMonth();

  // 检查是否是今天
  if (now.getDate() !== fourthSunday.getDate())
    return false;

  // 检查时间 00:00 - 19:55
  const hour = now.getHours();
  const minute = now.getMinutes();
  if (hour > 19 || (hour === 19 && minute > 55))
    return false;

  return true;
});

const warGuessActivityTip = computed(() => {
  if (isWarGuessActivityOpen.value)
    return "";

  const fourthSunday = getFourthSundayOfMonth();
  const month = fourthSunday.getMonth() + 1;
  const date = fourthSunday.getDate();
  return `月赛助威仅在每月第四个周日 (${month}月${date}日) 00:00-19:55 开放`;
});

const selectedTokens = ref([]);
const tokenStatus = ref({}); // { tokenId: 'waiting' | 'running' | 'completed' | 'failed' }
const isRunning = ref(false);
const shouldStop = ref(false);

const {
  addTokenToSelectedGroup,
  cancelEditGroup,
  clearAllGroupSelection,
  createNewGroup,
  deleteGroup,
  deselectAllNewGroup,
  editingGroupColor,
  editingGroupId,
  editingGroupName,
  getValidGroupTokenIds,
  groupColors,
  isGroupSelected,
  newGroupColor,
  newGroupName,
  newGroupSelectedTokens,
  removeTokenFromSelectedGroup,
  saveEditGroup,
  selectAllNewGroup,
  selectedGroups,
  showGroupManageModal,
  startEditGroup,
  taskScheduleSelectedGroupIds,
  toggleGroupSelection,
} = useTokenGroupManager({
  message,
  selectedTokens,
  sortedTokens,
  tokenGroups,
  tokenStore,
  tokens,
});

const {
  filteredAccountTemplates,
  filteredTaskTemplates,
  filterAccountTemplates,
  applyTemplate,
  currentTemplate,
  currentTemplateId,
  currentTemplateName,
  deleteTaskTemplate,
  handleSelectAllForApply,
  isAllSelectedForApply,
  isIndeterminateForApply,
  loadTaskTemplates,
  openAccountTemplateModal,
  openApplyTemplateModal,
  openEditTemplateModal,
  openNewTemplateModal,
  openTaskTemplateModal,
  openTemplateManagerModal,
  saveTaskTemplate,
  selectedTemplateForFilter,
  selectedTemplateId,
  selectedTokensForApply,
  showAccountTemplateModal,
  showApplyTemplateModal,
  showTaskTemplateModal,
  showTemplateManagerModal,
  taskTemplates,
} = useTaskTemplateManager({
  message,
  sortedTokens,
});

const defaultDreamPurchaseList = [];
for (const merchantId in goldItemsConfig) {
  goldItemsConfig[merchantId].forEach((index) => {
    defaultDreamPurchaseList.push(`${merchantId}-${index}`);
  });
}
const batchSettingsDefaults = {
  dreamPurchaseList: defaultDreamPurchaseList,
  boxCount: 100,
  fishCount: 100,
  recruitCount: 100,
  defaultBoxType: 2001,
  defaultFishType: 1,
  receiverId: "",
  password: "",
  tokenListColumns: 2,
  useGoldRefreshFallback: false,
  // 延迟配置（毫秒）
  commandDelay: 500, // 命令间延迟
  taskDelay: 500, // 任务间延迟
  actionDelay: 300, // 一般操作延迟（开箱、钓鱼、招募等）
  battleDelay: 500, // 战斗延迟（宝库、竞技场等）
  refreshDelay: 1000, // 刷新延迟（发车刷新等）
  longDelay: 3000, // 长延迟（功法赠送等）
  // 其他配置
  maxActive: 2,
  carMinColor: 4,
  connectionTimeout: 10000,
  reconnectDelay: 1000,
  maxLogEntries: 1000,
  // 页面刷新配置
  enableRefresh: false,
  refreshInterval: 360, // 分钟
  smartDepartureGoldThreshold: 0,
  smartDepartureRecruitThreshold: 0,
  smartDepartureJadeThreshold: 0,
  smartDepartureTicketThreshold: 0,
  smartDepartureMaxRefreshAttempts: 30,
  smartDepartureMatchAll: false,
  helperLineupAnalysisEnabled: true,
  helperPreferredLineups: [],
};

// ======================
// Scheduled Tasks Feature
// ======================

// 任务分组定义
const taskGroupDefinitions = [
  {
    name: "daily",
    label: "日常",
    tasks: [
      "startBatch",
      "claimHangUpRewards",
      "resetBottles",
      "batchlingguanzi",
      "batchStudy",
      "batcharenafight",
      "batchSmartSendCar",
      "batchClaimCars",
      "batchGenieSweep",
    ],
  },
  {
    name: "dungeon",
    label: "副本",
    tasks: [
      "climbTower",
      "batchmengjing",
      "skinChallenge",
      "batchClaimPeachTasks",
      "batchBuyDreamItems",
    ],
  },
  { name: "baoku", label: "宝库", tasks: ["batchbaoku13", "batchbaoku45"] },
  {
    name: "weirdTower",
    label: "怪异塔",
    tasks: [
      "climbWeirdTower",
      "batchUseItems",
      "batchMergeItems",
      "batchClaimFreeEnergy",
    ],
  },
  {
    name: "resource",
    label: "资源",
    tasks: [
      "batchOpenBox",
      "batchClaimBoxPointReward",
      "batchFish",
      "batchRecruit",
      "legion_storebuygoods",
    ],
  },
  {
    name: "legacy",
    label: "功法",
    tasks: ["batchLegacyClaim", "batchLegacyGiftSendEnhanced"],
  },
  {
    name: "monthly",
    label: "月度",
    tasks: ["batchTopUpFish", "batchTopUpArena"],
  },
];

// 计算属性，根据 taskGroupDefinitions 将 availableTasks 分组
const groupedAvailableTasks = computed(() => {
  const groups = {};
  taskGroupDefinitions.forEach((group) => {
    groups[group.name] = availableTasks.filter((task) =>
      group.tasks.includes(task.value),
    );
  });

  // 处理未分组的任务
  const groupedTaskValues = taskGroupDefinitions.flatMap((g) => g.tasks);
  const otherTasks = availableTasks.filter(
    (task) => !groupedTaskValues.includes(task.value),
  );
  if (otherTasks.length > 0) {
    groups.other = otherTasks;
  }

  return groups;
});

let batchLogManager = null;
const helperTaskActions = {};
let batchLegacyGiftSendEnhancedAction = () => {};
let quickTaskLogForwarder = () => {};

function addLog(log) {
  batchLogManager?.addLog(log);
}

const sanitizeHelperPreferredLineups = (lineups) => {
  if (!Array.isArray(lineups)) {
    return [];
  }
  return [
    ...new Set(
      lineups
        .map((item) => String(item || "").trim())
        .filter((item) => item && helperLineupKeywordSet.has(item)),
    ),
  ];
};

const {
  batchSettings,
  cronNextRuns,
  cronValidation,
  deleteTask,
  deselectAllTasks,
  editTask,
  editingTask,
  openBatchSettings,
  openTaskModal,
  parseCronExpression,
  saveBatchSettings,
  saveScheduledTasks,
  saveTask,
  scheduledTasks,
  selectAllTasks,
  showBatchSettingsModal,
  showTaskModal,
  showTasksModal,
  taskForm,
  toggleTaskEnabled,
} = useBatchTaskPersistence({
  message,
  addLog,
  addTaskSaveLog,
  validateCronExpression,
  calculateNextRuns,
  availableTasks,
  taskScheduleSelectedGroupIds,
  batchSettingsDefaults,
  sanitizeHelperPreferredLineups,
});

// 注: availableTasks, CarresearchItem, taskColumns 已从 @/utils/batch 导入

// ======================
// Scheduled Tasks Storage
// ======================

// Track executing tasks for UI loading state
const executingTaskIds = ref([]);

// Manual execute task
const manualExecuteTask = async (task) => {
  if (executingTaskIds.value.includes(task.id))
    return;

  // Reset stop flag if not running, to allow manual execution
  if (!isRunning.value && shouldStop.value) {
    shouldStop.value = false;
  }

  executingTaskIds.value.push(task.id);
  try {
    message.info(`开始执行任务: ${task.name}`);
    await executeScheduledTask(task);
    message.success(`任务 ${task.name} 执行完成`);
  } catch (e) {
    console.error(`执行任务 ${task.name} 失败:`, e);
    message.error(`任务 ${task.name} 执行失败`);
  } finally {
    executingTaskIds.value = executingTaskIds.value.filter(
      (id) => id !== task.id,
    );
  }
};

// 注: addTaskSaveLog 已从 @/utils/batch 导入，调用时需传入 addLog

// Reset run type related fields
const resetRunType = () => {
  if (taskForm.runType === "daily") {
    taskForm.cronExpression = "";
  } else {
    taskForm.runTime = undefined;
  }
};

// Select all tokens
const selectAllTokens = () => {
  taskForm.selectedTokens = tokens.value.map((token) => token.id);
};

// Deselect all tokens
const deselectAllTokens = () => {
  taskForm.selectedTokens = [];
};

const { exportConfig, importConfig } = useBatchConfigTransfer({
  batchSettings,
  message,
  saveBatchSettings,
  saveScheduledTasks,
  scheduledTasks,
  tokens,
});

// ======================
// Scheduled Tasks Countdown
// ======================

// 注: parseCronField, calculateNextExecutionTime, formatTimeDifference 已从 @/utils/batch 导入

const {
  nextExecutionTimes,
  resetCountdowns,
  shortestCountdownTask,
  startCountdown,
  stopCountdown,
  taskCountdowns,
} = useScheduledTaskCountdown({
  scheduledTasks,
  calculateNextExecutionTime,
  formatTimeDifference,
});

// ======================
// Scheduled Tasks Scheduler
// ======================

// Watch for changes to scheduledTasks for debugging
watch(
  scheduledTasks,
  () => {
    resetCountdowns();
  },
  { deep: true },
);

// 修复TimePicker的"Invalid time value"错误：确保runTime的初始值不是null
watch(
  () => showTaskModal.value,
  (isVisible) => {
    if (isVisible && !taskForm.runTime) {
      // 当模态框显示且runTime为null时，将其设置为undefined
      taskForm.runTime = undefined;
    }
  },
);

batchLogManager = useBatchLogManager({
  batchSettings,
  forwardQuickTaskLog: (log) => quickTaskLogForwarder(log),
  message,
  nextTick,
  tokens,
});

const {
  autoScrollLog,
  clearLogs,
  copyLogs,
  currentProgress,
  currentRunningTokenId,
  currentRunningTokenName,
  errorCount,
  filteredLogs,
  filterErrorsOnly,
  logContainer,
  logs,
} = batchLogManager;

// 注: boxTypeOptions, fishTypeOptions 已从 @/utils/batch 导入

// 批量功法残卷赠送相关方法
const {
  clearAllItems,
  dreamBuyList,
  openDreamBuyModal,
  saveDreamBuyConfig,
  selectAllItems,
  selectGoldItems,
  showDreamBuyModal,
  toggleDreamItem,
} = useDreamBuyManager({
  batchSettings,
  goldItemsConfig,
  merchantConfig,
  message,
  saveBatchSettings,
});

// 注: formationOptions, bossTimesOptions 已从 @/utils/batch 导入

const {
  currentSettings,
  currentSettingsTokenId,
  currentSettingsTokenName,
  executeHelper,
  helperModalTitle,
  helperSettings,
  helperType,
  loadSettings,
  openHelperModal,
  openSettings,
  saveSettings,
  showHelperModal,
  showSettingsModal,
} = useTokenTaskSettings({
  batchFish: (...args) => helperTaskActions.batchFish?.(...args),
  batchOpenBox: (...args) => helperTaskActions.batchOpenBox?.(...args),
  batchRecruit: (...args) => helperTaskActions.batchRecruit?.(...args),
  message,
});

// 注: pickArenaTargetId, FISH_TARGET, ARENA_TARGET, getTodayStartSec, isTodayAvailable, calculateMonthProgress 已从 @/utils/batch 导入

const {
  getStatusText,
  getStatusType,
  handleSelectAll,
  isAllSelected,
  isIndeterminate,
} = useBatchTokenSelection({
  selectedTokens,
  tokenStatus,
  tokens,
});

const {
  connectionQueue,
  ensureConnection,
  releaseConnectionSlot,
} = useBatchConnectionManager({
  addLog,
  batchSettings,
  tokenStore,
  tokens,
});

const {
  avatarLoadError,
  clearRecipientError,
  confirmLegacyGift,
  giftQuantity,
  handleAvatarError,
  handleAvatarLoad,
  isAvatarLoading,
  isQueryingRecipient,
  queryRecipientInfo,
  recipientIdError,
  recipientIdInput,
  recipientInfo,
  securityPassword,
  showLegacyGiftModal,
} = useLegacyGiftManager({
  addLog,
  batchLegacyGiftSendEnhanced: (...args) =>
    batchLegacyGiftSendEnhancedAction(...args),
  ensureConnection,
  message,
  selectedTokens,
  tokenStore,
  tokens,
});

const {
  claimHangUpRewards,
  batchAddHangUpTime,
  batchStudy,
  batchclubsign,
  batchClaimMailAttachment,
  batchWarGuessCheer,
  resetBottles,
  batchlingguanzi,
  climbTower,
  climbWeirdTower,
  batchClaimFreeEnergy,
  skinChallenge,
  batchUseItems,
  batchMergeItems,
  batchSmartSendCar,
  batchClaimCars,
  batchOpenBox,
  batchClaimBoxPointReward,
  batchFish,
  batchRecruit,
  batchHeroUpgrade,
  batchBookUpgrade,
  batchClaimStarRewards,
  batchClaimPeachTasks,
  batchGenieSweep,
  batchbaoku13,
  batchbaoku45,
  batchmengjing,
  batchBuyDreamItems,
  batcharenafight,
  batchArenaStandalone,
  batchTopUpFish,
  batchTopUpArena,
  legionStoreBuySkinCoins,
  legion_storebuygoods,
  store_purchase,
  collection_claimfreereward,
  batchLegacyClaim,
  batchLegacyGiftSendEnhanced,
  executeQuickTask,
  executeScheduledTask,
  forwardQuickTaskLog,
  getSelectedTokenIds,
  setSelectedTokenIds,
  startBatch,
  stopBatch,
} = useBatchTaskRuntime({
  DailyTaskRunner,
  addLog,
  autoScrollLog,
  availableTasks,
  batchSettings,
  calculateMonthProgress,
  canClaim,
  connectionQueue,
  currentRunningTokenId,
  currentSettings,
  ensureConnection,
  getTodayStartSec,
  giftQuantity,
  gradeLabel,
  helperSettings,
  isCarActivityOpen,
  isRunning,
  isTodayAvailable,
  isWeirdTowerActivityOpen,
  isarenaActivityOpen,
  isbaokuActivityOpen,
  ismengjingActivityOpen,
  loadSettings,
  logContainer,
  logs,
  message,
  nextTick,
  normalizeCars,
  pickArenaTargetId,
  recipientIdInput,
  recipientInfo,
  releaseConnectionSlot,
  securityPassword,
  selectedTokens,
  shouldSendCar,
  shouldStop,
  tokenStatus,
  tokenStore,
  tokens,
});

const {
  currentGuessCount,
  fetchWarGuessRank,
  handleWarGuessCheer,
  openWarGuessModal,
  selectedWarGuessLegionId,
  showWarGuessModal,
  warGuessCoin,
  warGuessColumns,
  warGuessList,
  warGuessLoading,
  warGuessRowProps,
} = useWarGuessManager({
  addLog,
  batchWarGuessCheer,
  h,
  isRunning,
  message,
  selectedTokens,
  tokenStore,
  tokens,
});

Object.assign(helperTaskActions, {
  batchFish,
  batchOpenBox,
  batchRecruit,
});
batchLegacyGiftSendEnhancedAction = batchLegacyGiftSendEnhanced;
quickTaskLogForwarder = forwardQuickTaskLog;

const {
  intervalId,
  scheduleTaskExecution,
  stopScheduler,
} = useScheduledTaskRunner({
  addLog,
  batchSettings,
  executeScheduledTask,
  isRunning,
  matchesCronExpression,
  scheduledTasks,
});

// Debug: Log initial state when component mounts
onMounted(() => {
  // Start the task scheduler after all functions are initialized
  scheduleTaskExecution();
  // Start countdown timer
  startCountdown();
  loadTaskTemplates();
});

// Cleanup countdown interval on unmount
onBeforeUnmount(() => {
  stopCountdown();
  stopScheduler();
});

defineExpose({
  executeQuickTask,
  setSelectedTokenIds,
  getSelectedTokenIds,
});
</script>

<style scoped lang="scss">
.batch-daily-tasks {
  padding: var(--spacing-md);
  height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  background: transparent;
  animation: batch-fade-in 0.4s ease;
}

.main-layout {
  display: flex;
  gap: var(--spacing-md);
  height: 100%;
  overflow: hidden;
}

.left-column {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
  padding-right: 8px;

  &::-webkit-scrollbar {
    width: 8px;
  }
}

.right-column {
  width: 400px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  height: 700px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: var(--spacing-md);
  background: var(--surface-glass);
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-large);
  box-shadow: var(--shadow-light);
  backdrop-filter: blur(10px);
  padding: var(--spacing-md);
}

[data-theme="dark"] .page-header {
  background: rgba(18, 32, 58, 0.72);
}

.header-left-wrap {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.header-info-chip,
.header-action-chip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--surface-glass-strong);
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-medium);
  flex-wrap: wrap;
}

.chip-text-main {
  font-size: 14px;
  color: var(--text-secondary);
}

.chip-text-highlight {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-color);
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
}

.chip-text-muted {
  font-size: 14px;
  color: var(--text-tertiary);
}

.chip-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.token-selection-top {
  margin-bottom: 16px;
}

.group-selection-header,
.group-manage-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
  flex-wrap: wrap;
}

.group-selection-label {
  font-weight: 500;
  color: var(--text-primary);
}

.group-tags-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.group-select-chip {
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  background: transparent;
  border: 2px solid var(--group-color);
  color: var(--group-color);
  font-weight: 400;
  transition: all 0.3s ease;
  user-select: none;
}

.group-select-chip.is-selected {
  background-color: var(--group-color);
  color: #fff;
  font-weight: 600;
}

.group-selected-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.sort-buttons {
  margin-bottom: 12px;
}

.token-item {
  display: flex;
  align-items: center;
}

.log-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.custom-card-header {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.log-header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
  flex-wrap: nowrap;
}

/* Cron Parser Styles */
.cron-parser {
  margin-top: 12px;
  padding: 12px;
  background-color: var(--bg-tertiary);
  border-radius: 8px;
}

.cron-validation {
  margin-bottom: 12px;
  padding: 8px;
  border-radius: 4px;
}

.cron-validation.success {
  background-color: rgba(24, 160, 88, 0.12);
}

.cron-validation.error {
  background-color: rgba(235, 87, 87, 0.12);
}

.cron-next-runs h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.cron-next-runs ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.cron-next-runs li {
  padding: 6px 0;
  font-size: 13px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

.cron-next-runs li:last-child {
  border-bottom: none;
}

.log-card :deep(.n-card__content) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.batch-daily-tasks :deep(.n-card) {
  border-radius: var(--border-radius-large);
  border: 1px solid var(--surface-glass-border);
  box-shadow: var(--shadow-light);
  background: var(--surface-glass-strong);
  backdrop-filter: blur(10px);
}

.batch-daily-tasks :deep(.n-card-header) {
  border-bottom: 1px solid var(--border-light);
}

.log-header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-container {
  flex: 1;
  overflow-y: auto;
  background: var(--surface-glass);
  padding: 10px;
  border-radius: var(--border-radius-medium);
  border: 1px solid var(--surface-glass-border);
  margin-top: 10px;
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
  min-height: 200px;
}

.log-item {
  margin-bottom: 4px;
  font-size: 12px;
}

.log-item.error {
  color: #d03050;
}

.log-item.success {
  color: #18a058;
}

.log-item.warning {
  color: #f0a020;
}

.log-item.info {
  color: var(--text-primary);
}

.time {
  color: var(--text-tertiary);
  margin-right: 8px;
}

.token-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 8px;
}

/* Settings Modal Styles */
.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-grid-block {
  display: block;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-item-row {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.setting-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.btn-mr {
  margin-right: 12px;
}

.btn-ml {
  margin-left: 12px;
}

.input-w-full {
  width: 100%;
}

.input-w-100 {
  width: 100px;
}

.input-w-120 {
  width: 120px;
}

.input-w-150 {
  width: 150px;
}

.input-w-180 {
  width: 180px;
}

.input-w-200 {
  width: 200px;
}

.modal-w-600 {
  width: 90%;
  max-width: 600px;
}

.modal-w-400 {
  width: 90%;
  max-width: 400px;
}

.modal-w-700 {
  width: 90%;
  max-width: 700px;
}

.modal-w-800 {
  width: 90%;
  max-width: 800px;
}

.modal-actions-right {
  margin-top: 20px;
  text-align: right;
}

.divider-section {
  margin: 0 0 16px 0;
}

.divider-tight {
  margin: 1px 0 8px 0;
}

.divider-normal {
  margin: 12px 0 8px 0;
}

.settings-grid-top-gap {
  margin-top: 12px;
}

.w-full {
  width: 100%;
}

.token-checkbox-main {
  flex: 1;
}

.ml-8 {
  margin-left: 8px;
}

.token-group-tag {
  font-size: 11px;
}

.token-group-list {
  margin-left: 8px;
  display: inline-flex;
  gap: 4px;
  flex-wrap: wrap;
}

.mt-16 {
  margin-top: 16px;
}

.log-count-meta {
  margin-left: 12px;
  font-size: 12px;
  color: var(--text-tertiary);
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
  transition: all 0.3s ease;
}

.avatar-container {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 0.3s ease;
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
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
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
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.role-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.task-tabs :deep(.n-tab-pane) {
  padding-top: 12px;
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

.info-value-power {
  font-size: 16px;
  font-weight: 600;
  color: #667eea;
}

.info-item-full {
  grid-column: 1 / -1;
}

.color-swatch {
  background-color: var(--swatch-color);
  border: 2px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.color-swatch.is-selected {
  border: 3px solid #000;
}

.color-swatch-md {
  width: 24px;
  height: 24px;
  transition: transform 0.2s;
}

.color-swatch-md:hover {
  transform: scale(1.1);
}

.color-swatch-sm {
  width: 20px;
  height: 20px;
}

.group-color-dot {
  background-color: var(--dot-color);
  width: 16px;
  height: 16px;
  border-radius: 3px;
}

.apply-group-quick {
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
  padding-bottom: 8px;
}

.apply-group-quick-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.apply-group-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.apply-group-btn {
  border-color: var(--group-color);
  color: var(--group-color);
}

.apply-group-empty {
  font-size: 12px;
  color: #ccc;
}

.apply-token-checklist {
  margin-top: 8px;
}

.template-header-row {
  margin-bottom: 16px;
}

.template-header-actions {
  display: flex;
  align-items: center;
}

.template-search-input {
  width: 200px;
}

.template-list-box {
  max-height: 400px;
  overflow-y: auto;
}

.template-item-card {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 8px;
  background: var(--surface-glass);
}

.template-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.template-item-title {
  margin: 0 0 4px 0;
  color: var(--text-primary);
}

.template-item-title-small {
  margin: 0;
  color: var(--text-primary);
}

.template-item-meta {
  color: var(--text-tertiary);
  font-size: 12px;
}

.template-item-actions {
  display: flex;
  gap: 8px;
}

.template-empty-state {
  text-align: center;
  color: var(--text-tertiary);
  padding: 24px;
}

.account-filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.account-filter-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.account-filter-select {
  width: 200px;
}

.dream-alert {
  margin-bottom: 16px;
}

.dream-actions-row {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}

.dream-merchant-block {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 8px;
  background: var(--surface-glass);
}

.dream-merchant-title {
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--text-primary);
}

.setting-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
}

.task-group-quick {
  margin-bottom: 12px;
}

.task-group-quick-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
}

.task-group-quick-text {
  font-size: 12px;
  color: var(--text-tertiary);
}

.task-group-empty {
  font-size: 12px;
  color: #ccc;
}

.task-group-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tasks-list {
  max-height: 600px;
  overflow-y: auto;
}

.task-item {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 8px;
  background: var(--surface-glass-strong);
}

.task-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.task-item-title {
  font-weight: 700;
}

.task-item-row {
  margin-bottom: 4px;
}

.task-item-row-last {
  margin-bottom: 8px;
}

.task-item-label {
  color: var(--text-tertiary);
}

.task-item-actions {
  display: flex;
  gap: 8px;
}

.task-next-run {
  font-weight: 700;
}

.task-next-run.is-near {
  color: #ff4d4f;
}

.task-next-run.is-normal {
  color: #1677ff;
}

.task-group-btn {
  border-color: var(--group-color);
}

.task-empty-state,
.group-empty-state {
  text-align: center;
  padding: 24px;
  color: var(--text-tertiary);
}

.war-guess-toolbar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.war-guess-label {
  font-size: 16px;
}

.war-guess-table {
  height: 400px;
  flex: 1;
}

.group-create-section {
  margin-bottom: 24px;
}

.group-create-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.group-color-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.group-color-label {
  font-size: 12px;
}

.group-color-list {
  display: flex;
  gap: 6px;
  align-items: center;
}

.group-account-box {
  background: var(--surface-glass);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--surface-glass-border);
}

.group-account-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}

.group-account-title {
  font-size: 13px;
  font-weight: 700;
}

.group-account-list {
  max-height: 150px;
  overflow-y: auto;
}

.group-list-container {
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid var(--surface-glass-border);
  border-radius: 8px;
  padding: 12px;
}

.group-list-item {
  padding: 12px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 6px;
  margin-bottom: 12px;
  background: var(--surface-glass);
}

.group-list-item-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.group-list-main {
  flex: 1;
}

.group-edit-row {
  display: flex;
  gap: 8px;
}

.group-mini-btn {
  margin-right: 8px;
}

.group-name-row {
  margin-bottom: 8px;
}

.group-name-text {
  font-weight: 600;
  color: var(--text-primary);
}

.group-token-tags {
  margin-bottom: 8px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.group-token-tag {
  font-size: 11px;
}

.group-add-token-row {
  margin-top: 8px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.group-item-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.setting-switches {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light);
}

.switch-row:last-child {
  border-bottom: none;
}

.switch-label {
  font-size: 14px;
  color: var(--text-secondary);
}

/* Responsive Design */
@media (max-width: 1200px) {
  .right-column {
    width: 380px;
  }
}

@media (max-width: 992px) {
  .batch-daily-tasks {
    height: auto;
    overflow: visible;
  }

  .main-layout {
    flex-direction: column;
    height: auto;
    overflow: visible;
  }

  .left-column {
    overflow-y: visible;
    padding-right: 0;
  }

  .right-column {
    width: 100%;
    height: auto;
    flex-shrink: 0;
  }

  .log-container {
    height: 300px;
    min-height: 300px;
  }
}

@media (max-width: 768px) {
  .batch-daily-tasks :deep(.n-button) {
    min-height: 40px;
  }

  .batch-daily-tasks :deep(.n-button.n-button--small-type),
  .batch-daily-tasks :deep(.n-button.n-button--medium-type),
  .batch-daily-tasks :deep(.n-button.n-button--tiny-type) {
    min-height: 40px;
    padding-left: 12px;
    padding-right: 12px;
  }

  .batch-daily-tasks {
    padding: 12px;
    height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .main-layout {
    height: auto;
    overflow: visible;
    flex-direction: column;
  }

  .left-column {
    overflow: visible;
    padding-right: 0;
    flex: none;
    height: auto;
  }

  .right-column {
    height: auto;
    width: 100%;
    flex: none;
  }

  .page-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
    padding: var(--spacing-sm);
  }

  .header-left-wrap {
    width: 100%;
    align-items: stretch;
    gap: 10px;
  }

  .header-info-chip,
  .header-action-chip {
    width: 100%;
    justify-content: flex-start;
  }

  .chip-actions {
    width: 100%;
  }

  .chip-actions :deep(.n-button) {
    flex: 1;
    min-width: 96px;
  }

  .page-header .actions {
    display: flex;
    gap: 8px;
  }

  .task-item-head,
  .setting-header-row,
  .task-group-quick-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .task-item-actions {
    flex-wrap: wrap;
  }

  .log-card {
    height: auto !important;
  }

  .log-card :deep(.n-card__content) {
    flex: none !important;
    overflow: visible !important;
    display: block !important;
  }

  .log-container {
    height: 300px;
    min-height: 300px;
    flex: none !important;
  }

  .log-header-controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  /* 批量功法残卷赠送样式 */
  .recipient-info:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  }

  /* 头像悬停效果 */
  .avatar-container:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.3);
  }

  /* 加载动画 */
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* Token分组管理样式 */
  .group-selection-section {
    padding: 12px;
    background-color: var(--surface-glass);
    border-radius: 8px;
    border: 1px solid var(--surface-glass-border);
  }

  .group-tag {
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
    user-select: none;
    text-align: center;
    font-weight: 500;
  }

  .group-tag:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .group-tag-selected {
    color: white;
    font-weight: 600;
  }

  /* 响应式设计 */
  @media (max-width: 600px) {
    .recipient-info {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .avatar-container {
      margin-bottom: 12px;
    }
  }
}

@keyframes batch-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
