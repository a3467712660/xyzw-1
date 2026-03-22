<template>
  <div class="club-warrank-container">
    <div class="club-warrank-card">
      <!-- 头部信息区 -->
      <div class="header-section">
        <div class="header-left">
          <img
            alt="俱乐部图标"
            class="header-icon"
            src="/icons/moonPalace.png"
          >
          <div class="header-title">
            <h2>盐场匹配信息详情</h2>
            <p>俱乐部盐场匹配详情</p>
          </div>
        </div>

        <!-- 数据统计区 -->
        <div
          v-if="battleRecords1 && battleRecords1.legionRankList"
          class="stats-section"
        >
          <div class="stat-item">
            <span class="stat-label">查询日期:</span>
            <n-tag type="info">{{ formatTimestamp1(inputDate1) }}</n-tag>
          </div>
          <div class="stat-item">
            <span class="stat-label">总俱乐部数:</span>
            <n-tag type="success">
              {{ battleRecords1.legionRankList.length }}
            </n-tag>
          </div>
        </div>
      </div>

      <!-- 功能操作区 -->
      <div class="function-section">
        <div class="function-left">
          <div class="export-options">
            <NCheckboxGroup
              name="group-exportmethod"
              size="small"
              v-model:value="exportmethod"
            >
              <NCheckbox value="1">表格导出</NCheckbox>
              <NCheckbox value="2">图片导出</NCheckbox>
            </NCheckboxGroup>
          </div>
        </div>

        <div class="function-right">
          <a-date-picker
            format="YYYY/MM/DD"
            value-format="YYYY/MM/DD"
            v-model:value="inputDate1"
            :default-value="inputDate1"
            :disabled-date="disabledDate"
            @change="fetchBattleRecordsByDate"
          ></a-date-picker>
          <n-button
            class="action-btn refresh-btn"
            size="small"
            :disabled="loading1"
            @click="handleRefresh1"
          >
            <template #icon>
              <n-icon>
                <Refresh></Refresh>
              </n-icon> </template
            >刷新
          </n-button>
          <n-button
            class="action-btn export-btn"
            size="small"
            type="primary"
            :disabled="!battleRecords1 || loading1"
            @click="handleExport1"
          >
            <template #icon>
              <n-icon>
                <Copy></Copy>
              </n-icon> </template
            >导出
          </n-button>
          <n-button
            class="action-btn edit-btn"
            size="small"
            :disabled="!battleRecords1 || loading1"
            :type="isEditMode ? 'warning' : 'default'"
            @click="toggleEditMode"
          >
            <template #icon>
              <n-icon>
                <CreateOutline></CreateOutline>
              </n-icon>
            </template>
            {{ isEditMode ? "退出编辑" : "调整排名" }}
          </n-button>
          <n-button
            class="action-btn sort-btn"
            size="small"
            type="info"
            :disabled="!battleRecords1 || loading1"
            @click="hcSort"
          >
            红淬排序
          </n-button>
          <n-button
            v-if="ScoreShow === 1"
            class="action-btn sort-btn"
            size="small"
            type="info"
            :disabled="!battleRecords1 || loading1"
            @click="scoreSort"
          >
            积分排序
          </n-button>
        </div>
      </div>

      <!-- 表格内容区 -->
      <div ref="exportDom" class="table-content">
        <!-- 公告区域 -->
        <div
          v-if="battleRecords1 && battleRecords1.legionRankList"
          class="announcement-section"
        >
          <div class="announcement-content">
            <span class="announcement-text"
              >盐场匹配信息实时更新中，请关注最新排名变化</span
            >
          </div>
        </div>

        <!-- 联盟分类标签栏 -->
        <div
          v-if="battleRecords1 && battleRecords1.legionRankList"
          class="alliance-tabs-section"
        >
          <div
            class="alliance-tab"
            :class="{ active: activeAlliance === '大联盟' }"
            @click="setActiveAlliance('大联盟')"
          >
            <span class="tab-text">大联盟</span>
            <span class="tab-count">{{
              getActiveAllianceCount("大联盟")
            }}</span>
          </div>
          <div
            class="alliance-tab"
            :class="{ active: activeAlliance === '梦盟' }"
            @click="setActiveAlliance('梦盟')"
          >
            <span class="tab-text">梦盟</span>
            <span class="tab-count">{{ getActiveAllianceCount("梦盟") }}</span>
          </div>
          <div
            class="alliance-tab"
            :class="{ active: activeAlliance === '正义联盟' }"
            @click="setActiveAlliance('正义联盟')"
          >
            <span class="tab-text">正义联盟</span>
            <span class="tab-count">{{
              getActiveAllianceCount("正义联盟")
            }}</span>
          </div>
          <div
            class="alliance-tab"
            :class="{ active: activeAlliance === '龙盟' }"
            @click="setActiveAlliance('龙盟')"
          >
            <span class="tab-text">龙盟</span>
            <span class="tab-count">{{ getActiveAllianceCount("龙盟") }}</span>
          </div>
          <div
            class="alliance-tab"
            :class="{ active: activeAlliance === '未知联盟' }"
            @click="setActiveAlliance('未知联盟')"
          >
            <span class="tab-text">未知联盟</span>
            <span class="tab-count">{{
              getActiveAllianceCount("未知联盟")
            }}</span>
          </div>
          <div
            class="alliance-tab all"
            :class="{ active: activeAlliance === 'all' }"
            @click="setActiveAlliance('all')"
          >
            <span class="tab-text">全部</span>
            <span class="tab-count">{{
              battleRecords1.legionRankList.length
            }}</span>
          </div>
        </div>
        <!-- 加载状态 -->
        <div v-if="loading1" class="loading-state">
          <n-spin size="large">
            <template #description> 正在加载盐场匹配数据... </template>
          </n-spin>
        </div>

        <!-- 匹配列表 -->
        <div
          v-else-if="battleRecords1 && battleRecords1.legionRankList"
          class="table-container"
        >
          <div class="desktop-table">
            <!-- 表格标题行 -->
            <div class="table-header">
              <div class="table-cell rank">排名</div>
              <div class="table-cell alliance">联盟</div>
              <div class="table-cell server">服务器</div>
              <div class="table-cell avatar">头像</div>
              <div class="table-cell name">名称</div>
              <div v-if="ScoreShow === 1" class="table-cell score">积分</div>
              <div class="table-cell red-quench">红淬</div>
              <div class="table-cell first-3">前三车头</div>
              <div class="table-cell power">战力</div>
              <div class="table-cell level">等级</div>
              <div class="table-cell announcement">公告</div>
            </div>

            <!-- 表格数据行 -->
            <div
              v-for="member in filteredLegionList"
              :key="member.id"
              class="table-row"
              :class="getAllianceClass(getMemberAlliance(member))"
            >
              <div class="table-cell rank">
                <div v-if="isEditMode" class="edit-rank">
                  <NInputNumber
                    class="input-w-70"
                    size="small"
                    v-model:value="manualRankings[member.id]"
                    :max="20"
                    :min="1"
                    :show-button="false"
                    @blur="handleRankBlur(member)"
                    @focus="handleRankFocus(member)"
                    @keydown.enter="$event.target.blur()"
                  ></NInputNumber>
                </div>
                <div v-else class="rank-container">
                  <span
                    v-if="getMemberRank(member) === 1"
                    class="rank-medal gold"
                  ></span>
                  <span
                    v-else-if="getMemberRank(member) === 2"
                    class="rank-medal silver"
                  ></span>
                  <span
                    v-else-if="getMemberRank(member) === 3"
                    class="rank-medal bronze"
                  ></span>
                  <span v-else class="rank-number">{{
                    getMemberRank(member)
                  }}</span>
                </div>
              </div>
              <div class="table-cell alliance">
                <div v-if="isEditMode" class="edit-alliance">
                  <NSelect
                    class="input-w-110"
                    size="small"
                    v-model:value="manualAlliances[member.id]"
                    :options="allianceOptions"
                  ></NSelect>
                </div>
                <span v-else class="alliance-tag">{{
                  getMemberAlliance(member)
                }}</span>
              </div>
              <div class="table-cell server">{{ member.serverId || 0 }}</div>
              <div class="table-cell avatar">
                <img
                  v-if="member.logo"
                  class="member-avatar"
                  :alt="member.name"
                  :src="member.logo"
                  @error="handleImageError"
                >
                <div v-else class="member-avatar-placeholder">
                  {{ member.name?.charAt(0) || "?" }}
                </div>
              </div>
              <div class="table-cell name">{{ member.name }}</div>
              <div v-if="member.sRScore !== -1" class="table-cell score">
                {{ formatScore(member.sRScore) || 0 }}
              </div>
              <div class="table-cell red-quench">
                {{ member.redQuench || 0 }}
              </div>
              <div class="table-cell first-3">
                <div class="hero-avatars">
                  <div
                    v-for="(hero, heroIndex) in member.topHeroes"
                    :key="heroIndex"
                    class="hero-card"
                  >
                    <div
                      class="hero-avatar-container"
                      @click="handleHeroClick(hero)"
                    >
                      <img
                        v-if="hero.headImg"
                        class="hero-avatar"
                        :alt="hero.name"
                        :src="hero.headImg"
                      >
                      <div v-else class="hero-avatar-placeholder">
                        {{ hero.name?.charAt(0) || "?" }}
                      </div>
                      <div class="hero-holy-beast" title="四圣数">
                        <span class="holy-beast-icon">🐉</span>
                        <span class="holy-beast-count">{{
                          hero.holyBeast
                        }}</span>
                      </div>
                    </div>
                    <div class="hero-info">
                      <div class="hero-name">{{ hero.name || "未知" }}</div>
                      <div class="hero-stats">
                        <span class="hero-power">{{
                          formatPower(hero.power)
                        }}</span>
                        <span
                          class="hero-redquench"
                          :class="getRedQuenchClass(hero.redQuench)"
                          >{{ hero.redQuench }}红</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="table-cell power">
                {{ formatPower(member.power) || 0 }}
              </div>
              <div class="table-cell level">
                <span>{{ member.level || 30 }}</span>
              </div>
              <div class="table-cell announcement">
                {{ member.announcement || "" }}
              </div>
            </div>
          </div>

          <div class="mobile-card-list">
            <div
              v-for="member in filteredLegionList"
              :key="`mobile-${member.id}`"
              class="mobile-member-card"
              :class="getAllianceClass(getMemberAlliance(member))"
            >
              <div class="mobile-card-header">
                <div class="mobile-rank">排名 {{ getMemberRank(member) }}</div>
                <span class="alliance-tag">{{
                  getMemberAlliance(member)
                }}</span>
                <span class="mobile-server"
                  >服务器 {{ member.serverId || 0 }}</span
                >
              </div>

              <div class="mobile-card-main">
                <div class="mobile-avatar-wrap">
                  <img
                    v-if="member.logo"
                    class="member-avatar"
                    :alt="member.name"
                    :src="member.logo"
                    @error="handleImageError"
                  >
                  <div v-else class="member-avatar-placeholder">
                    {{ member.name?.charAt(0) || "?" }}
                  </div>
                </div>
                <div class="mobile-base-info">
                  <div class="mobile-name">{{ member.name || "未知名称" }}</div>
                  <div class="mobile-metrics">
                    <span>等级 {{ member.level || 30 }}</span>
                    <span>战力 {{ formatPower(member.power) || 0 }}</span>
                    <span v-if="member.sRScore !== -1"
                      >积分 {{ formatScore(member.sRScore) || 0 }}</span
                    >
                    <span>红淬 {{ member.redQuench || 0 }}</span>
                  </div>
                </div>
              </div>

              <div class="mobile-block">
                <div class="mobile-block-title">前三车头</div>
                <div class="mobile-hero-list">
                  <div
                    v-for="(hero, heroIndex) in member.topHeroes"
                    :key="`mobile-hero-${member.id}-${heroIndex}`"
                    class="mobile-hero-card"
                    @click="handleHeroClick(hero)"
                  >
                    <img
                      v-if="hero.headImg"
                      class="mobile-hero-avatar"
                      :alt="hero.name"
                      :src="hero.headImg"
                    >
                    <div
                      v-else
                      class="mobile-hero-avatar hero-avatar-placeholder"
                    >
                      {{ hero.name?.charAt(0) || "?" }}
                    </div>
                    <div class="mobile-hero-name">
                      {{ hero.name || "未知" }}
                    </div>
                    <div class="mobile-hero-info">
                      <span>{{ formatPower(hero.power) }}</span>
                      <span :class="getRedQuenchClass(hero.redQuench)"
                        >{{ hero.redQuench }}红</span
                      >
                      <span>四圣 {{ hero.holyBeast || 0 }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mobile-block">
                <div class="mobile-block-title">公告</div>
                <div class="mobile-announcement">
                  {{ member.announcement || "暂无公告" }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else-if="!loading1" class="empty-state">
          <n-empty description="暂无盐场匹配数据" size="large">
            <template #icon>
              <n-icon>
                <DocumentText></DocumentText>
              </n-icon>
            </template>
          </n-empty>
        </div>
      </div>
    </div>

    <!-- 玩家信息模态框 -->
    <NModal
      class="modal-w-800"
      preset="card"
      title="对手信息"
      v-model:show="showPlayerInfoModal"
      :bordered="false"
      :segmented="{ content: 'soft', footer: 'soft' }"
      :show-close="false"
    >
      <template #header-extra>
        <span v-if="playerInfo" class="player-id">ID: {{ playerInfo.id }}</span>
      </template>

      <div v-if="playerInfo" class="player-info-content">
        <div class="player-info-main">
          <NAvatar
            round
            class="player-avatar"
            :size="60"
            :src="playerInfo.headImg"
          ></NAvatar>
          <div class="player-info-detail">
            <h3>
              {{ playerInfo.name }}
              <n-tag
                v-if="playerInfo.legacy > 0"
                class="legacy-tag ml-8"
                size="small"
                :style="{
                  '--legacy-bg': legacycolor[playerInfo.legacy]?.value,
                }"
              >
                {{ legacycolor[playerInfo.legacy]?.name || "未知" }}
              </n-tag>
            </h3>
            <p>
              区服: {{ playerInfo.serverName || "未知" }} | 战力:
              {{ formatPower(playerInfo.power) }}
            </p>
            <p>俱乐部: {{ playerInfo.legionName || "无" }}</p>
            <p>
              总红数: {{ playerInfo.totalRedCount || 0 }} | 总开孔数:
              {{ playerInfo.totalHoleCount || 0 }} | 四圣数:
              {{ playerInfo.holyBeast || 0 }}
            </p>
          </div>
        </div>

        <div class="action-section">
          <div class="fight-inline">
            <div class="fight-count-container">
              <label
class="fight-count-label"
for="fightCount"
                >切磋次数:</label
              >
              <NInput
                id="fightCount"
                class="fight-count-input"
                max="100"
                min="1"
                placeholder="请输入切磋次数"
                size="small"
                type="number"
                v-model:value="fightCount"
                :step="1"
                @input="validateFightCount"
              ></NInput>
              <div class="fight-count-hint">范围: 1-100</div>
            </div>
            <n-button
              class="mr-8"
              size="small"
              type="tertiary"
              @click="showPlayerInfoModal = false"
            >
              关闭
            </n-button>
          </div>
          <n-button
            type="primary"
            :disabled="!isFightCountValid"
            @click="handleDuel"
          >
            切磋
          </n-button>
        </div>

        <!-- 切磋进度和结果 -->
        <div v-if="fightProgress.visible" class="fight-progress">
          <div class="progress-info">
            <div class="progress-title">切磋进行中</div>
            <div class="progress-stats">
              <span>总次数: {{ fightProgress.totalCount }}</span>
              <span>已完成: {{ fightProgress.completedCount }}</span>
              <span>剩余: {{ fightProgress.remainingCount }}</span>
              <span>胜: {{ fightProgress.winCount }}</span>
              <span>负: {{ fightProgress.lossCount }}</span>
            </div>
          </div>
          <n-progress
            status="processing"
            type="line"
            :percentage="fightProgress.percentage"
            :show-indicator="false"
            :stroke-width="8"
          ></n-progress>
        </div>

        <!-- 最终结果统计 -->
        <div v-if="fightResult.visible" class="fight-result">
          <!-- 结果标题和统计信息 -->
          <div class="result-header">
            <h4 class="result-title">切磋结果</h4>
            <div class="result-summary">
              <div class="summary-item">
                <span class="summary-label">总次数：</span>
                <span class="summary-value">{{ fightResult.totalCount }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">胜：</span>
                <span class="summary-value win">{{
                  fightResult.winCount
                }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">负：</span>
                <span class="summary-value loss">{{
                  fightResult.lossCount
                }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">胜率：</span>
                <span class="summary-value"
                  >{{
                    (
                      (fightResult.winCount / fightResult.totalCount) *
                      100
                    ).toFixed(2)
                  }}%</span
                >
              </div>
              <div class="summary-item">
                <span class="summary-label">我方掉将率：</span>
                <span class="summary-value"
                  >{{
                    (
                      (dieStats.ourDieHeroGameCount / fightResult.totalCount) *
                      100
                    ).toFixed(2)
                  }}%</span
                >
              </div>
              <div class="summary-item">
                <span class="summary-label">敌方掉将率：</span>
                <span class="summary-value"
                  >{{
                    (
                      (dieStats.enemyDieHeroGameCount /
                        fightResult.totalCount) *
                      100
                    ).toFixed(2)
                  }}%</span
                >
              </div>
            </div>
          </div>

          <!-- 战斗结果列表 -->
          <div class="result-list">
            <div
              v-for="(battle, index) in fightResult.resultCount"
              :key="index"
              class="battle-result-item"
              :class="[battle.isWin ? 'win' : 'loss']"
            >
              <div class="battle-header">
                <span class="battle-index">第 {{ index + 1 }} 场</span>
                <n-tag size="small" :type="battle.isWin ? 'success' : 'error'">
                  {{ battle.isWin ? "胜利" : "失败" }}
                </n-tag>
              </div>

              <div class="battle-details">
                <div class="battle-side left-side">
                  <NAvatar
                    round
                    class="side-avatar"
                    :size="32"
                    :src="battle.leftheadImg"
                  ></NAvatar>
                  <div class="side-info">
                    <span class="side-name">{{
                      battle.leftName || "未知"
                    }}</span>
                    <span class="side-power">战力: {{ battle.leftpower }}</span>
                    <span class="side-die"
                      >掉将: {{ battle.leftDieHero }} 个</span
                    >
                  </div>
                </div>

                <div class="battle-vs">VS</div>

                <div class="battle-side right-side">
                  <NAvatar
                    round
                    class="side-avatar"
                    :size="32"
                    :src="battle.rightheadImg"
                  ></NAvatar>
                  <div class="side-info">
                    <span class="side-name">{{
                      battle.rightName || "未知"
                    }}</span>
                    <span class="side-power"
                      >战力: {{ battle.rightpower }}</span
                    >
                    <span class="side-die"
                      >掉将: {{ battle.rightDieHero }} 个</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="result-actions">
            <n-button type="primary" @click="resetFightResult">
              重新切磋
            </n-button>
            <n-button @click="fightResult.visible = false">关闭结果</n-button>
          </div>
        </div>

        <div class="player-heroes">
          <h4>武将阵容</h4>
          <!-- 添加调试信息 -->
          <div v-if="playerInfo.heroList" class="debug-info debug-info-bottom">
            武将数量: {{ playerInfo.heroList.length }}
          </div>
          <div
            v-if="playerInfo.heroList && playerInfo.heroList.length > 0"
            class="hero-list"
          >
            <div
              v-for="(hero, index) in playerInfo.heroList"
              :key="hero.heroId || index"
              class="hero-item"
              @click="selectHeroInfo(hero)"
            >
              <NAvatar
                round
                class="cursor-pointer"
                :size="40"
                :src="hero.heroAvate"
              ></NAvatar>
              <div class="hero-info">
                <span class="hero-name">{{ hero.heroName }}</span>
                <div class="hero-stats">
                  <span>战力: {{ formatPower(hero.power || 0) }}</span>
                  <span>星级: {{ hero.star || 0 }}</span>
                  <span>红数: {{ hero.red || 0 }}</span>
                  <span>开孔: {{ hero.hole || 0 }}</span>
                  <span :class="hero.HolyBeast ? 'opened' : 'closed'">
                    {{ hero.HolyBeast ? "已开四圣" : "未开四圣" }}
                  </span>
                  <span v-if="hero.HolyBeast"
                    >四圣等级: {{ hero.HBlevel || 0 }}</span
                  >
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-heroes">
            <p>未查询到武将信息</p>
            <!-- 添加调试信息 -->
            <div v-if="playerInfo.heroList" class="debug-info debug-info-top">
              武将列表为空
            </div>
            <div v-else class="debug-info debug-info-top">武将列表未定义</div>
          </div>
        </div>
      </div>
    </NModal>

    <!-- 武将详情模态框 -->
    <NModal
      class="hero-detail-modal modal-w-600"
      preset="card"
      size="large"
      title="武将信息"
      v-model:show="showHeroModal"
      :bordered="false"
      :segmented="{ content: 'soft', footer: 'soft' }"
      :show-close="true"
    >
      <template #header-extra>
        <span class="hero-id">武将ID: {{ heroModealTemp?.heroId }}</span>
      </template>

      <div v-if="heroModealTemp" class="hero-modal-content">
        <div class="hero-modal-header">
          <div class="hero-modal-avatar">
            <img
              v-if="heroModealTemp.heroAvate"
              :alt="heroModealTemp.heroName"
              :src="heroModealTemp.heroAvate"
            >
            <div v-else class="hero-placeholder">
              {{ heroModealTemp.heroName?.substring(0, 2) || "?" }}
            </div>
          </div>
          <div class="hero-modal-basic">
            <h3 class="hero-modal-name">{{ heroModealTemp.heroName }}</h3>
            <div class="hero-modal-stats">
              <span class="stat-item">{{
                formatPower(heroModealTemp.power)
              }}</span>
              <span class="stat-item">等级: {{ heroModealTemp.level }}</span>
              <span class="stat-item">星级: {{ heroModealTemp.star }}</span>
              <n-tag :type="heroModealTemp.HolyBeast ? 'success' : 'warning'">
                {{ heroModealTemp.HolyBeast ? "已激活" : "未激活" }}
              </n-tag>
            </div>
          </div>
        </div>

        <div class="hero-modal-details">
          <n-descriptions bordered column="3" label-placement="left">
            <n-descriptions-item label="战力">
              {{ formatPower(heroModealTemp.power) }}
            </n-descriptions-item>
            <n-descriptions-item label="等级">
              {{ heroModealTemp.level }}
            </n-descriptions-item>
            <n-descriptions-item label="星级">
              {{ heroModealTemp.star }}
            </n-descriptions-item>
            <n-descriptions-item label="开孔数">
              {{ heroModealTemp.hole }}
            </n-descriptions-item>
            <n-descriptions-item label="红孔数">
              {{ heroModealTemp.red }}
            </n-descriptions-item>
            <n-descriptions-item label="四圣状态">
              {{ heroModealTemp.HolyBeast ? "已激活" : "未激活" }}
            </n-descriptions-item>
            <n-descriptions-item
              v-if="heroModealTemp.HolyBeast"
              label="四圣等级"
            >
              {{ heroModealTemp.HBlevel }}
            </n-descriptions-item>
            <n-descriptions-item label="鱼灵">
              {{
                heroModealTemp?.PearlInfo?.FishInfo?.name !== undefined
                  ? heroModealTemp.PearlInfo?.FishInfo?.name
                  : "无"
              }}
            </n-descriptions-item>
            <n-descriptions-item label="鱼珠技能">
              {{
                heroModealTemp?.PearlInfo?.PearlSkill?.name !== undefined
                  ? heroModealTemp.PearlInfo?.PearlSkill?.name
                  : "无"
              }}
            </n-descriptions-item>
            <n-descriptions-item label="鱼灵洗练">
              <div v-if="heroModealTemp?.PearlInfo?.slotMap?.length > 0">
                <div
                  v-for="item in heroModealTemp.PearlInfo.slotMap"
                  :key="item.id"
                  class="ModalEquipment"
                  :style="{ '--equip-color': item.value }"
                ></div>
              </div>
              <div v-else>无</div>
            </n-descriptions-item>
          </n-descriptions>
        </div>

        <div class="hero-modal-equipment">
          <h4 class="section-title">装备详情</h4>
          <div class="equipment-grid">
            <div class="equipment-item">
              <span class="equipment-label">武器:</span>
              <div class="equipment-slots">
                <div
                  v-for="(item, idx) in Object.values(
                    Object.values(heroModealTemp.equipment)[0]?.quenches || {},
                  )"
                  :key="idx"
                  class="equipment-slot"
                  :class="{ 'red-slot': item.colorId === 6 }"
                ></div>
              </div>
            </div>
            <div class="equipment-item">
              <span class="equipment-label">衣服:</span>
              <div class="equipment-slots">
                <div
                  v-for="(item, idx) in Object.values(
                    Object.values(heroModealTemp.equipment)[1]?.quenches || {},
                  )"
                  :key="idx"
                  class="equipment-slot"
                  :class="{ 'red-slot': item.colorId === 6 }"
                ></div>
              </div>
            </div>
            <div class="equipment-item">
              <span class="equipment-label">头盔:</span>
              <div class="equipment-slots">
                <div
                  v-for="(item, idx) in Object.values(
                    Object.values(heroModealTemp.equipment)[2]?.quenches || {},
                  )"
                  :key="idx"
                  class="equipment-slot"
                  :class="{ 'red-slot': item.colorId === 6 }"
                ></div>
              </div>
            </div>
            <div class="equipment-item">
              <span class="equipment-label">坐骑:</span>
              <div class="equipment-slots">
                <div
                  v-for="(item, idx) in Object.values(
                    Object.values(heroModealTemp.equipment)[3]?.quenches || {},
                  )"
                  :key="idx"
                  class="equipment-slot"
                  :class="{ 'red-slot': item.colorId === 6 }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <n-button @click="showHeroModal = false">关闭</n-button>
      </template>
    </NModal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import {
  NAvatar,
  NCheckbox,
  NCheckboxGroup,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  useMessage,
} from "naive-ui/es";
import { useTokenStore } from "@/stores/tokenStore";
import { useClubWarrankRecords } from "@/composables/useClubWarrankRecords";
import { useClubWarrankRanking } from "@/composables/useClubWarrankRanking";
import { useClubWarrankDuel } from "@/composables/useClubWarrankDuel";
import { captureWithHtml2canvas } from "@/utils/html2canvasLoader";
import { downloadCanvasAsImage } from "@/utils/imageExport";
import { Copy, CreateOutline, DocumentText, Refresh } from "@vicons/ionicons5";
import {
  copyToClipboard,
  formatTimestamp1,
  getLastSaturday,
} from "@/utils/clubBattleUtils";
import {
  allianceincludes,
  formatWarrankRecordsForExport,
  gettoday,
} from "@/utils/clubWarrankUtils";
import { HERO_DICT, HeroFillInfo, legacycolor } from "@/utils/HeroList";

