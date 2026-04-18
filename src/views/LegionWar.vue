<template>
  <div class="legion-war-page app-page">
    <PageHero
      eyebrow="军团战"
      title="战场态势控制台"
      :description="legionHeroDescription"
    >
      <template #meta>
        <div class="app-chip-row">
          <span class="app-inline-stat">
            <strong>{{ battlefieldStatusText }}</strong>
            战场状态
          </span>
          <span class="app-inline-stat">
            <strong>{{ connectionStatusText }}</strong>
            连接状态
          </span>
          <span class="app-inline-stat">
            <strong>{{ layoutModeLabel }}</strong>
            当前布局
          </span>
          <span class="app-inline-stat">
            <strong>{{ perspectiveLabel }}</strong>
            当前视角
          </span>
        </div>
      </template>

      <template #actions>
        <PageToolbar class="legion-war-page__hero-toolbar">
          <template #left>
            <StatusPill
              :label="battlefieldStatusText"
              :tone="isEntireBattlefield ? 'success' : 'warning'"
            ></StatusPill>
            <StatusPill
              :label="connectionStatusText"
              :tone="isConnected ? 'success' : 'default'"
            ></StatusPill>
          </template>

          <template #right>
            <n-button
              size="large"
              type="primary"
              :disabled="!isEntireBattlefield"
              @click="getBattlefieldInfo"
            >
              拉取数据
            </n-button>
            <n-button
              size="large"
              :disabled="!canBroadcastLegionStatus"
              @click="sendMessageToLegion"
            >
              发送频道复活信息
            </n-button>
          </template>
        </PageToolbar>
      </template>
    </PageHero>

    <SummaryGrid :items="summaryCards"></SummaryGrid>

    <n-grid item-responsive responsive="screen" :x-gap="16" :y-gap="16">
      <n-grid-item span="24 l:17">
        <SectionCard
          class="legion-war-page__map-card"
          description="保留单 canvas 渲染与点击/resize 链路，只重做状态栏和容器层级。"
          title="战场图示"
        >
          <template #header-extra>
            <StatusPill
              size="sm"
              :label="battlefieldStatusText"
              :tone="isEntireBattlefield ? 'success' : 'warning'"
            ></StatusPill>
          </template>

          <div class="legion-war-page__map-toolbar">
            <div class="legion-war-page__map-meta">
              <span class="map-meta-chip">
                战场编号：{{ battlefieldHintText }}
              </span>
              <span class="map-meta-chip">
                当前时间：{{ currentDateTime }}
              </span>
            </div>

            <n-button
              tertiary
              type="primary"
              :disabled="!isEntireBattlefield"
              @click="getBattlefieldInfo"
            >
              刷新当前战场
            </n-button>
          </div>

          <div class="map-container">
            <canvas ref="legionWarMapDom" class="mapCanvas"></canvas>
          </div>
        </SectionCard>
      </n-grid-item>

      <n-grid-item span="24 l:7">
        <SectionCard
          class="legion-war-page__control-card"
          description="布局切换、战况视角、战场数据刷新和频道广播都收口到这里。"
          title="操作面板"
        >
          <div class="legion-war-page__control-stack">
            <div class="legion-war-page__toggle-card">
              <div class="legion-war-page__toggle-copy">
                <strong>地图布局</strong>
                <p>在占领布局与分布布局间切换，不改变底层地图数据。</p>
              </div>
              <div class="legion-war-page__toggle-control">
                <span>占领</span>
                <n-switch
                  v-model:value="isOccupyOrDistribution"
                  @update:value="handleChange"
                ></n-switch>
                <span>分布</span>
              </div>
            </div>

            <div class="legion-war-page__toggle-card">
              <div class="legion-war-page__toggle-copy">
                <strong>战况视角</strong>
                <p>切换战队战况和个人战况，保持现有绘图和点击查看逻辑。</p>
              </div>
              <div class="legion-war-page__toggle-control">
                <span>战队</span>
                <n-switch
                  v-model:value="isLegionOrIndividual"
                  @update:value="handleChange"
                ></n-switch>
                <span>个人</span>
              </div>
            </div>

            <div class="legion-war-page__action-list">
              <n-button
                class="legion-war-page__action"
                type="primary"
                :disabled="!isEntireBattlefield"
                @click="getBattlefieldInfo"
              >
                拉取战场数据
              </n-button>
              <n-button
                class="legion-war-page__action"
                :disabled="!canBroadcastLegionStatus"
                @click="sendMessageToLegion"
              >
                发送各战队免费复活到战队频道
              </n-button>
            </div>

            <div class="legion-war-page__note">
              <strong>当前说明：</strong>
              {{ controlHintText }}
            </div>
          </div>
        </SectionCard>
      </n-grid-item>
    </n-grid>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useLegionWarActions } from "@/composables/useLegionWarActions";
