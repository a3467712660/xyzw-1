<template>
  <div class="records-container">
    <!-- 头部信息区 -->
    <div class="header-section">
      <div class="header-left">
        <img alt="俱乐部图标" class="header-icon" src="/icons/moonPalace.png">
        <div class="header-title">
          <h2>俱乐部盐场战绩</h2>
          <p>查看俱乐部成员的详细战绩数据</p>
        </div>
      </div>

      <!-- 数据统计区 -->
      <div
        v-if="battleRecords && battleRecords.roleDetailsList"
        class="stats-section"
      >
        <div class="stat-item">
          <span class="stat-label">查询日期:</span>
          <ClubBattleResultBadge tone="info" :text="queryDate"></ClubBattleResultBadge>
        </div>
        <div class="stat-item">
          <span class="stat-label">总人数:</span>
          <ClubBattleResultBadge
            tone="success"
            :text="String(battleRecords.roleDetailsList.length)"
          ></ClubBattleResultBadge>
        </div>
      </div>
    </div>

    <!-- 功能操作区 -->
    <ClubBattleRecordToolbar
      :can-export="Boolean(battleRecords)"
      :current-style="currentStyle"
      :disabled-date="disabledDate"
      :export-methods="exportmethod"
      :loading="loading"
      :query-date="queryDate"
      :show-export-methods="true"
      :style-options="styleOptions"
      @change-date="fetchBattleRecordsByDate"
      @export="handleExport"
      @refresh="handleRefresh"
      @update:current-style="currentStyle = $event"
      @update:export-methods="exportmethod = $event"
      @update:query-date="queryDate = $event"
    ></ClubBattleRecordToolbar>

    <div class="battle-records-content">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <n-spin size="large">
          <template #description>正在加载战绩数据...</template>
        </n-spin>
      </div>

      <!-- 战绩列表 -->
      <div
        v-else-if="battleRecords && battleRecords.roleDetailsList"
        class="records-wrapper"
      >
        <!-- 样式一 -->
        <div
          ref="exportDom"
          v-if="currentStyle === 'style1'"
          class="records-list style-1"
        >
          <!-- 头部信息 -->
          <div class="style1-header">
            <h2>{{ queryDate }} {{ club?.name || "俱乐部" }}盐场周报</h2>
          </div>

          <div class="style1-content">
            <!-- 左侧表格 -->
            <div class="style1-table-container">
              <table class="style1-table">
                <thead>
                  <tr>
                    <th class="col-rank">排名</th>
                    <th class="col-name">成员</th>
                    <th class="col-kill">击杀</th>
                    <th class="col-death">死亡</th>
                    <th class="col-occupy">攻城</th>
                    <th class="col-revive">复活丹</th>
                    <th class="col-kd">K/D</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(player, index) in battleRecords.roleDetailsList"
                    :key="player.roleId"
                  >
                    <td class="col-rank">
                      <div v-if="index < 3" class="rank-medal">
                        {{ index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉" }}
                      </div>
                      <span v-else>{{ index + 1 }}</span>
                    </td>
                    <td class="col-name">
                      <div class="player-info">
                        <img
                          v-if="player.headImg"
                          class="player-avatar-small"
                          :src="player.headImg"
                          @error="handleImageError"
                        >
                        <div v-else class="player-avatar-placeholder-small">
                          {{ player.name?.charAt(0) || "?" }}
                        </div>
                        <span>{{ player.name }}</span>
                      </div>
                    </td>
                    <td
                      class="col-kill stat-bg-cell"
                      :style="{ '--cell-bg': getKillColor(player.winCnt) }"
                    >
                      {{ player.winCnt || 0 }}
                    </td>
                    <td
                      class="col-death stat-bg-cell"
                      :style="{ '--cell-bg': getDeathColor(player.loseCnt) }"
                    >
                      {{ player.loseCnt || 0 }}
                    </td>
                    <td
                      class="col-occupy stat-bg-cell"
                      :style="{
                        '--cell-bg': getOccupyColor(player.buildingCnt),
                      }"
                    >
                      {{ player.buildingCnt || 0 }}
                    </td>
                    <td
                      class="col-revive stat-bg-cell"
                      :style="{
                        '--cell-bg': getReviveColor(
                          Math.max((player.loseCnt || 0) - 6, 0),
                        ),
                      }"
                    >
                      {{ Math.max((player.loseCnt || 0) - 6, 0) }}
                    </td>
                    <td class="col-kd">
                      {{
                        parseFloat(
                          player.winCnt && player.loseCnt
                            ? player.winCnt / player.loseCnt
                            : 0.0,
                        ).toFixed(2)
                      }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 右侧统计 -->
            <div class="style1-summary">
              <ClubBattleSummaryPanel
                :rank-panels="style1SummaryPanels"
                :stats="style1SummaryStats"
                @image-error="handleImageError"
              ></ClubBattleSummaryPanel>
            </div>
          </div>
        </div>

        <!-- 样式二 -->
        <div
          ref="exportDom"
          v-else-if="currentStyle === 'style2'"
          class="records-list style-2"
        >
          <div class="style2-header">
            <div class="style2-title">
              <span class="trophy-icon">🏆</span>
              <div class="title-text">
                <h2>{{ club?.name || "俱乐部" }} 盐场周报</h2>
                <div class="date-text">{{ queryDate }}</div>
              </div>
            </div>
          </div>

          <!-- 战绩总览 -->
          <div class="style2-dashboard">
            <div class="dashboard-stats">
              <div class="stat-card-row">
                <div class="stat-card-mini">
                  <div class="stat-label-mini">总 K/D</div>
                  <div class="stat-value-mini">{{ totalKD }}</div>
                </div>
                <div class="stat-card-mini">
                  <div class="stat-label-mini">总胜率</div>
                  <div class="stat-value-mini">{{ totalWinRate }}%</div>
                </div>
                <div class="stat-card-mini">
                  <div class="stat-label-mini">参战人数</div>
                  <div class="stat-value-mini">
                    {{ battleRecords.roleDetailsList.length }}
                  </div>
                </div>
                <div class="stat-card-mini">
                  <div class="stat-label-mini">总复活丹</div>
                  <div class="stat-value-mini warning-text">
                    {{ totalRevives }}
                  </div>
                </div>
              </div>
              <div class="stat-card-row">
                <div class="stat-card-mini">
                  <div class="stat-label-mini">总击杀</div>
                  <div class="stat-value-mini danger-text">
                    {{ totalKills }}
                  </div>
                </div>
                <div class="stat-card-mini">
                  <div class="stat-label-mini">总死亡</div>
                  <div class="stat-value-mini">{{ totalDeaths }}</div>
                </div>
                <div class="stat-card-mini">
                  <div class="stat-label-mini">总攻城</div>
                  <div class="stat-value-mini warning-text">
                    {{ totalBuilding }}
                  </div>
                </div>
                <div class="stat-card-mini">
                  <div class="stat-label-mini">人均击杀</div>
                  <div class="stat-value-mini purple-text">{{ avgKills }}</div>
                </div>
              </div>
            </div>

            <div v-if="mvpPlayer" class="dashboard-mvp">
              <img
                v-if="mvpPlayer.headImg"
                class="mvp-avatar"
                :src="mvpPlayer.headImg"
                @error="handleImageError"
              >
              <div v-else class="mvp-avatar-placeholder">
                {{ mvpPlayer.name?.charAt(0) || "?" }}
              </div>
              <div class="mvp-crown">👑</div>
              <div class="mvp-name">{{ mvpPlayer.name }}</div>
              <div class="mvp-label">本周 MVP</div>
            </div>
          </div>

          <!-- 前三展示 -->
          <div class="style2-rankings-grid">
            <div class="rank-card-s2 red-border">
              <div class="rank-card-title-s2">
                <span class="icon">⚔️</span> 击杀前三
              </div>
              <div class="rank-list-s2">
                <div
                  v-for="(player, index) in killRank"
                  :key="`s2-kill-${index}`"
                  class="rank-item-s2"
                >
                  <div class="rank-num-s2">{{ index + 1 }}</div>
                  <div class="rank-player-s2">
                    <img
                      v-if="player.headImg"
                      class="avatar-xxs"
                      :src="player.headImg"
                    >
                    <span class="name">{{ player.name }}</span>
                  </div>
                  <div class="rank-val-s2 red">{{ player.winCnt }}</div>
                </div>
              </div>
            </div>

            <div class="rank-card-s2 orange-border">
              <div class="rank-card-title-s2">
                <span class="icon">💣</span> 攻城前三
              </div>
              <div class="rank-list-s2">
                <div
                  v-for="(player, index) in occupyRank"
                  :key="`s2-occupy-${index}`"
                  class="rank-item-s2"
                >
                  <div class="rank-num-s2">{{ index + 1 }}</div>
                  <div class="rank-player-s2">
                    <img
                      v-if="player.headImg"
                      class="avatar-xxs"
                      :src="player.headImg"
                    >
                    <span class="name">{{ player.name }}</span>
                  </div>
                  <div class="rank-val-s2 orange">{{ player.buildingCnt }}</div>
                </div>
              </div>
            </div>

            <div class="rank-card-s2 green-border">
              <div class="rank-card-title-s2">
                <span class="icon">📊</span> KD 前三
              </div>
              <div class="rank-list-s2">
                <div
                  v-for="(player, index) in kdRank"
                  :key="`s2-kd-${index}`"
                  class="rank-item-s2"
                >
                  <div class="rank-num-s2">{{ index + 1 }}</div>
                  <div class="rank-player-s2">
                    <img
                      v-if="player.headImg"
                      class="avatar-xxs"
                      :src="player.headImg"
                    >
                    <span class="name">{{ player.name }}</span>
                  </div>
                  <div class="rank-val-s2 green">{{ player.kd }}</div>
                </div>
              </div>
            </div>

            <div class="rank-card-s2 gray-border">
              <div class="rank-card-title-s2">
                <span class="icon">💀</span> 死亡前三
              </div>
              <div class="rank-list-s2">
                <div
                  v-for="(player, index) in deathRank"
                  :key="`s2-death-${index}`"
                  class="rank-item-s2"
                >
                  <div class="rank-num-s2">{{ index + 1 }}</div>
                  <div class="rank-player-s2">
                    <img
                      v-if="player.headImg"
                      class="avatar-xxs"
                      :src="player.headImg"
                    >
                    <span class="name">{{ player.name }}</span>
                  </div>
                  <div class="rank-val-s2 gray">{{ player.loseCnt }}</div>
                </div>
              </div>
            </div>

            <div class="rank-card-s2 purple-border">
              <div class="rank-card-title-s2">
                <span class="icon">💊</span> 复活丹前三
              </div>
              <div class="rank-list-s2">
                <div
                  v-for="(player, index) in reviveRank"
                  :key="`s2-revive-${index}`"
                  class="rank-item-s2"
                >
                  <div class="rank-num-s2">{{ index + 1 }}</div>
                  <div class="rank-player-s2">
                    <img
                      v-if="player.headImg"
                      class="avatar-xxs"
                      :src="player.headImg"
                    >
                    <span class="name">{{ player.name }}</span>
                  </div>
                  <div class="rank-val-s2 purple">{{ player.reviveCnt }}</div>
                </div>
              </div>
            </div>

            <!-- 占位，保持排版一致，或者放其他榜单 -->
            <div class="rank-card-s2 blue-border">
              <div class="rank-card-title-s2">
                <span class="icon">🛡️</span> 生存前三
              </div>
              <div class="rank-list-s2">
                <div
                  v-for="(player, index) in survivalRank"
                  :key="`s2-survival-${index}`"
                  class="rank-item-s2"
                >
                  <div class="rank-num-s2">{{ index + 1 }}</div>
                  <div class="rank-player-s2">
                    <img
                      v-if="player.headImg"
                      class="avatar-xxs"
                      :src="player.headImg"
                    >
                    <span class="name">{{ player.name }}</span>
                  </div>
                  <div class="rank-val-s2 blue">{{ player.survivalCnt }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 详细列表 -->
          <div class="style2-table-wrapper">
            <table class="style2-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>成员</th>
                  <th>击杀</th>
                  <th>死亡</th>
                  <th>攻城</th>
                  <th>复活丹</th>
                  <th>K/D</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(player, index) in battleRecords.roleDetailsList"
                  :key="`s2-row-${player.roleId}`"
                >
                  <td>
                    <div v-if="index < 3" class="medal-icon">
                      {{ index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉" }}
                    </div>
                    <div v-else class="rank-num-plain">{{ index + 1 }}</div>
                  </td>
                  <td>
                    <div class="player-cell">
                      <img
                        v-if="player.headImg"
                        class="avatar-xs"
                        :src="player.headImg"
                      >
                      <div v-else class="avatar-placeholder-xs">
                        {{ player.name?.charAt(0) || "?" }}
                      </div>
                      <span class="player-name-s2">{{ player.name }}</span>
                    </div>
                  </td>
                  <td>
                    <div class="bar-cell">
                      <div class="bar-val red">{{ player.winCnt }}</div>
                      <div class="progress-bg">
                        <div
                          class="progress-fill red"
                          :style="{
                            '--fill-width': `${getPercent(player.winCnt, maxKills)}%`,
                          }"
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="bar-cell">
                      <div class="bar-val gray">{{ player.loseCnt }}</div>
                      <div class="progress-bg">
                        <div
                          class="progress-fill gray"
                          :style="{
                            '--fill-width': `${getPercent(player.loseCnt, maxDeaths)}%`,
                          }"
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="bar-cell">
                      <div class="bar-val orange">{{ player.buildingCnt }}</div>
                      <div class="progress-bg">
                        <div
                          class="progress-fill orange"
                          :style="{
                            '--fill-width': `${getPercent(player.buildingCnt, maxOccupies)}%`,
                          }"
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td>{{ Math.max((player.loseCnt || 0) - 6, 0) }}</td>
                  <td class="kd-val">
                    {{
                      parseFloat(
                        player.winCnt && player.loseCnt
                          ? player.winCnt / player.loseCnt
                          : 0.0,
                      ).toFixed(2)
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 样式三 -->
        <div
          ref="exportDom"
          v-else-if="currentStyle === 'style3'"
          class="records-list style-3"
        >
          <div class="style3-hero">
            <div class="style3-hero__copy">
              <span class="style3-kicker">本周战报</span>
              <h2>{{ queryDate }} {{ club?.name || "俱乐部" }} 军团战报</h2>
            </div>

            <div v-if="mvpPlayer" class="style3-mvp">
              <div class="style3-mvp__medal">MVP</div>
              <div class="style3-mvp__player">
                <img
                  v-if="mvpPlayer.headImg"
                  class="style3-mvp__avatar"
                  :src="mvpPlayer.headImg"
                  @error="handleImageError"
                >
                <div v-else class="style3-mvp__avatar-placeholder">
                  {{ mvpPlayer.name?.charAt(0) || "?" }}
                </div>
                <div class="style3-mvp__meta">
                  <strong>{{ mvpPlayer.name }}</strong>
                  <span>击杀 {{ mvpPlayer.winCnt || 0 }} · 攻城 {{ mvpPlayer.buildingCnt || 0 }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="style3-stats-grid">
            <article
              v-for="metric in style3Metrics"
              :key="metric.label"
              class="style3-stat-card"
              :class="`is-${metric.tone}`"
            >
              <span class="style3-stat-card__label">{{ metric.label }}</span>
              <strong class="style3-stat-card__value">{{ metric.value }}</strong>
              <span class="style3-stat-card__meta">{{ metric.meta }}</span>
            </article>
          </div>

          <div class="style3-podium">
            <article
              v-for="(player, index) in killRank"
              :key="`style3-podium-${player.roleId}`"
              class="style3-podium-card"
              :class="`is-rank-${index + 1}`"
            >
              <div class="style3-podium-card__rank">
                {{ index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉" }}
              </div>
              <div class="style3-podium-card__player">
                <img
                  v-if="player.headImg"
                  class="style3-podium-card__avatar"
                  :src="player.headImg"
                  @error="handleImageError"
                >
                <div v-else class="style3-podium-card__avatar-placeholder">
                  {{ player.name?.charAt(0) || "?" }}
                </div>
                <div class="style3-podium-card__copy">
                  <strong>{{ player.name }}</strong>
                  <span>K/D {{ player.kd }}</span>
                </div>
              </div>
              <div class="style3-podium-card__metrics">
                <span>击杀 {{ player.winCnt || 0 }}</span>
                <span>攻城 {{ player.buildingCnt || 0 }}</span>
                <span>复活丹 {{ player.reviveCnt || 0 }}</span>
              </div>
            </article>
          </div>

          <div class="style3-roster-grid">
            <article
              v-for="player in playerRows"
              :key="`style3-row-${player.roleId}`"
              class="style3-player-card"
              :class="{ 'is-top3': player.rank <= 3 }"
            >
              <div class="style3-player-card__head">
                <div class="style3-player-card__identity">
                  <span class="style3-player-card__rank">#{{ player.rank }}</span>
                  <img
                    v-if="player.headImg"
                    class="style3-player-card__avatar"
                    :src="player.headImg"
                    @error="handleImageError"
                  >
                  <div v-else class="style3-player-card__avatar-placeholder">
                    {{ player.name?.charAt(0) || "?" }}
                  </div>
                  <div class="style3-player-card__copy">
                    <strong>{{ player.name }}</strong>
                    <span>复活丹 {{ player.reviveCnt }}</span>
                  </div>
                </div>
                <span class="style3-player-card__kd">K/D {{ player.kd }}</span>
              </div>

              <div class="style3-player-card__grid">
                <div class="style3-mini-metric">
                  <span>击杀</span>
                  <strong>{{ player.winCnt || 0 }}</strong>
                </div>
                <div class="style3-mini-metric">
                  <span>死亡</span>
                  <strong>{{ player.loseCnt || 0 }}</strong>
                </div>
                <div class="style3-mini-metric">
                  <span>攻城</span>
                  <strong>{{ player.buildingCnt || 0 }}</strong>
                </div>
                <div class="style3-mini-metric">
                  <span>生存</span>
                  <strong>{{ player.survivalCnt }}</strong>
                </div>
              </div>
            </article>
          </div>
        </div>

        <!-- 样式四 -->
        <div
          ref="exportDom"
          v-else
          class="records-list style-4"
        >
          <div class="style4-shell">
            <div class="style4-header">
              <div class="style4-header__copy">
                <span class="style4-header__eyebrow">战术视图</span>
                <h2>{{ club?.name || "俱乐部" }} 盐场战术面板</h2>
              </div>
              <div class="style4-header__status">
                <span>总 K/D</span>
                <strong>{{ totalKD }}</strong>
              </div>
            </div>

            <div class="style4-overview">
              <article
                v-for="metric in style4Metrics"
                :key="metric.label"
                class="style4-overview__card"
              >
                <span>{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
                <small>{{ metric.meta }}</small>
              </article>
            </div>

            <div class="style4-content">
              <div class="style4-rank-panels">
                <section
                  v-for="panel in style4RankPanels"
                  :key="panel.key"
                  class="style4-rank-panel"
                >
                  <header class="style4-rank-panel__head">
                    <span>{{ panel.icon }}</span>
                    <strong>{{ panel.title }}</strong>
                  </header>
                  <div class="style4-rank-panel__list">
                    <div
                      v-for="(player, index) in panel.players"
                      :key="`${panel.key}-${player.roleId}`"
                      class="style4-rank-panel__item"
                    >
                      <span class="style4-rank-panel__index">0{{ index + 1 }}</span>
                      <span class="style4-rank-panel__name">{{ player.name }}</span>
                      <span class="style4-rank-panel__value">{{ panel.getValue(player) }}</span>
                    </div>
                  </div>
                </section>
              </div>

              <div class="style4-table-panel">
                <table class="style4-table">
                  <thead>
                    <tr>
                      <th>排名</th>
                      <th>成员</th>
                      <th>击杀</th>
                      <th>死亡</th>
                      <th>攻城</th>
                      <th>复活丹</th>
                      <th>K/D</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="player in playerRows"
                      :key="`style4-row-${player.roleId}`"
                    >
                      <td>{{ player.rank }}</td>
                      <td class="style4-table__name-cell">
                        <div class="style4-table__player">
                          <img
                            v-if="player.headImg"
                            class="style4-table__avatar"
                            :src="player.headImg"
                            @error="handleImageError"
                          >
                          <div v-else class="style4-table__avatar-placeholder">
                            {{ player.name?.charAt(0) || "?" }}
                          </div>
                          <span>{{ player.name }}</span>
                        </div>
                      </td>
                      <td>{{ player.winCnt || 0 }}</td>
                      <td>{{ player.loseCnt || 0 }}</td>
                      <td>{{ player.buildingCnt || 0 }}</td>
                      <td>{{ player.reviveCnt }}</td>
                      <td>{{ player.kd }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <n-empty description="暂无战绩数据" size="large">
          <template #icon>
            <n-icon>
              <DocumentText></DocumentText>
            </n-icon>
          </template>
        </n-empty>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useMessage } from "naive-ui/es";
import ClubBattleRecordToolbar from "@/components/Club/records/ClubBattleRecordToolbar.vue";
import ClubBattleResultBadge from "@/components/Club/records/ClubBattleResultBadge.vue";
import ClubBattleSummaryPanel from "@/components/Club/records/ClubBattleSummaryPanel.vue";
import {
  formatClubBattleKD,
  getClubBattleDeathColor,
  getClubBattleKillColor,
  getClubBattleOccupyColor,
  getClubBattleReviveColor,
} from "@/components/Club/records/clubBattleRecordFormatters.js";
import { useTokenStore } from "@/stores/tokenStore";
import { captureWithHtml2canvas } from "@/utils/html2canvasLoader";
import { downloadCanvasAsImage } from "@/utils/imageExport";
import {
  getStringPreference,
  setStringPreference,
} from "@/services/preferences/localPreferences";
import { DocumentText } from "@vicons/ionicons5";
import {
  copyToClipboard,
  formatBattleRecordsForExport,
  getLastSaturday,
} from "@/utils/clubBattleUtils";

const currentStyle = ref(
  getStringPreference("club_battle_records_style", "style1"),
);

const styleOptions = [
  { label: "经典榜单", value: "style1" },
  { label: "仪表看板", value: "style2" },
  { label: "海报卡片", value: "style3" },
  { label: "战术面板", value: "style4" },
];

watch(currentStyle, (newStyle) => {
  setStringPreference("club_battle_records_style", newStyle);
});

const exportmethod = ref(["2"]);
const exportDom = ref(null);

const message = useMessage();
const tokenStore = useTokenStore();
const info = computed(() => tokenStore.gameData?.legionInfo || null);
const club = computed(() => info.value?.info || null);

const loading = ref(false);
const battleRecords = ref(null);
const queryDate = ref(getLastSaturday());

const playerRows = computed(() => {
  if (!battleRecords.value?.roleDetailsList) return [];
  return battleRecords.value.roleDetailsList.map((member, index) => ({
    ...member,
    kd: formatClubBattleKD(member.winCnt, member.loseCnt),
    rank: index + 1,
    reviveCnt: Math.max((member.loseCnt || 0) - 6, 0),
    survivalCnt: member.loseCnt || 0,
  }));
});

// 计算属性：总击杀
const totalKills = computed(() => {
  if (!battleRecords.value?.roleDetailsList) return 0;
  return battleRecords.value.roleDetailsList.reduce(
    (sum, member) => sum + (member.winCnt || 0),
    0,
  );
});

// 计算属性：总复活
const totalRevives = computed(() => {
  if (!battleRecords.value?.roleDetailsList) return 0;
  return battleRecords.value.roleDetailsList.reduce(
    (sum, member) => sum + Math.max((member.loseCnt || 0) - 6, 0),
    0,
  );
});

// 计算属性：总K/D
const totalKD = computed(() => {
  if (!battleRecords.value?.roleDetailsList) return 0;
  const totalKills = battleRecords.value.roleDetailsList.reduce(
    (sum, member) => sum + (member.winCnt || 0),
    0,
  );
  const totalLosses = battleRecords.value.roleDetailsList.reduce(
    (sum, member) => sum + (member.loseCnt || 0),
    0,
  );
  if (totalLosses === 0) return 0;
  return formatClubBattleKD(totalKills, totalLosses);
});

const style1SummaryStats = computed(() => [
  { label: "总人数", value: battleRecords.value?.roleDetailsList?.length || 0 },
  { label: "总击杀", value: totalKills.value },
  { label: "总死亡", value: totalDeaths.value },
  { label: "总复活丹", value: totalRevives.value },
  { label: "总 K/D", value: totalKD.value },
]);

// 计算属性：击杀榜 Top3
const killRank = computed(() => {
  if (!playerRows.value.length) return [];
  return [...playerRows.value]
    .sort((a, b) => (b.winCnt || 0) - (a.winCnt || 0))
    .slice(0, 3);
});

// 计算属性：K/D榜 Top3
const kdRank = computed(() => {
  if (!playerRows.value.length) return [];
  return [...playerRows.value]
    .sort((a, b) => b.kd - a.kd)
    .slice(0, 3);
});

// 计算属性：复活榜 Top3
const reviveRank = computed(() => {
  if (!playerRows.value.length) return [];
  return [...playerRows.value]
    .sort((a, b) => b.reviveCnt - a.reviveCnt)
    .slice(0, 3);
});

const style1SummaryPanels = computed(() => [
  {
    title: "击杀前3",
    items: killRank.value.map((player, index) => ({
      avatar: player.headImg,
      key: `kill-${index}`,
      name: player.name,
      value: player.winCnt,
    })),
  },
  {
    title: "攻城前3",
    items: occupyRank.value.map((player, index) => ({
      avatar: player.headImg,
      key: `occupy-${index}`,
      name: player.name,
      value: player.buildingCnt,
    })),
  },
  {
    title: "KD 前3",
    items: kdRank.value.map((player, index) => ({
      avatar: player.headImg,
      key: `kd-${index}`,
      name: player.name,
      value: player.kd,
    })),
  },
  {
    title: "复活丹前3",
    items: reviveRank.value.map((player, index) => ({
      avatar: player.headImg,
      key: `revive-${index}`,
      name: player.name,
      value: player.reviveCnt,
    })),
  },
]);

// --- 新增计算属性和方法 ---

// 攻城榜 Top3
const occupyRank = computed(() => {
  if (!playerRows.value.length) return [];
  return [...playerRows.value]
    .sort((a, b) => (b.buildingCnt || 0) - (a.buildingCnt || 0))
    .slice(0, 3);
});

// 死亡榜 Top3
const deathRank = computed(() => {
  if (!playerRows.value.length) return [];
  return [...playerRows.value]
    .sort((a, b) => (b.loseCnt || 0) - (a.loseCnt || 0))
    .slice(0, 3);
});

// 生存榜 Top3 (以死亡数少排序，且至少有1次击杀或攻城)
const survivalRank = computed(() => {
  if (!playerRows.value.length) return [];
  return [...playerRows.value]
    .filter((p) => p.winCnt > 0 || p.buildingCnt > 0)
    .sort((a, b) => (a.loseCnt || 0) - (b.loseCnt || 0))
    .slice(0, 3)
    .map((p) => ({ ...p, survivalCnt: p.loseCnt }));
});

const totalDeaths = computed(() => {
  if (!battleRecords.value?.roleDetailsList) return 0;
  return battleRecords.value.roleDetailsList.reduce(
    (sum, member) => sum + (member.loseCnt || 0),
    0,
  );
});

const totalBuilding = computed(() => {
  if (!battleRecords.value?.roleDetailsList) return 0;
  return battleRecords.value.roleDetailsList.reduce(
    (sum, member) => sum + (member.buildingCnt || 0),
    0,
  );
});

const totalWinRate = computed(() => {
  const kills = totalKills.value;
  const deaths = totalDeaths.value;
  if (kills + deaths === 0) return "0.0";
  return ((kills / (kills + deaths)) * 100).toFixed(1);
});

const avgKills = computed(() => {
  if (
    !battleRecords.value?.roleDetailsList ||
    battleRecords.value.roleDetailsList.length === 0
  )
    return 0;
  return (
    totalKills.value / battleRecords.value.roleDetailsList.length
  ).toFixed(1);
});

const mvpPlayer = computed(() => {
  if (!playerRows.value.length) return null;
  return playerRows.value[0];
});

const maxKills = computed(() =>
  Math.max(
    ...(battleRecords.value?.roleDetailsList?.map((p) => p.winCnt || 0) || [0]),
  ),
);
const maxDeaths = computed(() =>
  Math.max(
    ...(battleRecords.value?.roleDetailsList?.map((p) => p.loseCnt || 0) || [
      0,
    ]),
  ),
);
const maxOccupies = computed(() =>
  Math.max(
    ...(battleRecords.value?.roleDetailsList?.map(
      (p) => p.buildingCnt || 0,
    ) || [0]),
  ),
);

const getPercent = (val, max) => {
  if (!max) return 0;
  return Math.min(100, (val / max) * 100);
};

const style3Metrics = computed(() => [
  {
    label: "总击杀",
    meta: "本周火力总量",
    tone: "danger",
    value: totalKills.value,
  },
  {
    label: "总攻城",
    meta: "推进节点贡献",
    tone: "warning",
    value: totalBuilding.value,
  },
  {
    label: "总 K/D",
    meta: "全队压制效率",
    tone: "success",
    value: totalKD.value,
  },
  {
    label: "总复活丹",
    meta: "高压补给消耗",
    tone: "accent",
    value: totalRevives.value,
  },
]);

const style4Metrics = computed(() => [
  {
    label: "总击杀",
    meta: "输出压制",
    value: totalKills.value,
  },
  {
    label: "总死亡",
    meta: "承压总量",
    value: totalDeaths.value,
  },
  {
    label: "总攻城",
    meta: "推进效率",
    value: totalBuilding.value,
  },
  {
    label: "总胜率",
    meta: "击杀 / 击杀+死亡",
    value: `${totalWinRate.value}%`,
  },
]);

const style4RankPanels = computed(() => [
  {
    getValue: (player) => player.winCnt || 0,
    icon: "⚔️",
    key: "kill",
    players: killRank.value,
    title: "击杀尖兵",
  },
  {
    getValue: (player) => player.buildingCnt || 0,
    icon: "🏰",
    key: "occupy",
    players: occupyRank.value,
    title: "攻城骨干",
  },
  {
    getValue: (player) => player.kd,
    icon: "📈",
    key: "kd",
    players: kdRank.value,
    title: "效率核心",
  },
  {
    getValue: (player) => player.reviveCnt,
    icon: "💊",
    key: "revive",
    players: reviveRank.value,
    title: "复活消耗",
  },
]);

const getKillColor = (val) => getClubBattleKillColor(val);

const getOccupyColor = (val) => getClubBattleOccupyColor(val);

const getDeathColor = (val) => getClubBattleDeathColor(val);

const getReviveColor = (val) => getClubBattleReviveColor(val);

// 处理图片加载错误
const handleImageError = (event) => {
  event.target.style.display = "none";
};

const disabledDate = (current) => {
  return current.getDay() !== 6 || current > Date.now();
};

// 日期选择时调用查询战绩方法
const fetchBattleRecordsByDate = (val) => {
  if (val !== undefined) {
    queryDate.value = val;
  } else {
    queryDate.value = getLastSaturday();
  }
  fetchBattleRecords();
};

// 查询战绩
const fetchBattleRecords = async () => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择游戏角色");
    return;
  }

  const tokenId = tokenStore.selectedToken.id;

  // 检查WebSocket连接
  const wsStatus = tokenStore.getWebSocketStatus(tokenId);
  if (wsStatus !== "connected") {
    message.error("WebSocket未连接，无法查询战绩");
    return;
  }

  loading.value = true;

  try {
    const result = await tokenStore.sendMessageWithPromise(
      tokenId,
      "legionwar_getdetails",
      { date: queryDate.value },
      10000,
    );

    if (result && result.roleDetailsList) {
      // 按击杀数从高到低排序
      const sortedRoleDetailsList = [...result.roleDetailsList].sort((a, b) => {
        return (b.winCnt || 0) - (a.winCnt || 0);
      });
      battleRecords.value = {
        ...result,
        roleDetailsList: sortedRoleDetailsList,
      };
      message.success("战绩加载成功，已按击杀数从高到低排序");
    } else {
      battleRecords.value = null;
      message.warning("未查询到战绩数据");
    }
  } catch (error) {
    console.error("查询战绩失败:", error);
    message.error(`查询失败: ${error.message}`);
    battleRecords.value = null;
  } finally {
    loading.value = false;
  }
};

// 刷新战绩
const handleRefresh = () => {
  fetchBattleRecords();
};

// 导出战绩
const handleExport = async () => {
  if (!battleRecords.value || !battleRecords.value.roleDetailsList) {
    message.warning("没有可导出的数据");
    return;
  }

  try {
    if (exportmethod.value.includes("1")) {
      const exportText = await formatBattleRecordsForExport(
        battleRecords.value.roleDetailsList,
        queryDate.value,
      );
      await copyToClipboard(exportText);
      message.success("战绩已复制到剪贴板");
    }
    if (exportmethod.value.includes("2")) {
      await exportToImage();
    }
    if (!exportmethod.value.includes("1")) {
      message.success("导出成功");
    }
  } catch (error) {
    console.error("导出失败:", error);
    message.error("导出失败，请重试");
  }
};

const exportToImage = async () => {
  // 校验：确保DOM已正确绑定
  if (!exportDom.value) {
    throw new Error("未找到要导出的DOM元素");
  }

  try {
    // 临时移除战神榜内容区域的最大高度限制，确保所有内容都可见
    const godRankingContents = exportDom.value.querySelectorAll(
      ".god-ranking-content",
    );
    const originalStyles = [];

    godRankingContents.forEach((content) => {
      originalStyles.push({
        element: content,
        maxHeight: content.style.maxHeight,
        overflow: content.style.overflow,
      });
      content.style.maxHeight = "none";
      content.style.overflow = "visible";
    });

    // 5. 用html2canvas渲染DOM为Canvas
    const canvas = await captureWithHtml2canvas(exportDom.value, {
      scale: 2, // 放大2倍，解决图片模糊问题
      useCORS: true, // 允许跨域图片（若DOM内有远程图片，需开启）
      backgroundColor: "#ffffff", // 避免透明背景（默认透明）
      logging: false, // 关闭控制台日志
    });

    // 恢复战神榜内容区域的原始样式
    originalStyles.forEach(({ element, maxHeight, overflow }) => {
      element.style.maxHeight = maxHeight;
      element.style.overflow = overflow;
    });

    // 6. Canvas转图片链接并下载
    const filename = `${queryDate.value.replace("/", "年").replace("/", "月")}日盐场战报.png`;
    downloadCanvasAsImage(canvas, filename);
  } catch (err) {
    console.error("DOM转图片失败：", err);
    throw new Error("导出图片失败，请重试");
  }
};

// 暴露方法给父组件
defineExpose({
  fetchBattleRecords,
});

// 初始化：挂载后自动拉取
onMounted(() => {
  fetchBattleRecords();
});
</script>

<style scoped lang="scss">
.records-container {
  background: var(--bg-primary);
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 0;
  box-sizing: border-box;
}

// 头部信息区
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .header-icon {
    width: 40px;
    height: 40px;
    object-fit: contain;
    border-radius: var(--border-radius-md);
    background: var(--bg-secondary);
    padding: var(--spacing-xs);
    box-sizing: border-box;
  }

  .header-title {
    h2 {
      margin: 0;
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
      color: var(--text-primary);
    }

    p {
      margin: var(--spacing-xs) 0 0 0;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }
  }

  // 数据统计区
  .stats-section {
    display: flex;
    gap: var(--spacing-lg);
    align-items: center;

    .stat-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);

      .stat-label {
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
        font-weight: var(--font-weight-medium);
      }

      :deep(.n-tag) {
        font-size: var(--font-size-sm);
        padding: 4px 8px;
      }
    }
  }
}

// 功能操作区
.function-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;

  .function-left {
    .export-options {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);

      :deep(.n-checkbox-group) {
        display: flex;
        gap: var(--spacing-md);

        .n-checkbox {
          font-size: var(--font-size-sm);
          color: var(--text-primary);
        }
      }
    }
  }

  .function-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);

    :deep(.n-date-picker) {
      font-size: var(--font-size-sm);
      width: 200px;

      .n-input-wrapper {
        font-size: var(--font-size-sm);
      }
    }

    .action-btn {
      font-size: var(--font-size-sm);
      padding: 6px 12px;
      border-radius: var(--border-radius-sm);
      transition: all var(--transition-fast);

      &:hover {
        transform: translateY(-1px);
      }
    }
  }
}