defineProps({
  inline: {
    type: Boolean,
    default: false,
  },
});

const message = useMessage();
const tokenStore = useTokenStore();

function formatPower(power) {
  if (!power) return "0";
  if (power >= 100000000) {
    return `${(power / 100000000).toFixed(2)}亿`;
  }
  if (power >= 10000) {
    return `${(power / 10000).toFixed(2)}万`;
  }
  return power.toString();
}

function formatScore(score) {
  return score ? score.toFixed(0).toString() : "0";
}

const {
  ScoreShow,
  battleRecords1,
  disabledDate,
  exportDom,
  exportmethod,
  fetchBattleRecords1,
  fetchBattleRecordsByDate,
  handleExport1,
  handleRefresh1,
  inputDate1,
  loading1,
  queryDate,
} = useClubWarrankRecords({
  allianceincludes,
  captureWithHtml2canvas,
  copyToClipboard,
  downloadCanvasAsImage,
  formatTimestamp1,
  formatWarrankRecordsForExport,
  getLastSaturday,
  gettoday,
  message,
  tokenStore,
});

// 新增联盟筛选功能
const {
  activeAlliance,
  allianceOptions,
  currentSortType,
  filteredLegionList,
  getActiveAllianceCount,
  getMemberAlliance,
  getMemberRank,
  handleRankBlur,
  handleRankFocus,
  hcSort,
  isEditMode,
  manualAlliances,
  manualRankings,
  redQuenchRankings,
  scoreSort,
  setActiveAlliance,
  toggleEditMode,
} = useClubWarrankRanking({
  allianceincludes,
  battleRecords: battleRecords1,
  message,
});

