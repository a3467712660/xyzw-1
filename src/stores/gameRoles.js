import { defineStore } from "pinia";
import { ref } from "vue";
import api from "@/api";
import { useLocalTokenStore } from "./localTokenManager";

export const useGameRolesStore = defineStore("gameRoles", () => {
  const gameRoles = ref([]);
  const isLoading = ref(false);
  const selectedRole = ref(null);

  const localTokenStore = useLocalTokenStore();

  const fetchGameRoles = async () => {
    try {
      isLoading.value = true;
      const res = await api.gameRoles.getList();
      if (!res.success) {
        return { success: false, message: res.message || "获取角色失败" };
      }

      gameRoles.value = Array.isArray(res.data) ? res.data : [];
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message || "获取角色失败" };
    } finally {
      isLoading.value = false;
    }
  };

  const addGameRole = async (roleData) => {
    try {
      isLoading.value = true;
      const res = await api.gameRoles.add(roleData);
      if (!res.success) {
        return { success: false, message: res.message || "添加角色失败" };
      }

      gameRoles.value.unshift(res.data);
      return { success: true, message: "添加角色成功" };
    } catch (error) {
      return { success: false, message: error.message || "添加角色失败" };
    } finally {
      isLoading.value = false;
    }
  };

  const updateGameRole = async (roleId, roleData) => {
    try {
      isLoading.value = true;
      const res = await api.gameRoles.update(roleId, roleData);
      if (!res.success) {
        return { success: false, message: res.message || "更新角色失败" };
      }

      const index = gameRoles.value.findIndex((role) => role.id === roleId);
      if (index !== -1) {
        gameRoles.value[index] = res.data;
      }

      if (selectedRole.value?.id === roleId) {
        selectedRole.value = res.data;
        localStorage.setItem("selectedRole", JSON.stringify(res.data));
      }

      return { success: true, message: "更新角色成功" };
    } catch (error) {
      return { success: false, message: error.message || "更新角色失败" };
    } finally {
      isLoading.value = false;
    }
  };

  const deleteGameRole = async (roleId) => {
    try {
      isLoading.value = true;
      const res = await api.gameRoles.delete(roleId);
      if (!res.success) {
        return { success: false, message: res.message || "删除角色失败" };
      }

      gameRoles.value = gameRoles.value.filter((role) => role.id !== roleId);
      localTokenStore.removeGameToken(roleId);

      if (selectedRole.value?.id === roleId) {
        selectedRole.value = null;
        localStorage.removeItem("selectedRole");
      }

      return { success: true, message: "删除角色成功" };
    } catch (error) {
      return { success: false, message: error.message || "删除角色失败" };
    } finally {
      isLoading.value = false;
    }
  };

  const selectRole = (role) => {
    selectedRole.value = role;
    if (role) {
      localStorage.setItem("selectedRole", JSON.stringify(role));
    }
  };

  const initGameRoles = () => {
    const cachedSelectedRole = localStorage.getItem("selectedRole");

    if (cachedSelectedRole) {
      try {
        selectedRole.value = JSON.parse(cachedSelectedRole);
      } catch {
        localStorage.removeItem("selectedRole");
      }
    }
  };

  return {
    gameRoles,
    isLoading,
    selectedRole,
    fetchGameRoles,
    addGameRole,
    updateGameRole,
    deleteGameRole,
    selectRole,
    initGameRoles,
  };
});