import {
  extractValidData,
  formatPower,
  HexGraph,
  typeBg,
} from "@/utils/legionWar";
import { useTokenStore } from "@/stores/tokenStore";
import { useMessage } from "naive-ui/es";
import PageHero from "@/components/workbench/PageHero.vue";
import PageToolbar from "@/components/workbench/PageToolbar.vue";
import SectionCard from "@/components/workbench/SectionCard.vue";
import StatusPill from "@/components/workbench/StatusPill.vue";
import SummaryGrid from "@/components/workbench/SummaryGrid.vue";

const router = useRouter();
const tokenStore = useTokenStore();
const message = useMessage();

/**
 * 是占领情况还是分布情况
 */
const isOccupyOrDistribution = ref(false);
/**
 * 俱乐部战况还是个人战况
 */
const isLegionOrIndividual = ref(false);

// 处理change事件
const handleChange = function () {
  drawCanvasContent();
};

const legionWarMapDom = ref(null);
let ctx = null;
const dpr = window.devicePixelRatio || 1;
let resizeHandler = null;
const hexSize = 13.25;
const gap = 2.75;
const hexWidth = 2 * hexSize;
const hexHeight = Math.sqrt(3) * hexSize;
const arr = Array.from({ length: 41 }, () =>
  Array.from({ length: 41 }, () => 0));
// 记录左侧绘制后最大点
const leftMaxPoint = [0, 0];
const validData = ref(null);

const result = ref(null);

const {
  currentDateTime,
  getBattlefieldInfo,
  hint,
  isEntireBattlefield,
  legionWarWebSocket,
  sendMessageToLegion: sendLegionBroadcast,
  setupBattlefieldSocket,
} = useLegionWarActions({
  message,
  router,
  tokenStore,
  onBattlefieldData(rawData) {
    result.value = rawData;
    resizeAndRedraw(legionWarMapDom.value);
  },
});

const sendMessageToLegion = async () => {
  await sendLegionBroadcast(validData.value);
};

const connectionStatusText = computed(() => {
  return legionWarWebSocket.value?.status === "connected" ? "已连接" : "未连接";
});

const connectionStatus = computed(() => {
  return legionWarWebSocket.value?.status === "connected"
    ? "connected"
    : "disconnected";
});

const isConnected = computed(() => {
  return connectionStatus.value === "connected";
});

const battlefieldStatusText = computed(() =>
  isEntireBattlefield.value ? "已进入战场" : "等待进入战场",
);

const layoutModeLabel = computed(() =>
  isOccupyOrDistribution.value ? "分布布局" : "占领布局",
);

const perspectiveLabel = computed(() =>
  isLegionOrIndividual.value ? "个人战况" : "战队战况",
);

const battlefieldHintText = computed(() =>
  hint.value ? String(hint.value) : "待同步",
);

const battlefieldNodeCount = computed(() =>
  Object.keys(validData.value?.buildingData || {}).length,
);

const legionCount = computed(() =>
  Object.keys(validData.value?.legionInfo || {}).length,
);

const canBroadcastLegionStatus = computed(() =>
  Boolean(legionCount.value),
);

