<template>
  <div class="token-import-page">
    <div class="container token-import-page__container app-page">
      <section class="app-page__hero token-import-hero">
        <div class="app-page__hero-copy">
          <span class="app-page__eyebrow">Token 工作区</span>
          <h1 class="app-page__title">{{ t("tokenImport.header.title") }}</h1>
          <p class="app-page__description">
            {{ tokenHeroDescription }}
          </p>
          <div class="app-chip-row">
            <span class="app-inline-stat">
              <strong>{{
                authStore.user?.username || t("tokenImport.header.notLoggedIn")
              }}</strong>
              当前账号
            </span>
            <span class="app-inline-stat">
              <strong>{{ tokenStore.gameTokens.length }}</strong>
              已导入角色
            </span>
            <span class="app-inline-stat">
              <strong>{{ persistentTokenCount }}</strong>
              长效凭证
            </span>
            <span class="app-inline-stat">
              <strong>{{ binFiles.length }}</strong>
              BIN 文件
            </span>
          </div>
        </div>

        <div class="app-page__actions token-import-page__actions">
          <NButton
            v-if="!showImportForm"
            size="large"
            type="primary"
            @click="showImportForm = true"
          >
            <template #icon>
              <NIcon>
                <Add></Add>
              </NIcon>
            </template>
            {{ t("tokenImport.actions.addToken") }}
          </NButton>

          <NButton
            v-if="tokenStore.hasUsableWorkbenchToken"
            secondary
            size="large"
            type="primary"
            @click="goToDashboard"
          >
            <template #icon>
              <NIcon>
                <List></List>
              </NIcon>
            </template>
            {{ t("tokenImport.actions.batchFeatures") }}
          </NButton>

          <NButton
            v-if="authStore.user?.isAdmin && authStore.user?.mfaEnabled"
            quaternary
            size="large"
            type="primary"
            @click="goToAdminCenter"
          >
            管理中心
          </NButton>
        </div>
      </section>

      <div class="app-page__summary token-import-summary">
        <article
          v-for="card in tokenSummaryCards"
          :key="card.label"
          class="app-summary-card token-import-summary__card"
        >
          <span class="app-summary-card__label">{{ card.label }}</span>
          <strong class="app-summary-card__value">{{ card.value }}</strong>
          <span class="app-summary-card__meta">{{ card.meta }}</span>
        </article>
      </div>

      <div class="token-import-mobile-actions">
        <NButton
          v-if="!showImportForm"
          size="large"
          type="primary"
          @click="showImportForm = true"
        >
          <template #icon>
            <NIcon>
              <Add></Add>
            </NIcon>
          </template>
          {{ t("tokenImport.actions.addToken") }}
        </NButton>

        <NButton
          v-if="tokenStore.hasUsableWorkbenchToken"
          secondary
          size="large"
          type="primary"
          @click="goToDashboard"
        >
          <template #icon>
            <NIcon>
              <List></List>
            </NIcon>
          </template>
          {{ t("tokenImport.actions.batchFeatures") }}
        </NButton>

        <NButton
          v-if="authStore.user?.isAdmin && authStore.user?.mfaEnabled"
          quaternary
          size="large"
          type="primary"
          @click="goToAdminCenter"
        >
          管理中心
        </NButton>
      </div>

      <!-- Token导入区域 -->
      <a-modal
        class="token-import-modal"
        width="40rem"
        v-model:visible="showImportForm"
        :default-visible="!tokenStore.hasTokens"
        :footer="false"
      >
        <template #title>
          <h2>
            <NIcon>
              <Add></Add>
            </NIcon>
            {{ t("tokenImport.importModal.title") }}
          </h2>
        </template>
        <div class="card-header">
          <!-- 导入方式选择 -->
          <n-radio-group
            class="import-method-tabs"
            size="small"
            v-model:value="importMethod"
          >
            <n-radio-button value="manual">
              {{ t("tokenImport.importMethods.manual") }}
            </n-radio-button>
            <n-radio-button value="url">
              {{ t("tokenImport.importMethods.url") }}
            </n-radio-button>
            <n-radio-button value="wxQrcode">
              {{ t("tokenImport.importMethods.wxQrcode") }}
            </n-radio-button>
            <n-radio-button value="bin">
              {{ t("tokenImport.importMethods.bin") }}
            </n-radio-button>
            <n-radio-button value="singlebin">
              {{ t("tokenImport.importMethods.singlebin") }}
            </n-radio-button>
          </n-radio-group>
        </div>
        <div class="card-body">
          <ManualTokenForm
            v-if="importMethod === 'manual'"
            @cancel="() => (showImportForm = false)"
            @ok="handleImportSuccess"
          ></ManualTokenForm>
          <UrlTokenForm
            v-if="importMethod === 'url'"
            @cancel="() => (showImportForm = false)"
            @ok="handleImportSuccess"
          ></UrlTokenForm>
          <WxQrcodeForm
            v-if="importMethod === 'wxQrcode'"
            @cancel="() => (showImportForm = false)"
            @ok="handleImportSuccess"
          ></WxQrcodeForm>
          <BinTokenForm
            v-if="importMethod === 'bin'"
            @cancel="() => (showImportForm = false)"
            @ok="handleImportSuccess"
          ></BinTokenForm>
          <single-bin-token-form
            v-if="importMethod === 'singlebin'"
            @cancel="() => (showImportForm = false)"
            @ok="handleImportSuccess"
          ></single-bin-token-form>
        </div>
      </a-modal>

      <n-card class="bin-files-section" size="small">
        <template #header>
          <div class="bin-files-header">
            <div>
              <h2>
                {{
                  t("tokenImport.binFiles.title", { count: binFiles.length })
                }}
              </h2>
              <p>{{ t("tokenImport.binFiles.desc") }}</p>
              <n-tag
                v-if="sensitiveConfirmRemainingText"
                size="small"
                type="warning"
              >
                {{ sensitiveConfirmRemainingText }}
              </n-tag>
            </div>
            <NButton
              class="bin-files-refresh-button"
              size="small"
              :loading="binFilesLoading"
              @click="loadBinFiles"
            >
              <template #icon>
                <NIcon>
                  <Refresh></Refresh>
                </NIcon>
              </template>
              {{ t("tokenImport.binFiles.refresh") }}
            </NButton>
          </div>
        </template>
        <n-spin :show="binFilesLoading">
          <div v-if="isMobile" class="bin-files-mobile-list">
            <article
              v-for="row in binFiles"
              :key="row.tokenId"
              class="bin-file-card"
            >
              <div class="bin-file-card__head">
                <strong>{{ row.fileName }}</strong>
                <span>{{ row.tokenId }}</span>
              </div>
              <div class="bin-file-card__meta">
                <div>
                  <span>大小</span>
                  <strong>{{ row.sizeLabel || row.size || "-" }}</strong>
                </div>
                <div>
                  <span>更新时间</span>
                  <strong>{{ formatTime(row.updatedAt || row.createdAt) }}</strong>
                </div>
              </div>
              <div class="bin-file-card__actions">
                <NButton
                  secondary
                  size="small"
                  :disabled="!remoteBinDownloadEnabled"
                  :loading="!!binDownloading[row.tokenId]"
                  @click="downloadSavedBinFile(row)"
                >
                  {{ t("tokenImport.actions.download") }}
                </NButton>
                <NButton
                  secondary
                  size="small"
                  type="error"
                  :loading="!!binDeleting[row.tokenId]"
                  @click="deleteSavedBinFile(row)"
                >
                  {{ t("tokenImport.actions.delete") }}
                </NButton>
              </div>
            </article>
            <n-empty
              v-if="!binFiles.length"
              class="bin-files-mobile-empty"
              description="暂无已保存 BIN 文件"
            ></n-empty>
          </div>
          <n-data-table
            v-else
            size="small"
            :columns="binFileColumns"
            :data="binFiles"
            :loading="binFilesLoading"
            :pagination="{ pageSize: 5 }"
          ></n-data-table>
        </n-spin>
      </n-card>

      <!-- Token列表 -->
      <div v-if="tokenStore.hasTokens" class="tokens-section">
        <div class="section-header">
          <n-space align="center" class="section-header__primary">
            <h2>
              {{
                t("tokenImport.tokenList.title", {
                  count: tokenStore.gameTokens.length,
                })
              }}
            </h2>
            <n-radio-group v-if="!isMobile" size="small" v-model:value="viewMode">
              <n-radio-button value="list">{{
                t("tokenImport.viewModes.list")
              }}</n-radio-button>
              <n-radio-button value="card">{{
                t("tokenImport.viewModes.card")
              }}</n-radio-button>
            </n-radio-group>
            <n-divider vertical class="divider-h-24"></n-divider>
            <n-button-group class="token-sort-controls" size="small">
              <NButton
                :type="sortConfig.field === 'name' ? 'primary' : 'default'"
                @click="toggleSort('name')"
              >
                {{ t("tokenImport.sort.name") }} {{ getSortIcon("name") }}
              </NButton>
              <NButton
                :type="sortConfig.field === 'server' ? 'primary' : 'default'"
                @click="toggleSort('server')"
              >
                {{ t("tokenImport.sort.server") }} {{ getSortIcon("server") }}
              </NButton>
              <NButton
                :type="sortConfig.field === 'createdAt' ? 'primary' : 'default'"
                @click="toggleSort('createdAt')"
              >
                {{ t("tokenImport.sort.createdAt") }}
                {{ getSortIcon("createdAt") }}
              </NButton>
              <NButton
                :type="sortConfig.field === 'lastUsed' ? 'primary' : 'default'"
                @click="toggleSort('lastUsed')"
              >
                {{ t("tokenImport.sort.lastUsed") }}
                {{ getSortIcon("lastUsed") }}
              </NButton>
            </n-button-group>
          </n-space>
          <div class="header-actions">
            <NButton
              v-if="tokenStore.hasUsableWorkbenchToken"
              type="success"
              @click="goToDashboard"
            >
              <template #icon>
                <NIcon>
                  <List></List>
                </NIcon>
              </template>
              {{ t("tokenImport.actions.batchFeatures") }}
            </NButton>

            <NButton
              v-if="!showImportForm"
              type="primary"
              @click="showImportForm = true"
            >
              <template #icon>
                <NIcon>
                  <Add></Add>
                </NIcon>
              </template>
              {{ t("tokenImport.actions.addToken") }}
            </NButton>

            <n-dropdown :options="bulkOptions" @select="handleBulkAction">
              <NButton>
                <template #icon>
                  <NIcon>
                    <Menu></Menu>
                  </NIcon>
                </template>
                {{ t("tokenImport.actions.bulkActions") }}
              </NButton>
            </n-dropdown>
          </div>
        </div>

        <div v-if="activeViewMode === 'card'" class="tokens-grid">
          <a-card
            v-for="(token, index) in sortedTokens"
            :key="token.id"
            class="token-card"
            draggable="true"
            :class="{
              active: selectedTokenId === token.id,
            }"
            @click="selectToken(token)"
            @dragover="handleDragOver($event)"
            @dragstart="handleDragStart(index, $event)"
            @drop="handleDrop(index, $event)"
          >
            <template #title>
              <div class="token-card-title">
                <div class="token-card-title__main">
                  <n-avatar
                    v-if="token.avatar"
                    round
                    fallback-src="/icons/xiaoyugan.png"
                    size="small"
                    :src="token.avatar"
                  ></n-avatar>
                  <div class="token-card-title__identity">
                    <strong class="token-card-title__name">{{ token.name }}</strong>
                  </div>
                </div>
                <div class="token-card-title__meta">
                  <n-tag
                    v-if="hasMissingBinSource(token)"
                    size="small"
                    type="error"
                  >
                    {{ t("tokenImport.tokenCard.missingSource") }}
                  </n-tag>
                </div>
              </div>
            </template>
            <template #extra>
              <n-dropdown
                :options="getTokenActions(token)"
                @select="(key) => handleTokenMenuAction(key, token)"
              >
                <NButton text>
                  <template #icon>
                    <NIcon>
                      <EllipsisHorizontal></EllipsisHorizontal>
                    </NIcon>
                  </template>
                </NButton>
              </n-dropdown>
            </template>

            <template #default>
              <div class="token-card-overview">
                <div class="token-card-overview__item token-card-overview__item--server">
                  <span>区号</span>
                  <strong>{{ resolveTokenServerLabel(token) || "未识别" }}</strong>
                </div>
                <div class="token-card-overview__item">
                  <span>状态</span>
                  <strong>{{ getConnectionStatusText(token.id) }}</strong>
                </div>
              </div>

              <div class="token-display">
                <span class="token-label">{{
                  t("tokenImport.labels.token")
                }}</span>
                <code class="token-value">{{ maskToken(token.token) }}</code>
              </div>

              <div class="token-timestamps">
                <div class="timestamp-item">
                  <span class="timestamp-label">{{
                    t("tokenImport.labels.created")
                  }}</span>
                  <span class="timestamp-value">{{
                    formatTime(token.createdAt)
                  }}</span>
                </div>
                <div class="timestamp-item">
                  <span class="timestamp-label">{{
                    t("tokenImport.labels.used")
                  }}</span>
                  <span class="timestamp-value">{{
                    formatTime(token.lastUsed)
                  }}</span>
                </div>
              </div>

              <!-- 存储类型信息 -->
              <div class="storage-info">
                <div class="storage-item">
                  <span class="storage-label">{{
                    t("tokenImport.labels.storageType")
                  }}</span>
                  <n-tag
                    size="small"
                    :type="
                      token.importMethod === 'url' ||
                      token.importMethod === 'bin' ||
                      token.importMethod === 'wxQrcode' ||
                      token.upgradedToPermanent
                        ? 'success'
                        : 'warning'
                    "
                  >
                    {{ getLongStorageLabel(token) }}
                  </n-tag>
                </div>
                <div v-if="hasMissingBinSource(token)" class="storage-item">
                  <span class="storage-label">{{
                    t("tokenImport.labels.sourceFile")
                  }}</span>
                  <n-tag size="small" type="error">{{
                    t("tokenImport.tokenCard.missingBinSource")
                  }}</n-tag>
                </div>

                <!-- 升级选项（仅对临时存储的token显示） -->
                <div
                  v-if="
                    !(
                      token.importMethod === 'url' ||
                      token.importMethod === 'bin' ||
                      token.importMethod === 'wxQrcode' ||
                      token.upgradedToPermanent
                    )
                  "
                  class="storage-upgrade"
                >
                  <NButton
                    ghost
                    size="tiny"
                    type="success"
                    @click.stop="upgradeTokenToPermanent(token)"
                  >
                    <template #icon>
                      <NIcon>
                        <Star></Star>
                      </NIcon>
                    </template>
                    {{ t("tokenImport.actions.upgradePermanent") }}
                  </NButton>
                </div>
              </div>
            </template>
            <template #actions>
              <NButton
                block
                size="large"
                type="primary"
                :loading="connectingTokens.has(token.id)"
                @click="startTaskManagement(token)"
              >
                <template #icon>
                  <NIcon>
                    <Home></Home>
                  </NIcon>
                </template>
                {{ t("tokenImport.actions.enterConsole") }}
              </NButton>
            </template>
          </a-card>
        </div>

        <!-- List View -->
        <div v-else class="tokens-list">
          <n-card
            v-for="(token, index) in sortedTokens"
            :key="token.id"
            hoverable
            class="token-list-card"
            draggable="true"
            size="small"
            :class="{ active: selectedTokenId === token.id }"
            @click="selectToken(token)"
            @dragover="handleDragOver($event)"
            @dragstart="handleDragStart(index, $event)"
            @drop="handleDrop(index, $event)"
          >
            <n-space align="center" justify="space-between">
              <!-- Info -->
              <n-space align="center" :size="6">
                <!-- 连接状态 - 移动到最前端显示 -->
                <div class="min-w-65">
                  <a-badge
                    :status="getTokenStyle(token.id)"
                    :text="getConnectionStatusText(token.id)"
                  ></a-badge>
                </div>
                <!-- Avatar -->
                <n-avatar
                  v-if="token.avatar"
                  round
                  fallback-src="/icons/xiaoyugan.png"
                  size="small"
                  :src="token.avatar"
                ></n-avatar>

                <!-- Token基本信息 -->
                <div class="min-w-100">
                  <div class="token-basic-row">
                    <span class="token-name-text">{{ token.name }}</span>
                    <n-tag
                      v-if="hasMissingBinSource(token)"
                      size="small"
                      type="error"
                    >
                      {{ t("tokenImport.tokenCard.missingSource") }}
                    </n-tag>
                    <n-tag
                      v-if="token.server"
                      size="small"
                      :type="getServerTagType(token.id)"
                    >
                      {{ token.server }}
                    </n-tag>
                    <!-- 备注信息 - 显示在服务器信息后面 -->
                    <div
                      v-if="editingRemark === token.id"
                      class="token-remark-inline-edit"
                      @click.stop
                    >
                      <i class="i-mdi:note-outline note-icon-tight"></i>
                      <n-input
                        autofocus
                        class="remark-input-w-150"
                        size="small"
                        v-model:value="tempRemarks[token.id]"
                        :placeholder="t('tokenImport.placeholders.remarkShort')"
                        @blur="saveRemark(token)"
                        @keyup.enter="saveRemark(token)"
                        @keyup.esc="cancelEditRemark()"
                      ></n-input>
                    </div>
                    <div
                      v-else
                      class="token-remark-inline-view"
                      @click.stop="startEditRemark(token)"
                    >
                      <i class="i-mdi:note-outline note-icon-tight"></i>
                      {{
                        token.remark ||
                        t("tokenImport.placeholders.remarkClick")
                      }}
                      <NIcon class="remark-create-icon">
                        <Create></Create>
                      </NIcon>
                    </div>
                  </div>
                </div>
              </n-space>

              <!-- Actions -->
              <n-space>
                <!-- 存储类型 -->
                <n-tag
                  size="small"
                  :type="
                    token.importMethod === 'url' ||
                    token.importMethod === 'bin' ||
                    token.importMethod === 'wxQrcode' ||
                    token.upgradedToPermanent
                      ? 'success'
                      : 'warning'
                  "
                >
                  {{ getShortStorageLabel(token) }}
                </n-tag>

                <!-- 升级选项（仅对临时存储的token显示） -->
                <NButton
                  v-if="
                    !(
                      token.importMethod === 'url' ||
                      token.importMethod === 'bin' ||
                      token.importMethod === 'wxQrcode' ||
                      token.upgradedToPermanent
                    )
                  "
                  ghost
                  size="small"
                  type="success"
                  @click.stop="upgradeTokenToPermanent(token)"
                >
                  <template #icon>
                    <NIcon>
                      <Star></Star>
                    </NIcon>
                  </template>
                  {{ t("tokenImport.actions.upgrade") }}
                </NButton>

                <NButton
                  size="small"
                  type="primary"
                  :loading="connectingTokens.has(token.id)"
                  @click.stop="startTaskManagement(token)"
                >
                  <template #icon>
                    <NIcon>
                      <Home></Home>
                    </NIcon>
                  </template>
                  {{ t("tokenImport.actions.console") }}
                </NButton>
                <NButton
                  size="small"
                  :loading="refreshingTokens.has(token.id)"
                  @click.stop="refreshToken(token)"
                >
                  <template #icon>
                    <NIcon>
                      <Refresh></Refresh>
                    </NIcon>
                  </template>
                  {{ t("tokenImport.actions.refresh") }}
                </NButton>
                <n-dropdown
                  :options="getTokenActions(token)"
                  @select="(key) => handleTokenMenuAction(key, token)"
                >
                  <NButton circle size="small" @click.stop>
                    <template #icon>
                      <NIcon>
                        <EllipsisHorizontal></EllipsisHorizontal>
                      </NIcon>
                    </template>
                  </NButton>
                </n-dropdown>
              </n-space>
            </n-space>
          </n-card>
        </div>
      </div>

      <!-- 空状态 -->
      <a-empty v-if="!tokenStore.hasTokens && !showImportForm">
        <template #image>
          <i class="mdi:bed-empty"></i>
        </template>
        {{ t("tokenImport.empty.noTokens") }}
        <a-button type="link" @click="openshowImportForm">
          {{ t("tokenImport.empty.openManager") }}
        </a-button>
      </a-empty>
    </div>

    <!-- 编辑Token模态框 -->
    <n-modal
      class="modal-w-500"
      preset="card"
      v-model:show="showEditModal"
      :title="t('tokenImport.editModal.title')"
    >
      <n-form
        ref="editFormRef"
        label-placement="left"
        label-width="80px"
        :model="editForm"
        :rules="editRules"
      >
        <n-form-item
          path="name"
          :label="t('tokenImport.editModal.fields.name')"
        >
          <n-input v-model:value="editForm.name"></n-input>
        </n-form-item>
        <n-form-item
          path="token"
          :label="t('tokenImport.editModal.fields.token')"
        >
          <n-input
            clearable
            type="textarea"
            v-model:value="editForm.token"
            :placeholder="t('tokenImport.editModal.placeholders.token')"
            :rows="3"
          ></n-input>
        </n-form-item>
        <n-form-item :label="t('tokenImport.editModal.fields.server')">
          <n-input v-model:value="editForm.server"></n-input>
        </n-form-item>
        <n-collapse>
          <n-collapse-item
            name="advancedWs"
            :title="t('tokenImport.wsSecurity.advancedSettings')"
          >
            <n-form-item :label="t('tokenImport.editModal.fields.wsUrl')">
              <n-input v-model:value="editForm.wsUrl"></n-input>
            </n-form-item>
            <n-alert
              v-if="editFormWsRisk.shouldWarn"
              type="error"
              :show-icon="true"
            >
              {{ t("tokenImport.wsSecurity.riskWarning") }}
            </n-alert>
          </n-collapse-item>
        </n-collapse>
        <n-form-item :label="t('tokenImport.editModal.fields.remark')">
          <n-input
            type="textarea"
            v-model:value="editForm.remark"
            :placeholder="t('tokenImport.editModal.placeholders.remark')"
            :rows="2"
          ></n-input>
        </n-form-item>
      </n-form>

      <template #footer>
        <div class="modal-actions">
          <NButton @click="showEditModal = false">
            {{ t("tokenImport.common.cancel") }}
          </NButton>
          <NButton type="primary" @click="saveEdit">
            {{ t("tokenImport.common.save") }}
          </NButton>
        </div>
      </template>
    </n-modal>

    <n-modal
      class="modal-w-500"
      preset="card"
      title="Token激活"
      v-model:show="showActivationModal"
      :mask-closable="false"
      @close="cancelActivationInput"
    >
      <n-form label-placement="left" label-width="96px">
        <n-form-item label="角色名称">
          <n-input
            readonly
            :value="activationTargetToken?.name || '-'"
          ></n-input>
        </n-form-item>
        <n-form-item label="RoleID">
          <n-input
            readonly
            placeholder="自动识别6-12位游戏内角色RoleID"
            :value="activationResolvedRoleId || '-'"
          ></n-input>
        </n-form-item>
        <n-form-item label="激活码">
          <n-input
            placeholder="请输入一次性激活码"
            v-model:value="activationForm.activationCode"
            :disabled="activationSubmitting"
          ></n-input>
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="modal-actions">
          <NButton
            :disabled="activationSubmitting"
            @click="cancelActivationInput"
          >
            {{ t("tokenImport.common.cancel") }}
          </NButton>
          <NButton
            type="primary"
            :loading="activationSubmitting"
            @click="confirmActivationInput"
          >
            确认激活
          </NButton>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import ManualTokenForm from "./manual.vue";