const {
  dieStats,
  fetchTargetInfo,
  fightCount,
  fightHistory,
  fightProgress,
  fightResult,
  handleDuel,
  handleHeroClick,
  heroModealTemp,
  isFightCountValid,
  playerInfo,
  queryLoading,
  queryTargetId,
  resetFightResult,
  selectHeroInfo,
  showHeroModal,
  showPlayerInfoModal,
  validateFightCount,
} = useClubWarrankDuel({
  HERO_DICT,
  HeroFillInfo,
  formatPower,
  message,
  tokenStore,
});

// 处理图片加载错误
const handleImageError = (event) => {
  event.target.style.display = "none";
};

// 联盟样式类
const getAllianceClass = (alliance) => {
  switch (alliance) {
    case "大联盟":
      return "alliance-large";
    case "梦盟":
      return "alliance-dream";
    case "正义联盟":
      return "alliance-xin-justice";
    case "龙盟":
      return "alliance-dragon";
    case "未知联盟":
      return "alliance-unknown";
    default:
      return "alliance-other";
  }
};

// 红淬样式类
const getRedQuenchClass = (redQuench) => {
  if (redQuench >= 60) {
    return "redquench-high";
  } else if (redQuench >= 50) {
    return "redquench-medium";
  } else {
    return "redquench-low";
  }
};