const legionHeroDescription = computed(() => {
  if (!isConnected.value) {
    return "当前正在等待 WebSocket 建立连接，连接完成后会自动进入战场并加载作战态势。";
  }

  if (!isEntireBattlefield.value) {
    return "连接已建立，正在等待进入战场。进入后即可拉取完整地图并查看俱乐部或个人战况。";
  }

  return `当前处于${layoutModeLabel.value} / ${perspectiveLabel.value}视图，可直接刷新战场数据并发送战队免费复活信息。`;
});

const controlHintText = computed(() => {
  if (!isEntireBattlefield.value) {
    return "进入战场前无法拉取地图数据。连接建立后会自动尝试进入当前战场。";
  }

  if (!canBroadcastLegionStatus.value) {
    return "请先拉取一次战场数据，成功读取俱乐部信息后才能发送免费复活汇总。";
  }

  return "当前数据已就绪，可以切换视图查看地图，并把各战队剩余免费复活次数发送到俱乐部频道。";
});

const summaryCards = computed(() => [
  {
    label: "连接状态",
    value: connectionStatusText.value,
    meta: isConnected.value ? "WebSocket 已建立" : "等待连接或重连",
  },
  {
    label: "战场编号",
    value: battlefieldHintText.value,
    meta: isEntireBattlefield.value ? "当前战场已同步" : "进入战场后刷新",
  },
  {
    label: "地图布局",
    value: layoutModeLabel.value,
    meta: "占领与分布视图切换",
  },
  {
    label: "战况视角",
    value: perspectiveLabel.value,
    meta: "战队与个人战况切换",
  },
  {
    label: "建筑节点",
    value: String(battlefieldNodeCount.value),
    meta: legionCount.value ? `已识别 ${legionCount.value} 个战队` : "等待战场数据",
  },
  {
    label: "当前时间",
    value: currentDateTime.value || "待同步",
    meta: "每次刷新战场后更新",
  },
]);