import UrlTokenForm from "./url.vue";
import BinTokenForm from "./bin.vue";
import singleBinTokenForm from "./singlebin.vue";
import WxQrcodeForm from "./wxqrcode.vue";
import { useTokenImportActivation } from "./useTokenImportActivation";
import { useTokenImportBinFiles } from "@/composables/useTokenImportBinFiles";
import { useTokenImportListActions } from "@/composables/useTokenImportListActions";
import { useTokenImportTokenActions } from "@/composables/useTokenImportTokenActions";
import { analyzeWsUrlSafety } from "@/services/tokenImport/wsUrlSafety";
import api from "@/api";

import { selectedTokenId, useTokenStore } from "@/stores/tokenStore";
import { useAuthStore } from "@/stores/auth";
import {
  Add,
  Create,
  EllipsisHorizontal,
  Home,
  List,
  Menu,
  Refresh,
  Star,
} from "@vicons/ionicons5";
import { NButton, NIcon, useDialog, useMessage } from "naive-ui/es";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import {
  consumeTokenImportLaunchPayload,
  consumeTokenImportRouteNotice,
  extractSensitiveTokenImportQuery,
  getSanitizedTokenImportQuery,
} from "@/services/tokenImport/tokenImportRouteHandoff";
import {
  getTokenViewMode,
  setTokenViewMode,
} from "@/services/tokenImport/tokenImportPreferences";
import {
  fetchTokenPayloadFromUrl,
  isTrustedTokenImportUrl,
} from "@/services/tokenImport/tokenRemoteSource";
import { useResponsive } from "@/composables/useResponsive";
import { maskToken } from "@/utils/securitySanitizer";
// 接收路由参数
const props = defineProps({
  name: String,
  server: String,
  auto: Boolean,
});