// 暴露方法给父组件
defineExpose({
  fetchBattleRecords1,
});

// Inline 模式：挂载后自动拉取
onMounted(() => {
  fetchBattleRecords1();
});
</script>

<style scoped lang="scss">
.modal-w-800 {
  width: min(800px, calc(100vw - 24px));
}

.modal-w-600 {
  width: min(600px, calc(100vw - 24px));
}

.input-w-70 {
  width: 70px;
}

.input-w-110 {
  width: 110px;
}

.ml-8 {
  margin-left: 8px;
}

.mr-8 {
  margin-right: 8px;
}

.legacy-tag {
  color: #fff;
  background-color: var(--legacy-bg);
}

.fight-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.debug-info {
  font-size: 12px;
  color: #999;
}

.debug-info-bottom {
  margin-bottom: 10px;
}

.debug-info-top {
  margin-top: 10px;
}

.cursor-pointer {
  cursor: pointer;
}

// 模态框样式
.player-info-content {
  padding: 20px;
}

.player-info-main {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--border-light);
}

.player-avatar {
  border: 2px solid var(--primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.player-info-detail h3 {
  margin: 0 0 8px 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.player-info-detail p {
  margin: 0 0 4px 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.action-section {
  margin: 15px 0;
  display: flex;
  justify-content: flex-start;
}

.fight-count-container {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: auto;
}

.fight-count-label {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.fight-count-input {
  width: 100px;
}

.fight-count-hint {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.fight-count-error {
  font-size: var(--font-size-xs);
  color: var(--error-color);
  margin-left: 4px;
}

.fight-progress {
  margin: 15px 0;
  padding: 15px;
  background: var(--bg-secondary);
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-light);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.progress-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.progress-stats {
  display: flex;
  gap: 15px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.fight-result {
  margin: 15px 0;
  padding: 15px;
  background: var(--bg-secondary);
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-light);
}

.fight-result h4 {
  margin: 0 0 12px 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
}

.result-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-sm);
}

.result-label {
  color: var(--text-secondary);
}

.result-value {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.result-value.win {
  color: var(--success-color);
}

.result-value.loss {
  color: var(--error-color);
}

.result-actions {
  margin-top: 15px;
  display: flex;
  justify-content: flex-start;
  gap: 8px;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-light);
}

/* 武将详情模态框样式 */
.hero-detail-modal {
  .hero-modal-content {
    padding: 20px 0;
  }

  .hero-modal-header {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 20px;
  }

  .hero-modal-avatar {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: var(--bg-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 2px solid var(--border-light);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .hero-placeholder {
      font-size: 36px;
      font-weight: var(--font-weight-bold);
      color: var(--text-secondary);
    }
  }

  .hero-modal-basic {
    flex: 1;
  }

  .hero-modal-name {
    margin: 0 0 10px 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
  }

  .hero-modal-stats {
    display: flex;
    align-items: center;
    gap: 15px;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);

    .stat-item {
      padding: 4px 8px;
      background: var(--bg-secondary);
      border-radius: var(--border-radius-sm);
      border: 1px solid var(--border-light);
    }
  }

  .hero-modal-details {
    margin-bottom: 20px;

    :deep(.n-descriptions) {
      font-size: var(--font-size-sm);

      .n-descriptions-item-label {
        font-weight: var(--font-weight-medium);
        color: var(--text-primary);
      }

      .n-descriptions-item-content {
        color: var(--text-secondary);
      }
    }
  }

  .hero-modal-equipment {
    margin-top: 20px;
  }

  .section-title {
    margin: 0 0 15px 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
  }

  .equipment-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
  }

  .equipment-item {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .equipment-label {
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    font-weight: var(--font-weight-medium);
    width: 60px;
  }

  .equipment-slots {
    display: flex;
    gap: 6px;
  }

  .equipment-slot {
    width: 20px;
    height: 20px;
    border: 1px solid var(--border-light);
    border-radius: var(--border-radius-sm);
    background: var(--bg-secondary);
  }

  .equipment-slot.red-slot {
    background: var(--error-color);
    border-color: var(--error-color);
  }

  /* 鱼灵洗练颜色块 */
  .ModalEquipment {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    margin-right: 4px;
    display: inline-block;
    vertical-align: middle;
    background-color: var(--equip-color);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .hero-detail-modal {
    :deep(.n-modal-content) {
      padding: 0 !important;
    }

    .hero-modal-header {
      flex-direction: column;
      text-align: center;
    }

    .equipment-grid {
      grid-template-columns: 1fr;
    }
  }
}

/* 切磋结果显示样式 */
.fight-result {
  margin: 15px 0;
  padding: 15px;
  background: var(--bg-secondary);
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-light);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-light);
}

.result-title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.result-summary {
  display: flex;
  gap: 15px;
  font-size: var(--font-size-sm);
  flex-wrap: wrap;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.summary-label {
  color: var(--text-secondary);
}

.summary-value {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.summary-value.win {
  color: var(--success-color);
}

.summary-value.loss {
  color: var(--error-color);
}

.result-list {
  margin-bottom: 15px;
}

.battle-result-item {
  margin-bottom: 10px;
  padding: 12px;
  background: var(--bg-primary);
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-light);
  border-left: 4px solid var(--border-light);
  transition: all var(--transition-fast);
}

.battle-result-item.win {
  border-left-color: var(--success-color);
  background: rgba(var(--success-color-rgb), 0.03);
}

.battle-result-item.loss {
  border-left-color: var(--error-color);
  background: rgba(var(--error-color-rgb), 0.03);
}

.battle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.battle-index {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.battle-details {
  display: flex;
  align-items: center;
  gap: 15px;
}

.battle-side {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.side-avatar {
  flex-shrink: 0;
}

.side-info {
  flex: 1;
  font-size: var(--font-size-sm);
}

.side-name {
  display: block;
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  margin-bottom: 3px;
}

.side-power {
  display: block;
  color: var(--text-secondary);
  margin-bottom: 2px;
}

.side-die {
  display: block;
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
}

.battle-vs {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--text-secondary);
  margin: 0 10px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .result-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .result-summary {
    gap: 10px;
  }

  .battle-details {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .battle-side {
    width: 100%;
  }

  .battle-vs {
    align-self: center;
    margin: 5px 0;
    transform: rotate(90deg);
  }
}

.player-heroes {
  margin-top: 20px;
}

.player-heroes h4 {
  margin: 0 0 12px 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
}

.hero-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.hero-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-secondary);
  padding: 12px 16px;
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-light);
  transition: all var(--transition-fast);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
    border-color: var(--primary-color);
  }
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.hero-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.hero-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.hero-stats span {
  padding: 2px 6px;
  background: var(--bg-primary);
  border-radius: var(--border-radius-full);
  border: 1px solid var(--border-light);
}

.hero-stats span.opened {
  background: rgba(var(--success-color-rgb), 0.1);
  color: var(--success-color);
  border-color: var(--success-color);
}

.hero-stats span.closed {
  background: rgba(var(--warning-color-rgb), 0.1);
  color: var(--warning-color);
  border-color: var(--warning-color);
}

.empty-heroes {
  background: var(--bg-secondary);
  padding: 30px;
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-light);
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.player-id {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

// 主容器样式
// 主容器样式
.club-warrank-container {
  width: 100%;
  height: 100%;
  padding: 0;
  box-sizing: border-box;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
}

// 卡片样式
.club-warrank-card {
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
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
        box-shadow: var(--shadow-medium);
      }

      &.refresh-btn {
        background: var(--bg-primary);
        border: 1px solid var(--border-medium);
      }

      &.export-btn {
        background: var(--primary-color);
        color: white;

        &:hover {
          background: var(--primary-color-hover);
        }
      }

      &.sort-btn {
        background: var(--info-color-light);
        color: var(--info-color);
        border: 1px solid var(--info-color);

        &:hover {
          background: var(--info-color-hover);
          color: white;
        }
      }
    }
  }
}

// 公告区域
.announcement-section {
  background: linear-gradient(
    135deg,
    var(--primary-color-light) 0%,
    var(--primary-color) 100%
  );
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;

  .announcement-content {
    display: flex;
    justify-content: center;
    align-items: center;

    .announcement-text {
      color: white;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      text-align: center;
      line-height: 1.5;
      max-width: 800px;
    }
  }
}

// 联盟分类标签栏
.alliance-tabs-section {
  display: flex;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: var(--spacing-xs);
  gap: var(--spacing-xs);
  flex-shrink: 0;

  .alliance-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: white;
    cursor: pointer;
    transition: all var(--transition-fast);
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid transparent;

    &:hover {
      background: rgba(255, 255, 255, 0.25);
      transform: translateY(-1px);
    }

    &.active {
      background: white;
      color: var(--primary-color);
      box-shadow: var(--shadow-medium);
      transform: translateY(-2px);
    }

    &.all {
      background: rgba(255, 255, 255, 0.2);

      &:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      &.active {
        background: white;
        color: var(--primary-color);
      }
    }

    .tab-text {
      font-size: var(--font-size-sm);
    }

    .tab-count {
      font-size: var(--font-size-xs);
      background: rgba(255, 255, 255, 0.3);
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: var(--font-weight-bold);

      .alliance-tab.active & {
        background: var(--primary-color);
        color: white;
      }
    }
  }
}