const drawHexagon = (x, y, color) => {
  ctx.beginPath();
  // 绘制6个顶点
  for (let i = 0; i < 6; i++) {
    const angle = ((2 * Math.PI) / 6) * i;
    const px = x + hexSize * Math.cos(angle);
    const py = y + hexSize * Math.sin(angle);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    if (px >= leftMaxPoint[0]) {
      leftMaxPoint[0] = px;
    }
    if (py >= leftMaxPoint[1]) {
      leftMaxPoint[1] = py;
    }
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.stroke();
};

/**
 * 绘制canvas内容
 */
const drawCanvasContent = (mouseX = 0, mouseY = 0, type = "") => {
  // 如果有坐标就传入坐标,没有就不传入坐标
  if (mouseX !== 0 && mouseY !== 0) {
    // 绘制左侧内容
    drawCanvasLeft(mouseX, mouseY, type);
  } else {
    // 绘制左侧内容
    drawCanvasLeft();
  }
  drawdivideLine();
  // 绘制右侧信息内容
  drawCanvasRight(validData.value);
};

// 绘制地图左侧内容
const drawCanvasLeft = (mouseX = 0, mouseY = 0, type = "") => {
  // 清空画布
  ctx.clearRect(0, 0, ctx.canvas.width / dpr, ctx.canvas.height / dpr);
  // 获取图结构的实例
  const graph = HexGraph.getInstance();
  // 删除所有结点
  graph.removeAllNode();
  // 提取result.value中的数据
  validData.value = extractValidData(
    result.value,
    isOccupyOrDistribution.value,
  );
  if (validData.value) {
    graph.addNodeList(
      Object.values(validData.value.buildingData).map((item) => {
        return {
          id: item.id,
          type: item.type,
          belongsLegionId: item.belongsLegionId,
          hP: item.hP,
          maxHP: item.maxHP,
          point: item.point,
          belongsLegionInfo: validData.value.legionInfo[item.belongsLegionId],
        };
      }),
    );
  }
  if (!validData.value) {
    return;
  }
  // 如果是占领布局
  if (!isOccupyOrDistribution.value) {
    // 处理地图连通
    const asc = true; // 是否升序
    Object.values(validData.value.legionInfo).forEach((element) => {
      const tempArr = Object.keys(element.buildings).sort((a, b) => {
        // 拆分key为两个数字（如"19_28" → [19, 28]）
        const [a1, a2] = a.split("_").map(Number);
        const [b1, b2] = b.split("_").map(Number);

        // 核心排序逻辑：先比第一个数字，再比第二个数字
        const compareFirst = a1 - b1;
        if (compareFirst !== 0) {
          return asc ? compareFirst : -compareFirst;
        }
        const compareSecond = a2 - b2;
        return asc ? compareSecond : -compareSecond;
      });

      // 此处填充两点之间路径颜色,可以采用单循环,但是会有些点不被填充颜色
      for (
        let buildingIndex = 0;
        buildingIndex < tempArr.length;
        buildingIndex++
      ) {
        for (
          let buildingIndexTemp = buildingIndex;
          buildingIndexTemp < tempArr.length;
          buildingIndexTemp++
        ) {
          const graphresult = graph.findShortestPath(
            tempArr[buildingIndex],
            tempArr[buildingIndexTemp],
            element.id,
          );
          if (graphresult) {
            graphresult.forEach((item) => {
              item.belongsLegionId = element.id;
              item.colorBg = element.color;
            });
          }
        }
      }
    });
  } else {
    // 如果是分布布局,将各个大本营的颜色设为对应俱乐部的背景色
    const legionList = Object.values(validData.value.legionInfo);
    for (let i = 0; i < legionList.length; i++) {
      const node = graph.getNodeByCoords(legionList[i].strongholdId);
      node.belongsLegionId = legionList[i].id;
      node.colorBg = legionList[i].color;
    }
  }

  // 获取所有结点
  const mergedArr = graph.getAllNodes();
  // 所有节点放入二维数组中
  mergedArr.forEach((item) => {
    const row = item.position.x;
    const col = item.position.y;
    // 如果是布局情况
    if (isOccupyOrDistribution.value && item.type != 4) {
      item.belongsLegionId = -1;
      item.colorBg = typeBg(9);
    }
    if (
      Number.parseInt(row) >= 0
      && Number.parseInt(row) < 41
      && Number.parseInt(col) >= 0
      && Number.parseInt(col) < 32
    ) {
      arr[Number.parseInt(col)][Number.parseInt(row)] = item; // 赋值
    } else {
      console.warn(`坐标[${row},${col}]越界，跳过赋值`);
    }
  });

  if (!isOccupyOrDistribution.value) {
    // 特殊处理核心周围的颜色
    arr[16][19].belongsLegionId = arr[17][20].belongsLegionId;
    arr[17][19].belongsLegionId = arr[17][20].belongsLegionId;
    arr[16][21].belongsLegionId = arr[17][20].belongsLegionId;
    arr[17][21].belongsLegionId = arr[17][20].belongsLegionId;
    arr[16][20].belongsLegionId = arr[17][20].belongsLegionId;
    arr[18][20].belongsLegionId = arr[17][20].belongsLegionId;
    arr[16][21].colorBg = arr[17][20].colorBg;
    arr[17][21].colorBg = arr[17][20].colorBg;
    arr[16][19].colorBg = arr[17][20].colorBg;
    arr[17][19].colorBg = arr[17][20].colorBg;
    arr[16][20].colorBg = arr[17][20].colorBg;
    arr[18][20].colorBg = arr[17][20].colorBg;
  }

  // 点击事件存储的临时对象
  let tempValue = {};
  // 用于记录最后绘制级内容的数组
  const drawPointArr = [];
  // 根据二位数组绘制内容
  for (let row = 0; row <= 31; row++) {
    for (let col = 0; col <= 40; col++) {
      if (row > 2 && arr[row][col] != 0) {
        // 计算中心坐标（处理错位）
        const x = col * (hexWidth * 0.75) + hexSize + gap * col;
        const y
          = row * hexHeight + (col % 2 === 1 ? hexHeight / 2 : 0) + gap * row;
        let colorTemp = arr[row][col].colorBg;

        if (mouseX !== 0 && mouseY !== 0) {
          // 简化碰撞检测：判断鼠标与中心的距离
          const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
          if (type === "mousemove") {
            colorTemp = distance < hexSize ? "#42b983" : colorTemp;
          } else if (type === "click" && distance < hexSize) {
            tempValue = arr[row][col];
          }
        }
        // 绘制六边形
        drawHexagon(x, y, colorTemp);

        if (arr[row][col].type != 9) {
          let name = arr[row][col].typeName.replace("据点", "");
          if (name == "大本营") {
            ctx.fillStyle = "#055138";
            name
              = validData.value.legionInfo[arr[row][col].belongsLegionId].name;
          }
          drawPointArr.push({
            x: x - 13,
            y: y + 4,
            name,
          });
        }
      }
    }
  }

  for (let i = 0; i < drawPointArr.length; i++) {
    ctx.fillStyle = "black";
    ctx.font = "bold 12px Microsoft Yahei";
    ctx.fillText(drawPointArr[i].name, drawPointArr[i].x, drawPointArr[i].y);
  }

  if (
    tempValue.type != 9
    && Object.keys(tempValue).length > 0
    && type === "click"
  ) {
    drawClickContent(mouseX, mouseY, tempValue);
  }
};

/**
 * 绘制分割线
 */
const drawdivideLine = () => {
  ctx.beginPath();
  ctx.moveTo(leftMaxPoint[0] + 10, leftMaxPoint[1]);
  ctx.lineTo(leftMaxPoint[0] + 10, 10);
  ctx.closePath();
  ctx.strokeStyle = "#000";
  ctx.stroke();
};
/**
 * 绘制Canvas右侧的内容
 * @param {*} tableData
 */
const drawCanvasRight = (tableData) => {
  if (tableData) {
    let tableConfig = {};
    if (!isLegionOrIndividual.value) {
      tableData = Object.values(tableData.legionInfo)
        .sort((a, b) => b.score - a.score)
        .map((item) => {
          return [
            item.name,
            item.killCnt,
            `${item.reviveCount}/150`,
            item.score,
            item.redCount,
            formatPower(item.power),
            `${item.participantsCount}/${item.memberCount}`,
            item.danCount,
            `${item.blessingCount}个共${item.blessingScore}分`,
            item.color,
          ];
        });
      tableConfig = {
        x: leftMaxPoint[0] + 20,
        y: 20,
        columns: 9, // 3列
        rows: 20, // 4行内容（不含表头）
        headerData: [
          "俱乐部名称",
          "击杀数",
          "免费复活",
          "积分",
          "红数",
          "战力",
          "人数",
          "花费总丹",
          "四圣",
        ], // 表头
        tableData: tableData || [],
        columnWidth: 78, // 单元格宽度（可根据内容调整）
        rowHeight: 37, // 单元格高度
        scale: 1,
      };
    } else {
      let tableDataTemp = [];
      Object.values(tableData.memberInfo).forEach((item) => {
        if (item.legionId == tokenStore.gameData?.roleInfo?.role.legionId) {
          tableDataTemp.push([
            item.name,
            item.kill,
            item.die,
            `${item.revive}/5`,
            item.score,
            item.digGround,
            item.dan,
            Number.parseFloat(item.kill / item.die).toFixed(2),
          ]);
        }
      });
      tableDataTemp = tableDataTemp.sort((a, b) => {
        return b[1] - a[1];
      });
      tableConfig = {
        x: leftMaxPoint[0] + 20,
        y: 20,
        columns: 8, // 3列
        rows: tableDataTemp ? tableDataTemp.length : 30, // 4行内容（不含表头）
        headerData: [
          "名称",
          "击杀数",
          "死亡次数",
          "已复活次数",
          "积分",
          "刨地",
          "复活丹",
          "K/D",
        ], // 表头
        tableData: tableDataTemp || [],
        columnWidth: 88, // 单元格宽度（可根据内容调整）
        rowHeight: 25, // 单元格高度
        scale: 1,
      };
    }
    drawTable(ctx, tableConfig);
  }
};

/**
 * 绘制表格
 * @param {*} ctx
 * @param {*} options
 * @param {*} options.x 表格的左上角x坐标
 * @param {*} options.y 表格的左上角y坐标
 * @param {*} options.columns 表格的列
 * @param {*} options.rows 表格的行
 * @param {*} options.headerData 表格的表头
 * @param {*} options.tableData 表格的内容
 * @param {*} options.columnWidth 单元格宽度
 * @param {*} options.rowHeight 单元格高度
 */
const drawTable = (ctx, options) => {
  // 默认配置（可自定义）
  const defaults = {
    columnWidth: 80,
    rowHeight: 25,
    headerBgColor: "#42b983",
    cellBgColor: "#ffffff",
    borderColor: "#333333",
    headerTextColor: "#ffffff",
    cellTextColor: "#373737",
    fontSize: 14,
    font: "Arial",
    scale: 1,
  };

  // 合并配置（用户传参覆盖默认）
  const config = { ...defaults, ...options };
  const {
    x,
    y,
    columns,
    rows,
    headerData,
    tableData,
    columnWidth,
    rowHeight,
    headerBgColor,
    cellBgColor,
    borderColor,
    headerTextColor,
    cellTextColor,
    fontSize,
    font,
    scale,
  } = config;
  // 计算缩放后的实际尺寸（适配画布缩放）
  const scaledColW = columnWidth * scale;
  const scaledRowH = rowHeight * scale;
  const scaledFontSize = fontSize * scale;
  const scaledLineWidth = 1 * scale; // 边框线宽

  ctx.save();
  // 1. 绘制表格外边框
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = scaledLineWidth;
  ctx.strokeRect(
    x, // 表格起始x（已适配分割线位置）
    y, // 表格起始y
    columns * scaledColW, // 表格总宽度
    (rows + 1) * scaledRowH, // 表格总高度（表头1行 + 内容rows行）
  );

  let currentX = x;
  const addColumnWidth = 20;
  const reduceColumnWidth = 20;
  // 2. 绘制表头（第1行）
  for (let col = 0; col < columns; col++) {
    ctx.fillStyle = headerBgColor;

    let currentColW = col === 0 ? scaledColW + addColumnWidth : scaledColW;
    currentColW = col === 1 ? scaledColW - reduceColumnWidth : currentColW;

    // 绘制表头单元格背景
    ctx.fillRect(currentX, y, currentColW, scaledRowH);
    // 绘制表头单元格边框
    ctx.strokeRect(currentX, y, currentColW, scaledRowH);
    // 绘制表头文字（居中）
    ctx.fillStyle = headerTextColor;
    ctx.font = `${scaledFontSize}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      headerData[col] || "",
      currentX + currentColW / 2,
      y + scaledRowH / 2,
    );

    currentX += currentColW;
  }

  // 3. 绘制内容行（第2行及以后）
  for (let row = 0; row < rows; row++) {
    currentX = x;
    for (let col = 0; col < columns; col++) {
      let currentColW = col === 0 ? scaledColW + addColumnWidth : scaledColW;
      currentColW = col === 1 ? scaledColW - reduceColumnWidth : currentColW;

      ctx.fillStyle = tableData[row]?.[9] || cellBgColor;
      // 计算当前单元格的坐标
      const cellX = currentX;
      const cellY = y + (row + 1) * scaledRowH;

      // 绘制内容单元格背景
      ctx.fillRect(cellX, cellY, currentColW, scaledRowH);
      // 绘制内容单元格边框
      ctx.strokeRect(cellX, cellY, currentColW, scaledRowH);
      // 绘制内容文字（居中）
      ctx.fillStyle = cellTextColor;
      ctx.font = `${scaledFontSize}px ${font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        tableData[row]?.[col] || "0",
        cellX + currentColW / 2,
        cellY + scaledRowH / 2,
      );
      currentX += currentColW;
    }
  }

  ctx.restore();
};

