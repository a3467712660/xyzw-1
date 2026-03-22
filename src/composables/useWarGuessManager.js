import { ref } from "vue";

export function useWarGuessManager({
  addLog,
  batchWarGuessCheer,
  h,
  isRunning,
  message,
  selectedTokens,
  tokenStore,
  tokens,
}) {
  const showWarGuessModal = ref(false);
  const warGuessList = ref([]);
  const warGuessLoading = ref(false);
  const warGuessCoin = ref(20);
  const selectedWarGuessLegionId = ref(null);
  const currentGuessCount = ref(0);

  const formatPower = (power) => {
    if (!power) {
      return "0";
    }
    if (power >= 100000000) {
      return `${(power / 100000000).toFixed(2)}亿`;
    }
    if (power >= 10000) {
      return `${(power / 10000).toFixed(2)}万`;
    }
    return power.toString();
  };

  const warGuessColumns = [
    {
      type: "selection",
      multiple: false,
    },
    { title: "ID", key: "id", width: 100 },
    {
      title: "头像",
      key: "logo",
      render(row) {
        return h("img", {
          src: row.logo,
          style: { width: "30px", height: "30px", borderRadius: "50%" },
        });
      },
      width: 60,
    },
    { title: "区服", key: "serverId", width: 80 },
    { title: "俱乐部", key: "name", width: 120 },
    {
      title: "战力",
      key: "power",
      render(row) {
        return formatPower(row.power);
      },
      width: 100,
    },
    { title: "红淬", key: "quenchNum" },
    { title: "已助威", key: "guessNum" },
    {
      title: "总热度",
      key: "totalNum",
      render(row) {
        return formatPower(row.totalNum || 0);
      },
      width: 100,
    },
  ];

  const warGuessRowProps = (row) => {
    return {
      style: "cursor: pointer",
      onClick: () => {
        selectedWarGuessLegionId.value = row.id;
      },
    };
  };

  const fetchWarGuessRank = async () => {
    if (selectedTokens.value.length === 0) {
      message.warning("请先选择一个账号用于获取月赛助威数据");
      return;
    }

    const tokenId = selectedTokens.value[0];
    const token = tokens.value.find((item) => item.id === tokenId);

    warGuessLoading.value = true;
    try {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `正在使用 ${token.name} 获取月赛助威数据...`,
        type: "info",
      });

      const status = tokenStore.getWebSocketStatus(tokenId);
      if (status !== "connected") {
        tokenStore.createWebSocketConnection(tokenId, token.token, token.wsUrl);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const response = await tokenStore.sendMessageWithPromise(
        tokenId,
        "warguess_getrank",
        { bfId: "" },
        5000,
      );

      if (response && response.list) {
        let list = [];
        if (Array.isArray(response.list)) {
          list = response.list;
        } else {
          list = Object.values(response.list);
        }

        warGuessList.value = list
          .sort((a, b) => (b.totalNum || 0) - (a.totalNum || 0))
          .slice(0, 20);
      } else {
        message.warning("获取月赛助威数据为空");
      }
    } catch (error) {
      console.error("Fetch rank error:", error);
      message.error(`获取月赛助威数据失败: ${error.message}`);
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `获取月赛助威数据失败: ${error.message}`,
        type: "error",
      });
    } finally {
      warGuessLoading.value = false;
    }
  };

  const openWarGuessModal = () => {
    showWarGuessModal.value = true;
    selectedWarGuessLegionId.value = null;
    warGuessList.value = [];

    if (selectedTokens.value.length > 0) {
      fetchWarGuessRank();
    }
  };

  const handleWarGuessCheer = async () => {
    if (!selectedWarGuessLegionId.value) {
      message.warning("请先选择一个俱乐部");
      return;
    }
    showWarGuessModal.value = false;
    await batchWarGuessCheer(selectedWarGuessLegionId.value, warGuessCoin.value);
  };

  return {
    currentGuessCount,
    fetchWarGuessRank,
    handleWarGuessCheer,
    isRunning,
    openWarGuessModal,
    selectedWarGuessLegionId,
    showWarGuessModal,
    warGuessCoin,
    warGuessColumns,
    warGuessList,
    warGuessLoading,
    warGuessRowProps,
  };
}