// 表格内容区
.table-content {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);

  // 加载状态
  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    background: var(--bg-primary);
    height: 100%;

    :deep(.n-spin) {
      font-size: var(--font-size-lg);

      .n-spin-description {
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
      }
    }
  }

  // 空状态
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    background: var(--bg-primary);
    height: 100%;

    :deep(.n-empty) {
      font-size: var(--font-size-sm);

      .n-empty-description {
        color: var(--text-secondary);
      }
    }
  }

  // 表格容器
  .table-container {
    flex: 1;
    min-width: 0;
    overflow: auto;
    background: var(--bg-primary);
    height: 100%;

    .desktop-table {
      min-width: max-content;
    }

    .mobile-card-list {
      display: none;
    }

    // 滚动条样式
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: var(--bg-secondary);
      border-radius: var(--border-radius-sm);
    }

    ::-webkit-scrollbar-thumb {
      background: var(--border-medium);
      border-radius: var(--border-radius-sm);

      &:hover {
        background: var(--border-dark);
      }
    }

    // 表格标题行
    .table-header {
      display: flex;
      width: 100%;
      min-width: 0;
      background: linear-gradient(
        180deg,
        var(--bg-secondary) 0%,
        var(--bg-primary) 100%
      );
      border-bottom: 2px solid var(--border-medium);
      font-weight: var(--font-weight-bold);
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      padding: var(--spacing-xs) var(--spacing-sm);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

      // 确保所有标题头居中对齐
      .table-cell {
        justify-content: center;
      }
    }

    // 表格数据行
    .table-row {
      display: flex;
      width: 100%;
      min-width: 0;
      align-items: center;
      padding: var(--spacing-xs) var(--spacing-sm);
      border-bottom: 1px solid var(--border-light);
      transition: all var(--transition-fast);
      background: var(--bg-primary);

      &:hover {
        background: var(--bg-secondary);
        transform: translateX(2px);
        box-shadow: inset 3px 0 0 var(--primary-color);
      }

      &:last-child {
        border-bottom: none;
      }

      // 联盟样式类
      &.alliance-large {
        .alliance-tag {
          background: var(--primary-color);
        }
      }

      &.alliance-dream {
        .alliance-tag {
          background: var(--success-color);
        }
      }

      &.alliance-xin-justice {
        .alliance-tag {
          background: var(--info-color);
        }
      }

      &.alliance-dragon {
        .alliance-tag {
          background: var(--error-color);
        }
      }

      &.alliance-unknown {
        .alliance-tag {
          background: var(--warning-color);
        }
      }

      &.alliance-other {
        .alliance-tag {
          background: var(--text-secondary);
        }
      }
    }

    // 表格单元格
    .table-cell {
      display: flex;
      align-items: center;
      padding: 0 var(--spacing-xs);
      font-size: var(--font-size-sm);
      color: var(--text-primary);

      // 单元格宽度分配
      &.rank {
        width: 64px;
        min-width: 64px;
        justify-content: center;
        font-weight: var(--font-weight-bold);
        color: var(--text-primary);
        padding: 4px 8px;

        .rank-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          padding: 4px 0;
        }

        .rank-medal {
          position: relative;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: var(--font-size-base);
          color: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          margin: 0 6px;

          &::before {
            content: attr(data-rank);
          }

          &.gold {
            background: linear-gradient(135deg, #ffd700 0%, #ffa500 100%);

            &::before {
              content: "1";
            }
          }

          &.silver {
            background: linear-gradient(135deg, #c0c0c0 0%, #a9a9a9 100%);

            &::before {
              content: "2";
            }
          }

          &.bronze {
            background: linear-gradient(135deg, #cd7f32 0%, #b87333 100%);

            &::before {
              content: "3";
            }
          }
        }

        .rank-number {
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-bold);
          color: var(--text-primary);
          margin: 0 6px;
        }
      }

      &.alliance {
        width: 86px;
        min-width: 86px;

        .alliance-tag {
          display: inline-block;
          padding: 3px 8px;
          border-radius: var(--border-radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
          transition: all var(--transition-fast);

          &:hover {
            transform: scale(1.05);
            box-shadow: var(--shadow-medium);
          }
        }
      }

      &.avatar {
        width: 48px;
        min-width: 48px;
        justify-content: center;

        .member-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--border-light);
          transition: all var(--transition-fast);

          &:hover {
            transform: scale(1.2);
            box-shadow: var(--shadow-medium);
            border-color: var(--primary-color);
          }
        }

        .member-avatar-placeholder {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(
            135deg,
            var(--primary-color) 0%,
            var(--primary-color-light) 100%
          );
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-bold);
          border: 2px solid var(--border-light);
        }
      }

      &.name {
        flex: 0 0 120px;
        min-width: 0;
        font-weight: var(--font-weight-bold);
        color: var(--text-primary);
        font-size: var(--font-size-base);
        overflow-wrap: anywhere;
      }

      &.score {
        width: 78px;
        min-width: 78px;
        justify-content: center;
        color: var(--warning-color);
        font-weight: var(--font-weight-bold);
        font-size: var(--font-size-base);
        text-align: center;
      }

      &.red-quench {
        width: 78px;
        min-width: 78px;
        justify-content: center;
        font-weight: var(--font-weight-bold);
        text-align: center;

        &::before {
          content: "";
          display: inline-block;
          width: 12px;
          height: 12px;
          background: var(--error-color);
          border-radius: 50%;
          margin-right: 4px;
          vertical-align: middle;
        }
      }

      &.first-3 {
        flex: 1 1 320px;
        min-width: 260px;

        .hero-avatars {
          display: flex;
          gap: var(--spacing-xs);
          align-items: center;
          justify-content: flex-start;
          width: 100%;
          flex-wrap: nowrap;
          padding: var(--spacing-xs) 0;
          overflow: hidden;
        }

        .hero-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: calc(var(--spacing-xs) / 2);
          padding: calc(var(--spacing-xs) / 2);
          background: var(--bg-secondary);
          border-radius: var(--border-radius-sm);
          border: 1px solid var(--border-light);
          transition: all var(--transition-fast);
          min-width: 90px;
          flex: 1 1 0;
          max-width: none;
          cursor: pointer;

          &:hover {
            background: var(--bg-primary);
            transform: translateY(-2px);
            box-shadow: var(--shadow-medium);
            border-color: var(--primary-color);
          }

          &:active {
            transform: translateY(0);
            box-shadow: var(--shadow-sm);
          }
        }

        /* 覆盖全局hero-stats span样式，确保战力和红数正常显示 */
        .hero-stats span {
          padding: 0;
          background: none;
          border: none;
          border-radius: 0;
        }

        .hero-avatar-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          cursor: pointer;
        }

        .hero-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--border-light);
          transition: all var(--transition-fast);
          cursor: pointer;

          &:hover {
            transform: scale(1.1);
            border-color: var(--primary-color);
          }

          &:active {
            transform: scale(0.95);
          }
        }

        .hero-avatar-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(
            135deg,
            var(--primary-color) 0%,
            var(--primary-color-light) 100%
          );
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-bold);
          border: 2px solid var(--border-light);
          cursor: pointer;
          transition: all var(--transition-fast);

          &:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }

          &:active {
            transform: scale(0.95);
          }
        }

        .hero-holy-beast {
          position: absolute;
          right: -5px;
          bottom: -5px;
          display: flex;
          align-items: center;
          gap: 2px;
          background: linear-gradient(135deg, #ff6b6b, #ee5a24);
          color: white;
          padding: 2px 6px;
          border-radius: var(--border-radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
          box-shadow: var(--shadow-sm);
          border: 2px solid var(--bg-primary);
          z-index: 10;

          .holy-beast-icon {
            font-size: var(--font-size-sm);
          }

          .holy-beast-count {
            font-size: var(--font-size-xs);
          }
        }

        .hero-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          width: 100%;
        }

        .hero-name {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--text-primary);
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
        }

        .hero-stats {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-xs);
          font-size: var(--font-size-xs);
        }

        .hero-power,
        .hero-redquench {
          display: inline-block;
        }

        .hero-power {
          color: var(--text-primary);
          font-weight: var(--font-weight-medium);
        }

        .hero-redquench {
          font-weight: var(--font-weight-bold);
          padding: 1px 6px;
          border-radius: var(--border-radius-full);

          &.redquench-high {
            color: var(--error-color);
            background: rgba(var(--error-color-rgb), 0.1);
          }

          &.redquench-medium {
            color: var(--warning-color);
            background: rgba(var(--warning-color-rgb), 0.1);
          }

          &.redquench-low {
            color: var(--success-color);
            background: rgba(var(--success-color-rgb), 0.1);
          }
        }
      }

      &.power {
        width: 96px;
        min-width: 96px;
        justify-content: center;
        font-weight: var(--font-weight-bold);
        color: var(--primary-color);
        font-size: var(--font-size-base);
        text-align: center;
      }

      &.level {
        width: 62px;
        min-width: 62px;
        justify-content: center;

        &::before {
          content: "Lv.";
          font-size: var(--font-size-xs);
          color: var(--text-secondary);
          margin-right: 2px;
        }

        span {
          display: inline-block;
          padding: 2px 8px;
          background: linear-gradient(
            135deg,
            var(--primary-color-light) 0%,
            var(--primary-color) 100%
          );
          color: white;
          border-radius: var(--border-radius-full);
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-sm);
        }
      }

      &.server {
        width: 76px;
        min-width: 76px;
        justify-content: center;
        color: var(--text-secondary);
        font-size: var(--font-size-sm);
        text-align: center;
      }

      &.announcement {
        flex: 1 1 280px;
        min-width: 220px;
        color: var(--text-secondary);
        white-space: pre-wrap;
        overflow: visible;
        text-overflow: clip;
        font-size: var(--font-size-xs);
        line-height: 1.4;
        min-height: 24px;
        word-break: break-word;
      }
    }

    .mobile-member-card {
      border: 1px solid var(--border-light);
      border-radius: var(--border-radius-md);
      padding: var(--spacing-sm);
      background: var(--bg-primary);
      box-shadow: var(--shadow-sm);

      &.alliance-large .alliance-tag {
        background: var(--primary-color);
      }

      &.alliance-dream .alliance-tag {
        background: var(--success-color);
      }

      &.alliance-xin-justice .alliance-tag {
        background: var(--info-color);
      }

      &.alliance-dragon .alliance-tag {
        background: var(--error-color);
      }

      &.alliance-unknown .alliance-tag,
      &.alliance-other .alliance-tag {
        background: var(--warning-color);
      }
    }

    .mobile-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--spacing-xs);
      margin-bottom: var(--spacing-sm);
      flex-wrap: wrap;

      .mobile-rank {
        font-weight: var(--font-weight-bold);
        color: var(--text-primary);
      }

      .alliance-tag {
        display: inline-block;
        padding: 2px 8px;
        border-radius: var(--border-radius-full);
        font-size: var(--font-size-xs);
        color: #fff;
      }

      .mobile-server {
        font-size: var(--font-size-xs);
        color: var(--text-secondary);
      }
    }

    .mobile-card-main {
      display: flex;
      gap: var(--spacing-sm);
      align-items: center;
      margin-bottom: var(--spacing-sm);
    }

    .mobile-avatar-wrap {
      width: 36px;
      height: 36px;
      flex-shrink: 0;

      .member-avatar,
      .member-avatar-placeholder {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--border-light);
      }

      .member-avatar-placeholder {
        background: linear-gradient(
          135deg,
          var(--primary-color) 0%,
          var(--primary-color-light) 100%
        );
        color: #fff;
      }
    }

    .mobile-base-info {
      min-width: 0;
      flex: 1;
    }

    .mobile-name {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
      margin-bottom: 4px;
      overflow-wrap: anywhere;
    }

    .mobile-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;

      span {
        font-size: var(--font-size-xs);
        color: var(--text-secondary);
        background: var(--bg-secondary);
        border: 1px solid var(--border-light);
        border-radius: var(--border-radius-full);
        padding: 2px 8px;
      }
    }

    .mobile-block {
      margin-top: var(--spacing-sm);
    }

    .mobile-block-title {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    .mobile-hero-list {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }

    .mobile-hero-card {
      border: 1px solid var(--border-light);
      border-radius: var(--border-radius-sm);
      padding: 6px;
      background: var(--bg-secondary);
      min-width: 0;
    }

    .mobile-hero-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      object-fit: cover;
      margin-bottom: 4px;
    }

    .mobile-hero-avatar.hero-avatar-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(
        135deg,
        var(--primary-color) 0%,
        var(--primary-color-light) 100%
      );
      color: #fff;
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
    }

    .mobile-hero-name {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      margin-bottom: 4px;
      overflow-wrap: anywhere;
    }

    .mobile-hero-info {
      display: flex;
      flex-direction: column;
      gap: 2px;

      span {
        font-size: 11px;
        color: var(--text-secondary);
      }
    }

    .mobile-announcement {
      font-size: var(--font-size-xs);
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: var(--text-secondary);
      background: var(--bg-secondary);
      border: 1px solid var(--border-light);
      border-radius: var(--border-radius-sm);
      padding: 8px;
    }
  }
}