.battle-records-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-section {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);

    .stats-section {
      width: 100%;
      justify-content: space-between;
    }
  }

  .function-section {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);

    .function-left,
    .function-right {
      width: 100%;
      justify-content: space-between;
    }
  }
}

/* ================== 样式一 (Style 1) ================== */
.style-1 {
  background: #fff;
  padding: var(--spacing-md);
  color: #333;
  font-family: Arial, sans-serif;
}

.style1-header h2 {
  text-align: center;
  font-size: 20px;
  margin-bottom: 20px;
  font-weight: bold;
  padding: 10px;
  background: #f3f3f3;
  border-bottom: 3px solid #800080;
}

.style1-content {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.style1-table-container {
  flex: 2;
  overflow-x: auto;
}

.style1-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.style1-table th {
  background: #800080;
  color: #fff;
  padding: 8px;
  text-align: center;
  font-weight: bold;
}

.style1-table td {
  padding: 6px;
  border-bottom: 1px solid #eee;
  text-align: center;
  vertical-align: middle;
  height: 36px;
}

.stat-bg-cell {
  background-color: var(--cell-bg);
}

.style1-table tr:nth-child(even) {
  background-color: #f9f9f9;
}

.col-rank {
  width: 50px;
}
.col-name {
  text-align: left !important;
  padding-left: 10px !important;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.player-avatar-small {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.player-avatar-placeholder-small {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #fff;
}

.style1-summary {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15px;
  min-width: 250px;
}

.summary-card {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.summary-title {
  background: #800080;
  color: #fff;
  padding: 8px;
  text-align: center;
  font-weight: bold;
  font-size: 14px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 15px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
  font-weight: bold;
}

.top3-item {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
}

.top3-rank {
  width: 25px;
  text-align: center;
  margin-right: 5px;
}

.rank-icon {
  width: 20px;
  height: 20px;
  vertical-align: middle;
}
.rank-icon-small {
  width: 16px;
  height: 16px;
  vertical-align: middle;
}

.rank-medal {
  font-size: 20px;
  line-height: 1;
}
.rank-medal-small {
  font-size: 16px;
  line-height: 1;
}

.top3-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
}

.top3-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.player-avatar-xs {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
}

.player-avatar-placeholder-xs {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #fff;
}

.top3-value {
  font-weight: bold;
  width: 40px;
  text-align: right;
}

/* ================== 样式二 (Style 2) ================== */
.style-2 {
  background: #eef2f7;
  padding: 20px;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  border-radius: 8px;
}

.style2-header {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  background: #fff;
  padding: 15px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.style2-title {
  display: flex;
  align-items: center;
  gap: 15px;
}

.trophy-icon {
  font-size: 36px;
}

.title-text h2 {
  font-size: 22px;
  color: #333;
  margin: 0;
  font-weight: 800;
}

.date-text {
  font-size: 14px;
  color: #888;
  margin-top: 4px;
}

.style2-dashboard {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.dashboard-stats {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.stat-card-row {
  display: flex;
  gap: 15px;
}

.stat-card-mini {
  flex: 1;
  background: #fff;
  padding: 15px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.stat-label-mini {
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.stat-value-mini {
  font-size: 18px;
  font-weight: 800;
  color: #333;
}

.warning-text {
  color: #ff9800;
}
.danger-text {
  color: #f44336;
}
.purple-text {
  color: #9c27b0;
}

.dashboard-mvp {
  width: 160px;
  background: #fff;
  border-radius: 12px;
  padding: 15px;
  text-align: center;
  position: relative;
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid #ffd700;
}

.mvp-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  margin-bottom: 8px;
  border: 2px solid #ffd700;
  object-fit: cover;
}

.mvp-avatar-placeholder {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #ffd700 0%, #ffab40 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
  font-weight: bold;
}

.mvp-crown {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 24px;
  transform: rotate(15deg);
}

.mvp-name {
  font-weight: bold;
  font-size: 16px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.mvp-label {
  font-size: 12px;
  color: #ffab40;
  font-weight: bold;
  background: #fff8e1;
  padding: 2px 8px;
  border-radius: 10px;
}

.style2-rankings-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.rank-card-s2 {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  border-top: 4px solid transparent;
}

.rank-card-s2.red-border {
  border-top-color: #ff5252;
}
.rank-card-s2.orange-border {
  border-top-color: #ffab40;
}
.rank-card-s2.green-border {
  border-top-color: #69f0ae;
}
.rank-card-s2.gray-border {
  border-top-color: #9e9e9e;
}
.rank-card-s2.purple-border {
  border-top-color: #e040fb;
}
.rank-card-s2.blue-border {
  border-top-color: #448aff;
}

.rank-card-title-s2 {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #444;
}

.rank-list-s2 {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rank-item-s2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.rank-num-s2 {
  width: 16px;
  height: 16px;
  background: #eee;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #666;
  margin-right: 8px;
}

.rank-item-s2:nth-child(1) .rank-num-s2 {
  background: #ffd700;
  color: #fff;
}
.rank-item-s2:nth-child(2) .rank-num-s2 {
  background: #c0c0c0;
  color: #fff;
}
.rank-item-s2:nth-child(3) .rank-num-s2 {
  background: #cd7f32;
  color: #fff;
}

.rank-player-s2 {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  overflow: hidden;
}

.rank-player-s2 .name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.avatar-xxs {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
}

.rank-val-s2 {
  font-weight: bold;
}
.rank-val-s2.red {
  color: #ff5252;
}
.rank-val-s2.orange {
  color: #ffab40;
}
.rank-val-s2.green {
  color: #4caf50;
}
.rank-val-s2.gray {
  color: #757575;
}
.rank-val-s2.purple {
  color: #9c27b0;
}
.rank-val-s2.blue {
  color: #2196f3;
}

.style2-table-wrapper {
  background: #fff;
  padding: 0;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.style2-table {
  width: 100%;
  border-collapse: collapse;
}

.style2-table thead {
  background: #4285f4;
}

.style2-table th {
  color: #fff;
  padding: 12px 8px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
}

.style2-table th:nth-child(2) {
  text-align: left;
  padding-left: 20px;
}

.style2-table td {
  padding: 10px 8px;
  border-bottom: 1px solid #f1f1f1;
  vertical-align: middle;
  text-align: center;
  font-size: 13px;
  color: #444;
}

.style2-table tr:hover {
  background: #f8fbff;
}

.medal-icon {
  font-size: 16px;
}
.rank-num-plain {
  font-weight: bold;
  color: #888;
}

.player-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-start;
  padding-left: 10px;
}

.player-name-s2 {
  font-weight: 600;
  color: #333;
}

.avatar-xs {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-placeholder-xs {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
}

.bar-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 150px;
}

.bar-val {
  width: 30px;
  text-align: right;
  font-weight: bold;
  font-size: 12px;
}
.bar-val.red {
  color: #ff5252;
}
.bar-val.gray {
  color: #9e9e9e;
}
.bar-val.orange {
  color: #ffab40;
}

.progress-bg {
  flex: 1;
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  width: var(--fill-width);
  height: 100%;
  border-radius: 3px;
}
.progress-fill.red {
  background: #ff5252;
}
.progress-fill.orange {
  background: #ffab40;
}
.progress-fill.gray {
  background: #9e9e9e;
}

.kd-val {
  font-weight: bold;
  color: #4caf50;
}

/* ================== 样式三 (Style 3) ================== */
.style-3 {
  --style3-danger: #d1495b;
  --style3-warning: #d48a33;
  --style3-success: #1f7a5d;
  --style3-accent: #325c9a;
  background:
    radial-gradient(circle at top right, rgba(50, 92, 154, 0.12), transparent 24%),
    linear-gradient(180deg, #fcfaf4, #f3eee2);
  padding: 20px;
  border-radius: 18px;
  color: #1f2933;
  font-family: "Georgia", "Times New Roman", serif;
}

.style3-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 18px;
  margin-bottom: 18px;
}

.style3-hero__copy {
  padding: 22px;
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(246, 239, 223, 0.82)),
    rgba(255, 255, 255, 0.72);
  box-shadow: 0 14px 30px rgba(61, 67, 74, 0.08);
}

.style3-kicker {
  display: inline-flex;
  margin-bottom: 10px;
  color: #8a6a3a;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.style3-hero__copy h2 {
  margin: 0;
  font-size: 30px;
  line-height: 1.08;
}

.style3-mvp {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 18px;
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(255, 248, 225, 0.96), rgba(247, 235, 205, 0.86)),
    rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(201, 155, 77, 0.22);
  box-shadow: 0 14px 26px rgba(177, 133, 54, 0.12);
}

.style3-mvp__medal {
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(187, 140, 52, 0.12);
  color: #9b6a1f;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.style3-mvp__player {
  display: flex;
  align-items: center;
  gap: 12px;
}

.style3-mvp__avatar,
.style3-mvp__avatar-placeholder {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  flex-shrink: 0;
}

.style3-mvp__avatar {
  object-fit: cover;
  border: 2px solid rgba(201, 155, 77, 0.4);
}

.style3-mvp__avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f0c46e, #c9862d);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
}

.style3-mvp__meta {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.style3-mvp__meta strong {
  font-size: 18px;
}

.style3-mvp__meta span {
  color: #6e5731;
  font-size: 13px;
  line-height: 1.5;
}

.style3-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.style3-stat-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(83, 97, 110, 0.1);
  box-shadow: 0 10px 18px rgba(34, 40, 46, 0.05);
}

.style3-stat-card.is-danger {
  border-color: rgba(209, 73, 91, 0.18);
}

.style3-stat-card.is-warning {
  border-color: rgba(212, 138, 51, 0.18);
}

.style3-stat-card.is-success {
  border-color: rgba(31, 122, 93, 0.18);
}

.style3-stat-card.is-accent {
  border-color: rgba(50, 92, 154, 0.18);
}

.style3-stat-card__label {
  color: #6d7781;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.style3-stat-card__value {
  font-size: 28px;
  line-height: 1;
}

.style3-stat-card__meta {
  color: #7a838d;
  font-size: 13px;
  line-height: 1.5;
}

.style3-podium {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.style3-podium-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(83, 97, 110, 0.1);
  box-shadow: 0 12px 24px rgba(34, 40, 46, 0.06);
}

.style3-podium-card.is-rank-1 {
  background:
    linear-gradient(180deg, rgba(255, 244, 211, 0.96), rgba(255, 255, 255, 0.82)),
    rgba(255, 255, 255, 0.82);
}

.style3-podium-card__rank {
  font-size: 22px;
}

.style3-podium-card__player {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.style3-podium-card__avatar,
.style3-podium-card__avatar-placeholder {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  flex-shrink: 0;
}

.style3-podium-card__avatar {
  object-fit: cover;
}

.style3-podium-card__avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(120, 132, 146, 0.16);
  color: #6d7781;
  font-size: 18px;
  font-weight: 700;
}

.style3-podium-card__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.style3-podium-card__copy strong {
  font-size: 16px;
}

.style3-podium-card__copy span {
  color: #707b86;
  font-size: 13px;
}

.style3-podium-card__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  color: #5c6670;
  font-size: 12px;
}

.style3-roster-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.style3-player-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(83, 97, 110, 0.08);
}

.style3-player-card.is-top3 {
  border-color: rgba(168, 125, 45, 0.22);
  box-shadow: inset 0 0 0 1px rgba(245, 215, 144, 0.24);
}

.style3-player-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.style3-player-card__identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.style3-player-card__rank {
  display: inline-flex;
  min-width: 36px;
  justify-content: center;
  padding: 5px 0;
  border-radius: 999px;
  background: rgba(50, 92, 154, 0.08);
  color: #325c9a;
  font-size: 12px;
  font-weight: 800;
}

.style3-player-card__avatar,
.style3-player-card__avatar-placeholder {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  flex-shrink: 0;
}

.style3-player-card__avatar {
  object-fit: cover;
}

.style3-player-card__avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(120, 132, 146, 0.16);
  color: #6d7781;
  font-size: 16px;
  font-weight: 700;
}

.style3-player-card__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.style3-player-card__copy strong {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.style3-player-card__copy span,
.style3-player-card__kd {
  color: #6f7983;
  font-size: 12px;
}

.style3-player-card__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.style3-mini-metric {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border-radius: 14px;
  background: rgba(244, 239, 227, 0.8);
}

.style3-mini-metric span {
  color: #7b858f;
  font-size: 11px;
}

.style3-mini-metric strong {
  font-size: 16px;
}

/* ================== 样式四 (Style 4) ================== */
.style-4 {
  background:
    radial-gradient(circle at top left, rgba(77, 134, 214, 0.18), transparent 24%),
    linear-gradient(180deg, #111827, #0f172a);
  padding: 20px;
  border-radius: 18px;
  color: #e5edf7;
  font-family: "SFMono-Regular", "JetBrains Mono", "Menlo", monospace;
}

.style4-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.style4-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 20px;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.56);
  border: 1px solid rgba(99, 120, 150, 0.22);
}

.style4-header__copy {
  min-width: 0;
}

.style4-header__eyebrow {
  display: inline-flex;
  margin-bottom: 10px;
  color: #7dd3fc;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.style4-header__copy h2 {
  margin: 0;
  font-size: 28px;
  line-height: 1.08;
}

.style4-header__status {
  display: flex;
  min-width: 140px;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(23, 37, 61, 0.9);
  border: 1px solid rgba(80, 110, 146, 0.26);
}

.style4-header__status span {
  color: #8ba1bb;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.style4-header__status strong {
  color: #f8fbff;
  font-size: 28px;
  line-height: 1;
}

.style4-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.style4-overview__card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(86, 106, 134, 0.22);
}

.style4-overview__card span {
  color: #8aa2bf;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.style4-overview__card strong {
  font-size: 22px;
  color: #f8fbff;
}

.style4-overview__card small {
  color: #6e88a8;
  font-size: 12px;
  line-height: 1.5;
}

.style4-content {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
}

.style4-rank-panels {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.style4-rank-panel {
  padding: 14px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.54);
  border: 1px solid rgba(86, 106, 134, 0.22);
}

.style4-rank-panel__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: #d8e5f4;
  font-size: 13px;
}

.style4-rank-panel__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.style4-rank-panel__item {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  font-size: 12px;
}

.style4-rank-panel__index {
  color: #5ec6ff;
}

.style4-rank-panel__name {
  min-width: 0;
  color: #eef5ff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.style4-rank-panel__value {
  color: #f8c66d;
  font-weight: 700;
}

.style4-table-panel {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(86, 106, 134, 0.22);
  background: rgba(15, 23, 42, 0.54);
}

.style4-table {
  width: 100%;
  border-collapse: collapse;
}

.style4-table thead {
  background: rgba(42, 67, 106, 0.9);
}

.style4-table th,
.style4-table td {
  padding: 12px 10px;
  border-bottom: 1px solid rgba(86, 106, 134, 0.18);
  text-align: center;
  font-size: 12px;
}

.style4-table th {
  color: #dce8f7;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.style4-table tbody tr:nth-child(even) {
  background: rgba(20, 30, 48, 0.4);
}

.style4-table__name-cell {
  text-align: left;
}

.style4-table__player {
  display: flex;
  align-items: center;
  gap: 8px;
}

.style4-table__avatar,
.style4-table__avatar-placeholder {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
}

.style4-table__avatar {
  object-fit: cover;
}

.style4-table__avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(94, 120, 155, 0.18);
  color: #bfd2e7;
}

@media (max-width: 768px) {
  .style1-content {
    flex-direction: column;
  }
  .style1-table-container,
  .style1-summary {
    width: 100%;
  }

  .style2-dashboard {
    flex-direction: column;
  }
  .stat-card-row {
    flex-wrap: wrap;
  }
  .dashboard-mvp {
    width: 100%;
    flex-direction: row;
    justify-content: flex-start;
    gap: 15px;
  }
  .mvp-crown {
    right: auto;
    left: 50px;
  }

  .style2-rankings-grid {
    grid-template-columns: 1fr;
  }

  .style3-hero,
  .style4-content {
    grid-template-columns: 1fr;
  }

  .style3-stats-grid,
  .style3-podium,
  .style3-roster-grid,
  .style4-overview {
    grid-template-columns: 1fr;
  }

  .style3-podium-card__metrics,
  .style3-player-card__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .style4-header {
    flex-direction: column;
  }
}
</style>