/**
 * 绘制点击事件内容
 * @param {number} mousex 鼠标原始x坐标（未缩放的坐标）
 * @param {number} mousey 鼠标原始y坐标（未缩放的坐标）
 * @param {string|object} value 展示内容（字符串/对象，对象自动转键值对）
 * @param {number} scale 画布缩放比例
 * @param {number} offsetX 画布x偏移
 * @param {number} offsetY 画布y偏移
 * @param {object} options 可选配置（可自定义样式）
 */
const drawClickContent = (
  mousex,
  mousey,
  value,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
  options = {},
) => {
  // 默认配置（可自定义）
  const config = {
    boxWidth: 200, // 信息框基础宽度（未缩放）
    boxPadding: 10, // 内边距（未缩放）
    bgColor: "rgba(0, 0, 0, 0.8)", // 背景色（半透明黑）
    borderColor: "#ffffff", // 边框色
    borderWidth: 1, // 边框宽度（未缩放）
    fontColor: "#ffffff", // 文字颜色
    fontSize: 14, // 字体大小（未缩放）
    font: "Arial", // 字体
    gap: 10, // 信息框与鼠标的间距（未缩放）
    ...options,
  };

  // 1. 处理value，转成可展示的文本（对象→键值对，字符串→原内容）
  let text = "";
  if (typeof value === "object" && value !== null) {
    text = Object.entries(value)
      .map(([key, val]) => `${key}: ${val}`)
      .join("\n");
    const item = value;
    text = `坐标:${item.id}\n血量:${item.hP}/${item.maxHP}\n类型:${item.typeName}\n分数:${item.point}\n所属俱乐部:${validData.value.legionInfo[item.belongsLegionId]?.name || "无所属"}`;
  } else {
    text = String(value || "无数据");
  }
  const textLines = text.split("\n"); // 按换行分割成数组

  // 2. 计算缩放后的实际尺寸（适配canvas缩放）
  const scaledBoxWidth = config.boxWidth * scale;
  const scaledPadding = config.boxPadding * scale;
  const scaledFontSize = config.fontSize * scale;
  const scaledBorderWidth = config.borderWidth * scale;
  const scaledGap = config.gap * scale;
  const lineHeight = scaledFontSize * 1.4; // 行高（1.4倍字体）
  const textTotalHeight = textLines.length * lineHeight; // 文本总高度
  const scaledBoxHeight = textTotalHeight + 2 * scaledPadding; // 信息框总高度

  // 3. 计算信息框的最终位置（适配缩放+偏移，防溢出）
  // 鼠标坐标转canvas实际坐标（应用缩放+偏移）
  const canvasX = mousex * scale + offsetX;
  const canvasY = mousey * scale + offsetY;

  // 信息框默认显示在鼠标右下方，避免溢出canvas边界
  let boxX = canvasX + scaledGap;
  let boxY = canvasY + scaledGap;
  const canvasWidth = ctx.canvas.width / dpr; // canvas可视宽度（去除dpr）
  const canvasHeight = ctx.canvas.height / dpr; // canvas可视高度（去除dpr）

  // 右边界溢出：信息框移到鼠标左侧
  if (boxX + scaledBoxWidth > leftMaxPoint[0] + 10) {
    boxX = canvasX - scaledBoxWidth - scaledGap;
  }
  // 下边界溢出：信息框移到鼠标上方
  if (boxY + scaledBoxHeight > leftMaxPoint[1] + 20) {
    boxY = canvasY - scaledBoxHeight - scaledGap;
  }
  // 左/上边界溢出：贴边显示
  boxX = Math.max(scaledBorderWidth, boxX);
  boxY = Math.max(scaledBorderWidth, boxY);

  // 4. 绘制信息框背景
  ctx.save(); // 保存上下文状态，避免影响其他绘制
  ctx.fillStyle = config.bgColor;
  ctx.fillRect(
    boxX - scaledBorderWidth,
    boxY - scaledBorderWidth,
    scaledBoxWidth + 2 * scaledBorderWidth,
    scaledBoxHeight + 2 * scaledBorderWidth,
  );

  // 5. 绘制信息框边框
  ctx.strokeStyle = config.borderColor;
  ctx.lineWidth = scaledBorderWidth;
  ctx.strokeRect(boxX, boxY, scaledBoxWidth, scaledBoxHeight);

  // 6. 绘制文本内容
  ctx.fillStyle = config.fontColor;
  ctx.font = `${scaledFontSize}px ${config.font}`;
  ctx.textBaseline = "top"; // 文本基线：顶部对齐
  textLines.forEach((line, index) => {
    ctx.fillText(
      line,
      boxX + scaledPadding, // 文本x坐标（加内边距）
      boxY + scaledPadding + index * lineHeight, // 文本y坐标（按行高偏移）
    );
  });

  ctx.restore(); // 恢复上下文状态
};