// 按钮样式调整
:deep(.n-button) {
  font-size: var(--font-size-sm);
  padding: 6px 12px;
  border-radius: var(--border-radius-sm);

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

// 输入框样式调整
:deep(.n-input-wrapper) {
  font-size: var(--font-size-sm);
}

// 响应式设计
@media (max-width: 1200px) {
  .header-section {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);

    .stats-section {
      width: 100%;
      justify-content: flex-start;
    }
  }

  .function-section {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);

    .function-right {
      width: 100%;
      justify-content: flex-start;
      flex-wrap: wrap;
      gap: var(--spacing-sm);
    }
  }

  .alliance-tabs-section {
    overflow-x: auto;
    justify-content: flex-start;

    .alliance-tab {
      flex: 0 0 auto;
      white-space: nowrap;
    }
  }

  .table-container {
    font-size: var(--font-size-xs);

    .table-header {
      padding: var(--spacing-xs) var(--spacing-sm);
    }

    .table-row {
      padding: var(--spacing-xs) var(--spacing-sm);
    }

    .table-cell {
      padding: 0 var(--spacing-xs);
      font-size: var(--font-size-xs);

      &.rank {
        width: 44px;
        min-width: 44px;
      }

      &.alliance {
        width: 78px;
        min-width: 78px;
      }

      &.avatar {
        width: 40px;
        min-width: 40px;

        .member-avatar,
        .member-avatar-placeholder {
          width: 28px;
          height: 28px;
        }
      }

      &.name {
        flex: 0 0 92px;
        min-width: 0;
      }

      &.score,
      &.red-quench {
        width: 64px;
        min-width: 64px;
      }

      &.first-3 {
        flex: 1 1 180px;
        min-width: 180px;

        .hero-card {
          min-width: 56px;
          padding: 2px;

          .hero-avatar,
          .hero-avatar-placeholder {
            width: 28px;
            height: 28px;
          }

          .hero-name {
            font-size: 11px;
          }

          .hero-stats {
            font-size: 11px;
          }
        }
      }

      &.power {
        width: 76px;
        min-width: 76px;
      }

      &.level,
      &.server {
        width: 58px;
        min-width: 58px;
      }

      &.announcement {
        flex: 1 1 140px;
        min-width: 140px;
      }
    }
  }
}