const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const { locale, t } = useI18n();
const tokenStore = useTokenStore();
const authStore = useAuthStore();
const { isMobile } = useResponsive();

// 响应式数据
const showImportForm = ref(false);
const isImporting = ref(false);
const editFormRef = ref(null);
const importMethod = ref("manual");
const connectingTokens = ref(new Set());
// 从localStorage读取上次的视图模式，默认为列表视图
const viewMode = ref(getTokenViewMode());

const hasMissingBinSource = (token) =>
  (token.importMethod === "bin" || token.importMethod === "wxQrcode") &&
  token.binSourceState === "missing";

const isPersistentToken = (token) =>
  token.importMethod === "url" ||
  token.importMethod === "bin" ||
  token.importMethod === "wxQrcode" ||
  token.upgradedToPermanent;

const getLongStorageLabel = (token) =>
  isPersistentToken(token)
    ? t("tokenImport.storage.long")
    : t("tokenImport.storage.temporary");

const getShortStorageLabel = (token) =>
  isPersistentToken(token)
    ? t("tokenImport.storage.longShort")
    : t("tokenImport.storage.temporaryShort");

const persistentTokenCount = computed(
  () =>
    tokenStore.gameTokens.filter((token) => isPersistentToken(token)).length,
);

const tokenHeroDescription = computed(() => {
  const username =
    authStore.user?.username || t("tokenImport.header.notLoggedIn");
  if (!tokenStore.hasTokens) {
    return `${username} · ${t("tokenImport.header.accountIsolation")}。先导入一个角色，后续再统一做刷新、批量操作和连接管理。`;
  }

  return `${username} · ${t("tokenImport.header.accountIsolation")}`;
});