function resizeAndRedraw(canvas) {
  const container = canvas.parentElement;
  const w = container.clientWidth;
  const h = container.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  drawCanvasContent();
}

/**
 * 建立盐场连接请求与处理
 */
const fetchBattleRecords1 = async (getbattlefield) => {
  await setupBattlefieldSocket(getbattlefield);
};

onMounted(() => {
  fetchBattleRecords1();
  const canvas = legionWarMapDom.value;
  ctx = canvas.getContext("2d");

  resizeHandler = () => resizeAndRedraw(canvas);
  resizeHandler(); // 初始化
  // 增加鼠标移动事件
  // canvas.addEventListener('mousemove', (e) => {
  //   const rect = canvas.getBoundingClientRect();
  //   const mouseX = e.clientX - rect.left;
  //   const mouseY = e.clientY - rect.top;
  //   ctx.font="12px Arial";
  //   ctx.fillStyle = "rgb(0,0,0)";
  //   drawCanvasContent(mouseX,mouseY,'mousemove')
  // });
  // 增加点击事件
  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    ctx.font = "12px Arial";
    ctx.fillStyle = "rgb(0,0,0)";
    drawCanvasContent(mouseX, mouseY, "click");
  });
  window.addEventListener("resize", resizeHandler);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeHandler);
});
</script>

