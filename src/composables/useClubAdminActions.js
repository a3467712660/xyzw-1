export function useClubAdminActions({
  applyList,
  batchLoading,
  dialog,
  getHeroInfo,
  getLineupType,
  loadingApply,
  members,
  message,
  refreshClub,
  showApplyList,
  tokenStore,
}) {
  const kickMember = (roleId, name) => {
    const token = tokenStore.selectedToken;
    if (!token)
      return;

    dialog.warning({
      title: "确认踢出",
      content: `确定要踢出成员 ${name} ID: ${roleId} 吗？`,
      positiveText: "确定",
      negativeText: "取消",
      onPositiveClick: () => {
        tokenStore.sendMessage(token.id, "legion_kickout", {
          roleId: Number(roleId),
        });

        if (tokenStore.gameData?.legionInfo?.info?.members) {
          delete tokenStore.gameData.legionInfo.info.members[roleId];
          setTimeout(() => {
            refreshClub();
          }, 1000);
        }

        message.info(`正在踢出成员 ID: ${roleId}`);
      },
    });
  };

  const handleApplyListResp = (session) => {
    const responseBody = session.body;
    if (!responseBody) {
      applyList.value = [];
      loadingApply.value = false;
      message.info("暂无申请");
      return;
    }

    if (Object.keys(responseBody).length === 0) {
      applyList.value = [];
      loadingApply.value = false;
      message.info("暂无申请");
      return;
    }

    if (typeof responseBody === "object") {
      if (Array.isArray(responseBody.roleList)) {
        const validRoles = responseBody.roleList.filter(
          (role) => role.roleId && role.name,
        );
        applyList.value = validRoles.map((role) => ({
          headImg: role.headImg,
          level: role.level,
          name: role.name,
          power: role.power,
          roleId: role.roleId,
          serverId: role.ext?.server_id || "",
          applyReason: role.ext?.legion_apply_reason || "",
        }));
        loadingApply.value = false;
        message.success(`获取到 ${validRoles.length} 个申请`);
        return;
      }

      if (
        Array.isArray(responseBody.applyList)
        || Array.isArray(responseBody.list)
        || Array.isArray(responseBody.data)
      ) {
        const applyArray
          = responseBody.applyList || responseBody.list || responseBody.data;
        applyList.value = applyArray
          .filter((apply) => apply.roleId && apply.name)
          .map((apply) => ({
            ...apply,
            serverId: apply.ext?.server_id || "",
            applyReason: apply.ext?.legion_apply_reason || "",
          }));
        loadingApply.value = false;
        message.success(`获取到 ${applyList.value.length} 个申请`);
        return;
      }
    }

    if (Array.isArray(responseBody)) {
      applyList.value = responseBody
        .filter((apply) => apply.roleId && apply.name)
        .map((apply) => ({
          ...apply,
          serverId: apply.ext?.server_id || "",
          applyReason: apply.ext?.legion_apply_reason || "",
        }));
      loadingApply.value = false;
      message.success(`获取到 ${applyList.value.length} 个申请`);
      return;
    }

    applyList.value = [];
    loadingApply.value = false;
    message.info("暂无申请");
  };

  const getApplyList = async () => {
    const token = tokenStore.selectedToken;
    if (!token)
      return;

    showApplyList.value = true;
    loadingApply.value = true;
    applyList.value = [];

    try {
      message.info("正在获取申请列表");
      const responseBody = await tokenStore.sendMessageWithPromise(
        token.id,
        "legion_applylist",
        {},
        10000,
      );
      handleApplyListResp({ body: responseBody });
    } catch (error) {
      loadingApply.value = false;
      message.error(`获取申请列表失败: ${error.message || "未知错误"}`);
      console.error("获取申请列表出错:", error);
    }
  };

  const approveApply = (roleId) => {
    const token = tokenStore.selectedToken;
    if (!token)
      return;

    tokenStore.sendMessage(token.id, "legion_agree", {
      roleId: Number(roleId),
    });
    applyList.value = applyList.value.filter((apply) => apply.roleId !== roleId);
    message.info(`已通过成员 ID: ${roleId} 的申请`);

    setTimeout(() => {
      refreshClub();
    }, 1000);
  };

  const rejectApply = (roleId) => {
    const token = tokenStore.selectedToken;
    if (!token)
      return;

    tokenStore.sendMessage(token.id, "legion_ignore", {
      roleId: Number(roleId),
    });
    applyList.value = applyList.value.filter((apply) => apply.roleId !== roleId);
    message.info(`已拒绝成员 ID: ${roleId} 的申请`);
  };

  const approveAll = () => {
    const token = tokenStore.selectedToken;
    if (!token)
      return;

    const count = applyList.value.length;
    if (count === 0)
      return;

    applyList.value.forEach((apply) => {
      tokenStore.sendMessage(token.id, "legion_agree", {
        roleId: Number(apply.roleId),
      });
    });

    applyList.value = [];
    message.success(`已通过所有 ${count} 个申请`);

    setTimeout(() => {
      refreshClub();
    }, 1000);
  };

  const rejectAll = () => {
    const token = tokenStore.selectedToken;
    if (!token)
      return;

    const count = applyList.value.length;
    if (count === 0)
      return;

    applyList.value.forEach((apply) => {
      tokenStore.sendMessage(token.id, "legion_ignore", {
        roleId: Number(apply.roleId),
      });
    });

    applyList.value = [];
    message.success(`已拒绝所有 ${count} 个申请`);
  };

  const fetchAllMembersLineup = async () => {
    if (batchLoading.value)
      return;

    const token = tokenStore.selectedToken;
    if (!token)
      return;

    const wsStatus = tokenStore.getWebSocketStatus(token.id);
    if (wsStatus !== "connected") {
      message.error("WebSocket未连接，无法获取阵容信息");
      return;
    }

    const memberList = members.value;
    if (!memberList.length)
      return;

    batchLoading.value = true;
    message.loading("正在获取成员阵容信息...");

    const memberIds = memberList.map((member) => member.roleId);
    const chunkSize = 5;

    try {
      for (let i = 0; i < memberIds.length; i += chunkSize) {
        const chunk = memberIds.slice(i, i + chunkSize);
        const promises = chunk.map(async (roleId) => {
          try {
            const roleRes = await tokenStore.sendMessageWithPromise(
              token.id,
              "rank_getroleinfo",
              {
                roleId: Number(roleId),
                includeBottleTeam: false,
                isSearch: false,
                bottleType: 0,
                includeHero: true,
                includeHeroDetail: true,
                includePearl: true,
              },
              5000,
            );

            if (roleRes?.roleInfo) {
              let heroList = [];
              if (roleRes.roleInfo.heroes) {
                heroList = getHeroInfo(roleRes.roleInfo.heroes).heroList;
              }

              const lineupType = getLineupType(heroList);
              if (
                tokenStore.gameData?.legionInfo?.info?.members
                && tokenStore.gameData.legionInfo.info.members[roleId]
              ) {
                tokenStore.gameData.legionInfo.info.members[roleId].lineupType =
                  lineupType;
              }
            }
          } catch (error) {
            console.error(`Failed to fetch info for ${roleId}`, error);
          }
        });

        await Promise.all(promises);
      }
      message.success("阵容信息获取完成");
    } catch (error) {
      message.error(`获取失败: ${error.message}`);
    } finally {
      batchLoading.value = false;
    }
  };

  return {
    approveAll,
    approveApply,
    fetchAllMembersLineup,
    getApplyList,
    handleApplyListResp,
    kickMember,
    rejectAll,
    rejectApply,
  };
}