const activeViewMode = computed(() => (isMobile.value ? "card" : viewMode.value));

const normalizeTokenServerLabel = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.replace(/^(\d+)$/, "$1");
};

const normalizeTokenServerIdLabel = (value) => {
  let serverId = Number(value);
  if (!Number.isFinite(serverId) || serverId <= 0) return "";
  if (serverId >= 2000000) {
    serverId -= 2000000;
  } else if (serverId >= 1000000) {
    serverId -= 1000000;
  }
  const serverNo = serverId > 27 ? serverId - 27 : serverId;
  return Number.isFinite(serverNo) && serverNo > 0 ? String(serverNo) : "";
};

const getTokenPayloadObject = (token) => {
  const raw = String(token?.token || "").trim();
  if (!raw) return null;

  const parseJson = (value) => {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  };

  const direct = parseJson(raw);
  if (direct) return direct;
  if (typeof atob !== "function") return null;

  try {
    const decoded = atob(raw.replace(/^data:.*base64,/, ""));
    return parseJson(decoded);
  } catch {
    return null;
  }
};

const collectServerCandidates = (source) => {
  if (!source || typeof source !== "object") return [];
  return [
    source.server,
    source.serverName,
    source.region,
    source.regionName,
    source.area,
    source.areaId,
    source.activationRegion,
    source.role?.server,
    source.role?.serverName,
    source.data?.server,
    source.data?.serverName,
    source.data?.role?.server,
    source.data?.role?.serverName,
    normalizeTokenServerIdLabel(source.serverId),
    normalizeTokenServerIdLabel(source.server_id),
    normalizeTokenServerIdLabel(source.areaId),
    normalizeTokenServerIdLabel(source.role?.serverId),
    normalizeTokenServerIdLabel(source.data?.serverId),
    normalizeTokenServerIdLabel(source.data?.role?.serverId),
  ];
};