<style scoped lang="scss">
.legion-war-page__hero-toolbar {
  width: 100%;
}

.legion-war-page__map-card,
.legion-war-page__control-card {
  min-height: 100%;
}

.legion-war-page__map-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.legion-war-page__map-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.map-meta-chip {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(15, 107, 255, 0.12);
  background: rgba(15, 107, 255, 0.08);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.map-container {
  width: 100%;
  min-height: 62vh;
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid var(--surface-glass-border);
  background:
    linear-gradient(180deg, rgba(15, 107, 255, 0.06), transparent 10%),
    var(--surface-glass);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.mapCanvas {
  width: 100%;
  height: 100%;
  display: block;
}

.legion-war-page__control-stack {
  display: grid;
  gap: 14px;
}

.legion-war-page__toggle-card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  border: 1px solid var(--surface-glass-border);
  background:
    linear-gradient(135deg, rgba(15, 107, 255, 0.07), transparent 78%),
    var(--surface-glass);
}

.legion-war-page__toggle-copy {
  display: grid;
  gap: 6px;
}

.legion-war-page__toggle-copy strong {
  color: var(--text-primary);
  font-size: 15px;
}

.legion-war-page__toggle-copy p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.legion-war-page__toggle-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
}

.legion-war-page__action-list {
  display: grid;
  gap: 10px;
}

.legion-war-page__action {
  min-height: 44px;
}

.legion-war-page__note {
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid var(--surface-glass-border);
  background: rgba(15, 107, 255, 0.06);
  color: var(--text-secondary);
  line-height: 1.7;
}

.legion-war-page__note strong {
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .legion-war-page__map-toolbar,
  .legion-war-page__toggle-control {
    flex-direction: column;
    align-items: stretch;
  }

  .map-container {
    min-height: 50vh;
  }
}
</style>