@media (max-width: 768px) {
  .club-warrank-container {
    padding: 0;
  }

  .club-warrank-card {
    border-radius: 0;
  }

  .header-section {
    padding: var(--spacing-sm);
    gap: var(--spacing-sm);
    align-items: flex-start;
  }

  .header-section .header-left {
    gap: var(--spacing-sm);
  }

  .header-section .header-title h2 {
    font-size: var(--font-size-lg);
  }

  .header-section .header-title p {
    display: none;
  }

  .header-section .stats-section {
    width: 100%;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .function-section {
    padding: var(--spacing-sm);
    gap: var(--spacing-sm);
  }

  .function-section .function-left {
    width: 100%;
  }

  .function-section .function-right {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--spacing-xs);
  }

  .function-section .function-right :deep(.n-date-picker) {
    grid-column: 1 / -1;
    width: 100% !important;
  }

  .function-section .function-right .action-btn {
    width: 100%;
    margin: 0;
    justify-content: center;
  }

  .alliance-tabs-section {
    overflow: visible;
    justify-content: flex-start;
    flex-wrap: wrap;
    padding: var(--spacing-xs);
    gap: 6px;
  }

  .alliance-tabs-section .alliance-tab {
    flex: 1 1 calc(33.333% - 6px);
    min-width: 0;
    max-width: calc(33.333% - 6px);
    white-space: normal;
    padding: 6px 8px;
  }

  .alliance-tabs-section .alliance-tab .tab-text,
  .alliance-tabs-section .alliance-tab .tab-count {
    line-height: 1.2;
  }

  .table-content .table-container {
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .table-content .table-container .desktop-table {
    display: none;
  }

  .table-content .table-container .mobile-card-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs);
  }

  .table-content .table-container .mobile-card-header {
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: center;
    gap: 6px;
  }

  .table-content .table-container .mobile-card-header .mobile-server {
    justify-self: end;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .table-content .table-container .mobile-hero-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 769px) {
  .table-content .table-container .desktop-table {
    display: block;
  }

  .table-content .table-container .mobile-card-list {
    display: none !important;
  }
}

@media (max-width: 420px) {
  .alliance-tabs-section .alliance-tab {
    flex-basis: calc(50% - 6px);
    max-width: calc(50% - 6px);
  }

  .table-content .table-container .mobile-card-header {
    grid-template-columns: 1fr 1fr;
  }

  .table-content .table-container .mobile-card-header .mobile-server {
    grid-column: 1 / -1;
    justify-self: start;
    text-align: left;
  }

  .table-content .table-container .mobile-hero-list {
    grid-template-columns: 1fr;
  }
}
</style>