const resolveTokenServerLabel = (token) => {
  const directCandidates = collectServerCandidates(token);
  const payloadCandidates = collectServerCandidates(getTokenPayloadObject(token));
  const roleIndex = String(token?.roleIndex ?? "").trim();
  const fallbackRoleIndex = /^\d{3,}$/.test(roleIndex) ? roleIndex : "";

  return [
    ...directCandidates,
    ...payloadCandidates,
    fallbackRoleIndex,
  ].map(normalizeTokenServerLabel).find(Boolean) || "";
};

const tokenSummaryCards = computed(() => [
  {
    label: "当前角色",
    value: tokenStore.selectedToken?.name || "未选择",
    meta: tokenStore.selectedToken?.server || "先在列表里选择一个角色",
  },
  {
    label: "工作模式",
    value:
      activeViewMode.value === "card"
        ? t("tokenImport.viewModes.card")
        : t("tokenImport.viewModes.list"),
    meta: isMobile.value
      ? "手机端自动切换为卡片操作"
      : "桌面端可在列表与卡片间切换",
  },
  {
    label: "安全与凭证",
    value: sensitiveConfirmRemainingText.value || "无需再次确认",
    meta: `${persistentTokenCount.value} 个长效凭证 · ${binFiles.value.length} 个 BIN 文件`,
  },
]);
const {
  activationForm,
  activationResolvedRoleId,
  activationSubmitting,
  activationTargetToken,
  cancelActivationInput,
  confirmActivationInput,
  ensureTokenActivation,
  showActivationModal,
} = useTokenImportActivation({
  api,
  message,
  tokenStore,
});

// 监听视图模式变化，保存到localStorage
watch(viewMode, (newViewMode) => {
  setTokenViewMode(newViewMode);
});

const handleImportSuccess = async () => {
  showImportForm.value = false;
  await loadBinFiles();
};

const handleLogout = async () => {
  await authStore.logout();
  message.success(t("tokenImport.messages.loggedOut"));
  if (typeof window !== "undefined") {
    window.location.replace("/");
    return;
  }
  await router.replace("/");
};

const goToAdminCenter = () => {
  if (!authStore.user?.isAdmin || !authStore.user?.mfaEnabled) {
    router.push({ path: "/admin/profile", query: { adminMfaRequired: "1" } });
    return;
  }
  router.push("/admin/admin-users");
};

/**
 * 手动打开Token管理卡片
 */
const openshowImportForm = () => {
  showImportForm.value = true;
};

const formatTime = (timestamp) => {
  const localeTag = locale.value === "zh-CN" ? "zh-CN" : "en-US";
  return new Date(timestamp).toLocaleString(localeTag);
};

const {
  binDeleting,
  binDownloading,
  binFileColumns,
  binFiles,
  binFilesLoading,
  deleteSavedBinFile,
  downloadSavedBinFile,
  loadBinFiles,
  loadRemoteBinDownloadPreference,
  remoteBinDownloadEnabled,
  sensitiveConfirmRemainingText,
  tryRelinkBinSourceByRoleId,
  tryRestoreTokensFromSavedBins,
} = useTokenImportBinFiles({
  authStore,
  dialog,
  formatTime,
  message,
  t,
  tokenStore,
});

const {
  cancelEditRemark,
  editForm,
  editRules,
  editingRemark,
  getConnectionStatusText,
  getServerTagType,
  getTokenActions,
  getTokenStyle,
  handleTokenAction,
  refreshToken,
  refreshingTokens,
  saveCurrentRemark,
  saveEdit,
  saveRemark,
  selectToken,
  showEditModal,
  startEditRemark,
  tempRemarks,
  upgradeTokenToPermanent,
} = useTokenImportTokenActions({
  dialog,
  editFormRef,
  ensureTokenActivation,
  loadBinFiles,
  message,
  selectedTokenId,
  t,
  tokenStore,
  tryRelinkBinSourceByRoleId,
});
const editFormWsRisk = computed(() => analyzeWsUrlSafety(editForm.wsUrl));

const {
  bulkOptions,
  getSortIcon,
  handleBulkAction,
  handleDragOver,
  handleDragStart,
  handleDrop,
  sortConfig,
  sortedTokens,
  toggleSort,
} = useTokenImportListActions({
  dialog,
  loadBinFiles,
  message,
  refreshToken,
  t,
  tokenStore,
});

const handleTokenMenuAction = (key, token) => {
  handleTokenAction(key, token, {
    openImportForm: () => {
      showImportForm.value = true;
      importMethod.value = "manual";
    },
  });
};

const goToDashboard = () => {
  router.push("/admin/task-control");
};

const LEGACY_SENSITIVE_IMPORT_QUERY_WARNING =
  "URL 中携带敏感导入参数已禁用，请改用页面内输入或安全会话跳转";

const replaceWithSanitizedTokenImportRoute = async () => {
  const sanitizedQuery = getSanitizedTokenImportQuery(
    router.currentRoute.value.query,
  );
  await router.replace({
    path: router.currentRoute.value.path || "/tokens",
    query: sanitizedQuery,
    hash: router.currentRoute.value.hash,
  });
};

const showLegacySensitiveImportQueryWarning = () => {
  message.warning(
    t("tokenImport.messages.importFailedWithReason", {
      error: LEGACY_SENSITIVE_IMPORT_QUERY_WARNING,
    }),
  );
};

const formatActivationExpiry = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "未获取到到期时间";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
};

const showActivationExpiryDialog = (token) => {
  const wsStatus = tokenStore.getWebSocketStatus(token.id);
  const refreshRoleInfo =
    wsStatus === "connected"
      ? tokenStore.sendGetRoleInfo(token.id).catch(() => {
          // 读取实时角色信息失败时回退到本地缓存名称。
        })
      : Promise.resolve();

  return refreshRoleInfo.then(
    () =>
      new Promise((resolve) => {
        const latestToken =
          tokenStore.gameTokens.find((item) => item.id === token.id) || token;
        const expiryText = formatActivationExpiry(
          latestToken?.activationExpiresAt,
        );
        dialog.info({
          title: "激活到期时间",
          content: `${latestToken?.name || token.name} 到期时间：${expiryText}`,
          positiveText: "进入控制台",
          negativeText: "取消",
          onPositiveClick: () => resolve(true),
          onNegativeClick: () => resolve(false),
          onClose: () => resolve(false),
        });
      }),
  );
};

// 开始任务管理 - 直接跳转到控制台
const startTaskManagement = async (token) => {
  const activated = await ensureTokenActivation(token);
  if (!activated) return;
  const confirmed = await showActivationExpiryDialog(token);
  if (!confirmed) return;
  tokenStore.selectToken(token.id);
  message.success(
    t("tokenImport.messages.enteringConsole", { name: token.name }),
  );
  router.push("/admin/dashboard");
};

// URL参数处理函数
const handleUrlParams = async () => {
  const routeNotice = consumeTokenImportRouteNotice();
  if (routeNotice === "legacySensitiveQueryDisabled") {
    showLegacySensitiveImportQueryWarning();
  }

  const sensitiveTokenImportQuery = extractSensitiveTokenImportQuery(
    router.currentRoute.value.query,
  );
  if (sensitiveTokenImportQuery.hasSensitiveParams) {
    showLegacySensitiveImportQueryWarning();
    await replaceWithSanitizedTokenImportRoute();
    return true;
  }

  const handoffPayload = consumeTokenImportLaunchPayload();
  const launchApi = String(handoffPayload?.api || "").trim();
  const launchWsUrl = String(handoffPayload?.wsUrl || "").trim();
  const launchName = String(handoffPayload?.name || props.name || "").trim();
  const launchServer = String(
    handoffPayload?.server || props.server || "",
  ).trim();
  const shouldAutoLaunch = handoffPayload?.auto === true || props.auto === true;

  // 仅允许通过受信任 API 地址导入，避免任意外部 URL 拉取
  if (launchApi) {
    try {
      isImporting.value = true;
      let tokenResult = null;

      if (!isTrustedTokenImportUrl(launchApi)) {
        throw new Error("仅允许同源或 localhost API 地址");
      }
      message.info(t("tokenImport.messages.importingFromApi"));

      const data = await fetchTokenPayloadFromUrl(launchApi, {
        trustedOnly: true,
        useProxy: true,
      });

      // 使用API获取的token
      tokenResult = tokenStore.importBase64Token(
        launchName ||
          data.name ||
          t("tokenImport.messages.importedFromApiDefaultName"),
        data.token,
        {
          server: launchServer || data.server,
          wsUrl: launchWsUrl || null,
          sourceUrl: launchApi,
          importMethod: "url",
        },
      );

      if (tokenResult && tokenResult.success) {
        message.success(
          t("tokenImport.messages.tokenImportSuccess", {
            name: tokenResult.tokenName,
          }),
        );

        // 如果auto=true，自动选择并跳转到控制台
        if (shouldAutoLaunch && tokenResult.token) {
          const activated = await ensureTokenActivation(tokenResult.token);
          if (activated) {
            const confirmed = await showActivationExpiryDialog(
              tokenResult.token,
            );
            if (confirmed) {
              tokenStore.selectToken(tokenResult.token.id);
              message.success(t("tokenImport.messages.redirectingToConsole"));
              setTimeout(() => {
                router.push("/admin/dashboard");
              }, 200);
            }
          }
        } else {
          // 清除URL参数，避免重复处理
          await replaceWithSanitizedTokenImportRoute();
        }
      } else {
        throw new Error(
          tokenResult?.message || t("tokenImport.messages.tokenImportFailed"),
        );
      }
    } catch (error) {
      console.error("URL参数处理失败:", error);
      message.error(
        t("tokenImport.messages.importFailedWithReason", {
          error: error.message,
        }),
      );
      // 清除URL参数
      await replaceWithSanitizedTokenImportRoute();
    } finally {
      isImporting.value = false;
    }
    return true;
  }

  return false;
};

// 监听路由变化
watch(
  () => router.currentRoute.value.fullPath,
  async (nextPath, previousPath) => {
    if (nextPath === previousPath) {
      return;
    }
    if (router.currentRoute.value.path !== "/tokens") {
      return;
    }
    await handleUrlParams();
  },
  { immediate: false },
);

// 生命周期
onMounted(async () => {
  tokenStore.initTokenStore();
  await loadRemoteBinDownloadPreference();
  await loadBinFiles();
  await tryRestoreTokensFromSavedBins();

  // 处理URL参数
  const handledImportEntry = await handleUrlParams();

  // 如果没有token且没有URL参数，显示导入表单
  if (!tokenStore.hasTokens && !handledImportEntry) {
    showImportForm.value = true;
  }
});
</script>

<style scoped lang="scss">
.divider-h-24 {
  height: 24px;
}

.token-import-page :deep(.n-button),
.token-import-page :deep(.arco-btn) {
  touch-action: manipulation;
}

.token-import-page :deep(.n-button:focus-visible),
.token-import-page :deep(.arco-btn:focus-visible) {
  outline: 2px solid rgba(37, 99, 235, 0.72);
  outline-offset: 2px;
}

.remark-edit-icon {
  margin-left: 4px;
  color: var(--text-tertiary);
}

.token-list-card {
  margin-bottom: 10px;
  border: 1px solid var(--surface-glass-border);
  background:
    linear-gradient(135deg, rgba(15, 107, 255, 0.06), transparent 68%),
    var(--console-panel);
  box-shadow: var(--shadow-light);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}

.token-list-card:hover {
  border-color: rgba(37, 99, 235, 0.34);
  box-shadow: var(--shadow-medium);
  transform: translateY(-1px);
}

.token-list-card.active {
  border-color: rgba(37, 99, 235, 0.72);
  box-shadow:
    0 0 0 1px rgba(37, 99, 235, 0.24),
    var(--shadow-light);
}

.token-list-card :deep(.n-card__content) {
  padding: 12px 14px;
}

.min-w-65 {
  min-width: 65px;
}

.min-w-100 {
  min-width: 100px;
}

.token-basic-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  line-height: 1.4;
}

.token-name-text {
  color: var(--text-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.token-remark-inline-edit {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.note-icon-tight {
  margin-right: 1px;
}

.remark-input-w-150 {
  width: 150px;
}

.token-remark-inline-view {
  max-width: min(240px, 100%);
  min-height: 28px;
  padding: 3px 8px;
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-small);
  background: var(--surface-glass);
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.remark-create-icon {
  font-size: 0.8em;
  color: var(--text-tertiary);
}

.modal-w-500 {
  width: min(500px, calc(100vw - 24px));
}

.token-import-page {
  min-height: 100dvh;
  background: transparent;
  padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom));
  animation: token-fade-in 0.4s ease;
  isolation: isolate;
}

[data-theme="dark"] .token-import-page {
  background: transparent;
}

.container {
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 var(--spacing-md);
}

.token-import-page__actions {
  align-items: flex-start;
}

.token-import-mobile-actions {
  display: none;
}

.token-import-summary {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.page-header {
  text-align: center;
  margin-bottom: var(--spacing-2xl);
}

.header-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: var(--spacing-md);
}

.brand-block {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.account-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

.account-name {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.account-desc {
  font-size: var(--font-size-xs);
  color: rgba(255, 255, 255, 0.9);
}

.header-tools {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.brand-logo {
  width: 64px;
  height: 64px;
  border-radius: var(--border-radius-medium);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.header-content h1 {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  margin: 0;
  color: #ffffff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.header-content p {
  font-size: var(--font-size-lg);
  margin: 0;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.import-section {
  margin-bottom: var(--spacing-2xl);
}

.import-card {
  background: var(--bg-primary);
  border-radius: var(--border-radius-xl);
  padding: var(--spacing-2xl);
  box-shadow: var(--shadow-large);
  max-width: 600px;
  margin: 0 auto;
}

.card-header {
  text-align: center;
  margin-bottom: var(--spacing-xl);

  h2 {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    color: var(--text-primary);
    font-size: var(--font-size-xl);
    margin-bottom: var(--spacing-sm);
  }

  p {
    color: var(--text-secondary);
    margin: 0 0 var(--spacing-md) 0;
  }

  .subtitle {
    font-size: var(--font-size-md);
    color: var(--text-tertiary);
    margin: 0;
    font-weight: var(--font-weight-normal);
  }

  .import-method-tabs {
    margin-top: var(--spacing-md);
    display: flex;
    justify-content: center;
  }
}

.form-tips {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.form-tip {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}

.cors-tip {
  color: var(--warning-color);
  font-weight: var(--font-weight-medium);
}

.connection-actions {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
}

/* 深色主题强制覆盖（与全局 data-theme 保持一致） */
[data-theme="dark"] .n-form-item-label,
[data-theme="dark"] .n-form-item-label__text {
  color: #ffffff !important;
}

[data-theme="dark"] .n-input__input,
[data-theme="dark"] .n-input__textarea {
  color: #ffffff !important;
  background-color: rgba(255, 255, 255, 0.1) !important;
}

[data-theme="dark"] .n-input__placeholder {
  color: rgba(255, 255, 255, 0.5) !important;
}

[data-theme="dark"] .n-card {
  background-color: rgba(255, 255, 255, 0.1) !important;
  color: #ffffff !important;
}

[data-theme="dark"] .import-card {
  background: rgba(45, 55, 72, 0.9) !important;
  color: #ffffff !important;
}

[data-theme="dark"] .import-card h2 {
  color: #ffffff !important;
}

[data-theme="dark"] .import-card .subtitle {
  color: rgba(255, 255, 255, 0.7) !important;
}

[data-theme="dark"] .n-collapse-item__header {
  color: #ffffff !important;
}

[data-theme="dark"] .n-collapse-item__content-wrapper {
  background-color: transparent !important;
}

[data-theme="dark"] .n-radio-button {
  color: #ffffff !important;
}

[data-theme="dark"] .n-radio-button--checked {
  background-color: rgba(16, 185, 129, 0.8) !important;
  color: #ffffff !important;
}

[data-theme="dark"] .form-tip {
  color: rgba(255, 255, 255, 0.6) !important;
}

.optional-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.form-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-top: var(--spacing-xl);
}

.bin-files-section {
  margin-bottom: var(--spacing-lg);
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-large);
  box-shadow: var(--shadow-light);
  background:
    linear-gradient(135deg, rgba(15, 107, 255, 0.08), transparent 76%),
    var(--surface-glass-strong);
  backdrop-filter: blur(14px);
}

.bin-files-section :deep(.n-card-header) {
  padding: 18px 20px 12px;
}

.bin-files-section :deep(.n-card__content) {
  padding: 0 20px 20px;
}

.bin-files-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);

  h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: var(--font-size-lg);
  }

  p {
    margin: var(--spacing-xs) 0 0;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }
}

.bin-files-refresh-button {
  flex-shrink: 0;
  min-width: 104px;
}

.bin-files-mobile-list {
  display: grid;
  gap: 12px;
}

.bin-file-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: var(--border-radius-medium);
  border: 1px solid var(--surface-glass-border);
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.09), transparent 76%),
    var(--console-panel);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.bin-file-card__head {
  display: grid;
  gap: 4px;
}

.bin-file-card__head strong {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.45;
  word-break: break-word;
}

.bin-file-card__head span {
  width: fit-content;
  max-width: 100%;
  padding: 3px 8px;
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-small);
  background: var(--surface-glass);
  color: var(--text-secondary);
  font-size: 12px;
  font-family: var(--font-family-mono);
  word-break: break-all;
}

.bin-file-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.bin-file-card__meta > div {
  padding: 10px;
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-small);
  background: var(--surface-glass);
}

.bin-file-card__meta span {
  display: block;
  color: var(--text-tertiary);
  font-size: 11px;
  letter-spacing: 0;
}

.bin-file-card__meta strong {
  display: block;
  margin-top: 4px;
  color: var(--text-primary);
  font-size: 13px;
  word-break: break-word;
}

.bin-file-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.bin-file-card__actions :deep(.n-button) {
  min-height: 44px;
}

.tokens-section {
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.09), transparent 72%),
    var(--surface-glass-strong);
  border-radius: var(--border-radius-large);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-light);
  border: 1px solid var(--surface-glass-border);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* 深色主题下的列表区域背景 */
[data-theme="dark"] .tokens-section {
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.1), transparent 70%),
    var(--surface-glass-strong);
  color: var(--text-primary);
}

/* 深色主题下的固定头部 */
[data-theme="dark"] .section-header {
  background: transparent;
  border-bottom-color: var(--console-divider);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--border-light);

  h2 {
    color: var(--text-primary);
    font-size: var(--font-size-xl);
    margin: 0;
  }
}

.section-header__primary {
  min-width: 0;
}

.token-sort-controls {
  flex-wrap: wrap;
}

.token-sort-controls :deep(.n-button) {
  min-height: 36px;
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
  max-width: 100%;
  flex-wrap: wrap;
}

.header-actions :deep(.n-button) {
  min-height: 40px;
}

.tokens-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.token-card {
  overflow: hidden;
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-large);
  background:
    radial-gradient(circle at 100% 0%, rgba(34, 197, 94, 0.14), transparent 34%),
    linear-gradient(135deg, rgba(37, 99, 235, 0.08), transparent 70%),
    var(--console-panel-strong);
  padding: 0;
  cursor: pointer;
  box-shadow: var(--shadow-light);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);

  &:hover {
    box-shadow: var(--shadow-medium);
    transform: translateY(-1px);
  }

  &.active {
    border-color: rgba(37, 99, 235, 0.78);
    box-shadow:
      0 0 0 1px rgba(37, 99, 235, 0.28),
      var(--shadow-light);
  }

  &.connected {
    border-left: 4px solid var(--success-color);
  }
}

.token-card::before {
  content: "";
  display: block;
  height: 3px;
  background: linear-gradient(90deg, #22c55e, #2563eb 56%, transparent);
  opacity: 0.86;
}

.token-card :deep(.arco-card-header) {
  align-items: flex-start;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--console-divider);
}

.token-card :deep(.arco-card-header-title) {
  min-width: 0;
  overflow: visible;
  white-space: normal;
}

.token-card :deep(.arco-card-body) {
  padding: 14px;
}

.token-card :deep(.arco-card-actions) {
  padding: 0 14px 14px;
  border-top: 0;
}

.token-card :deep(.arco-card-extra) {
  align-self: flex-start;
}

.token-card :deep(.arco-card-extra .n-button) {
  min-width: 44px;
  min-height: 44px;
  border-radius: var(--border-radius-small);
  background: var(--surface-glass);
}

.token-card-title {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.token-card-title__main,
.token-card-title__meta {
  display: flex;
  align-items: center;
  min-width: 0;
}

.token-card-title__main {
  align-items: flex-start;
  gap: 10px;
}

.token-card-title__meta {
  flex-wrap: wrap;
  gap: 6px;
}

.token-card-title__identity {
  display: grid;
  min-width: 0;
}

.token-card-title__name {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--font-size-md);
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tokens-list {
  overflow-y: auto;
  padding-right: var(--spacing-sm);
  scrollbar-width: thin;
  scrollbar-color: var(--border-medium) var(--bg-tertiary);
  flex: 1;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: var(--bg-tertiary);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--border-medium);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--border-dark);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-md);
}

.token-info {
  flex: 1;
}

.token-name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--spacing-xs) 0;
}

.token-meta {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.meta-item {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius-small);
}

.card-body {
  margin-bottom: var(--spacing-md);
}

.token-card-overview {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(0, 0.82fr);
  gap: 8px;
  margin-bottom: 10px;
}

.token-card-overview__item {
  display: grid;
  gap: 5px;
  min-height: 58px;
  padding: 10px 12px;
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-medium);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent),
    var(--surface-glass);
}

.token-card-overview__item span {
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1;
}

.token-card-overview__item strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: var(--font-weight-bold);
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-card-overview__item--server {
  border-color: rgba(34, 197, 94, 0.42);
  background:
    linear-gradient(135deg, rgba(34, 197, 94, 0.18), rgba(37, 99, 235, 0.07)),
    var(--surface-glass);
}

.token-card-overview__item--server strong {
  color: #63e68b;
  font-family: var(--font-family-mono);
  font-size: 18px;
  letter-spacing: 0;
}

.token-display {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 44px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-medium);
  background: var(--surface-glass);
}

.token-label {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: var(--font-weight-medium);
}

.token-value {
  font-family: var(--font-family-mono);
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-primary);
  flex: 1;
  overflow-wrap: anywhere;
}

.connection-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary);

  &.connected {
    background: var(--success-color);
  }

  &.connecting {
    background: var(--warning-color);
  }

  &.error {
    background: var(--error-color);
  }
}

.status-text {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.token-remark {
  min-height: 44px;
  margin: 0 0 10px;
  padding: 10px 12px;
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-medium);
  background: var(--surface-glass);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast);
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    border-color: rgba(37, 99, 235, 0.34);
    background: var(--console-panel);
  }
}

.token-remark-edit {
  cursor: default;
  background: var(--console-panel);
  border: 1px solid var(--border-medium);

  &:hover {
    background: var(--console-panel);
  }
}

.remark-label {
  font-weight: var(--font-weight-medium);
  margin-right: var(--spacing-xs);
  color: var(--text-primary);
  flex-shrink: 0;
}

.remark-value {
  flex: 1;
  min-width: 0;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.token-timestamps {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.timestamp-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-small);
  background: var(--surface-glass);
}

.timestamp-label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.timestamp-value {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.card-footer {
  border-top: 1px solid var(--border-light);
  padding-top: var(--spacing-md);
}

/* 连接状态指示器样式 */
.connection-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: var(--spacing-xs);
  position: relative;

  &.connected {
    background-color: #10b981;
    /* 绿色 - 已连接 */
    animation: pulse-green 2s infinite;
  }

  &.connecting {
    background-color: #f59e0b;
    /* 黄色 - 连接中 */
    animation: pulse-yellow 1s infinite;
  }

  &.disconnected {
    background-color: #6b7280;
    /* 灰色 - 已断开 */
  }

  &.error {
    background-color: #ef4444;
    /* 红色 - 连接错误 */
    animation: pulse-red 1s infinite;
  }
}

.connection-status {
  font-size: var(--font-size-xs);
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;

  &.connected {
    color: #10b981;
    background-color: rgba(16, 185, 129, 0.1);
  }

  &.connecting {
    color: #f59e0b;
    background-color: rgba(245, 158, 11, 0.1);
  }

  &.disconnected {
    color: #6b7280;
    background-color: rgba(107, 114, 128, 0.1);
  }

  &.error {
    color: #ef4444;
    background-color: rgba(239, 68, 68, 0.1);
  }
}

@keyframes pulse-green {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

@keyframes pulse-yellow {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}

@keyframes pulse-red {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.6;
  }
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  background: var(--bg-primary);
  border-radius: var(--border-radius-xl);
  box-shadow: var(--shadow-medium);
}

.modal-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
}

@keyframes token-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .token-import-page :deep(.n-button) {
    min-height: 44px;
  }

  .token-import-page :deep(.n-button.n-button--small-type) {
    min-height: 44px;
    padding-left: 12px;
    padding-right: 12px;
  }

  .token-import-page :deep(.n-button.n-button--medium-type) {
    min-height: 44px;
  }

  .token-import-page__container {
    display: grid;
    gap: 12px;
  }

  .token-import-hero {
    margin-bottom: 0;
  }

  .token-import-hero .token-import-page__actions {
    display: none;
  }

  .token-import-mobile-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .token-import-mobile-actions :deep(.n-button) {
    width: 100%;
  }

  .token-import-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .token-import-summary__card {
    min-height: 0;
    padding: 12px;
  }

  .token-import-summary__card .app-summary-card__label {
    font-size: 11px;
  }

  .token-import-summary__card .app-summary-card__value {
    font-size: 18px;
    line-height: 1.15;
  }

  .token-import-summary__card .app-summary-card__meta {
    line-height: 1.35;
  }

  .header-top {
    flex-direction: column;
    align-items: flex-start;
  }

  .bin-files-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .bin-files-refresh-button {
    width: 100%;
  }

  .bin-files-section,
  .tokens-section {
    margin-bottom: 0;
  }

  .bin-files-section :deep(.n-card-header),
  .bin-files-section :deep(.n-card__content),
  .tokens-section {
    padding: 14px;
  }

  .bin-files-mobile-list {
    gap: 10px;
  }

  .bin-file-card {
    gap: 10px;
    padding: 12px;
    border-radius: var(--border-radius-medium);
  }

  .bin-file-card__head {
    gap: 2px;
  }

  .bin-file-card__head strong {
    font-size: 13px;
  }

  .bin-file-card__meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .bin-file-card__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .bin-file-card__actions :deep(.n-button) {
    width: 100%;
  }

  .token-import-page__actions,
  .header-actions {
    width: 100%;
    align-items: stretch;
  }

  .header-tools {
    width: 100%;
    justify-content: space-between;
  }

  .container {
    padding: 0 var(--spacing-md);
  }

  .tokens-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .optional-fields {
    grid-template-columns: 1fr;
  }

  .section-header {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
    margin-bottom: 0;
    padding-bottom: 10px;
  }

  .section-header h2 {
    font-size: 16px;
    line-height: 1.35;
  }

  .divider-h-24 {
    display: none;
  }

  .section-header__primary {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px !important;
  }

  .section-header :deep(.n-space) {
    width: 100%;
    align-items: stretch !important;
    justify-content: flex-start;
  }

  .token-sort-controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
  }

  .token-sort-controls :deep(.n-button) {
    width: 100%;
    border-radius: 10px !important;
    white-space: normal;
  }

  .header-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .token-card {
    padding: 0;
    border-radius: 18px;
  }

  .token-card :deep(.arco-card-header) {
    align-items: flex-start;
    padding: 12px 12px 10px;
  }

  .token-card :deep(.arco-card-body) {
    padding: 12px;
  }

  .token-card :deep(.arco-card-actions) {
    padding: 0 12px 12px;
  }

  .token-card-title {
    gap: 6px;
  }

  .token-card-title__meta {
    gap: 5px;
  }

  .token-card-overview__item {
    min-height: 50px;
    padding: 9px 10px;
  }

  .token-display {
    margin-bottom: 8px;
    padding: 10px;
  }

  .token-timestamps {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .storage-info {
    margin-top: 8px;
    padding-top: 8px;
  }

  .storage-item {
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
  }

  .storage-label {
    min-width: 0;
  }
}

/* 存储信息样式 */
.storage-info {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-light);
}

.storage-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 36px;
  margin-bottom: 0;
  padding: 8px 10px;
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-small);
  background: var(--surface-glass);
}

.storage-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
  min-width: 0;
}

.storage-upgrade {
  margin-top: 0;
}

.storage-upgrade :deep(.n-button) {
  min-height: 36px;
}

:global([data-theme="dark"] .token-import-modal .arco-modal) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
}

[data-theme="dark"] .token-card {
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.14), transparent 68%),
    var(--console-panel-strong);
  border-color: var(--surface-glass-border);
  color: var(--text-primary);
}
</style>
