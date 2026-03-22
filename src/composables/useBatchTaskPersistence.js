import { reactive, ref } from "vue";

export function useBatchTaskPersistence({
  message,
  addLog,
  addTaskSaveLog,
  validateCronExpression,
  calculateNextRuns,
  availableTasks,
  taskScheduleSelectedGroupIds,
  batchSettingsDefaults,
  sanitizeHelperPreferredLineups,
}) {
  const showBatchSettingsModal = ref(false);
  const batchSettings = reactive({ ...batchSettingsDefaults });

  const loadBatchSettings = () => {
    try {
      const saved = localStorage.getItem("batchSettings");
      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved);
      Object.assign(batchSettings, parsed);
      batchSettings.helperPreferredLineups = sanitizeHelperPreferredLineups(
        batchSettings.helperPreferredLineups,
      );
      batchSettings.helperLineupAnalysisEnabled
        = batchSettings.helperLineupAnalysisEnabled !== false;
    } catch (error) {
      console.error("Failed to load batch settings:", error);
    }
  };

  const saveBatchSettings = () => {
    try {
      localStorage.setItem("batchSettings", JSON.stringify(batchSettings));
      message.success("定时批量任务设置已保存");
      showBatchSettingsModal.value = false;
    } catch (error) {
      console.error("Failed to save batch settings:", error);
      message.error("保存设置失败");
    }
  };

  const openBatchSettings = () => {
    loadBatchSettings();
    showBatchSettingsModal.value = true;
  };

  const scheduledTasks = ref([]);
  const showTaskModal = ref(false);
  const showTasksModal = ref(false);
  const editingTask = ref(null);
  const taskForm = reactive({
    name: "",
    runType: "daily",
    runTime: null,
    cronExpression: "",
    selectedTokens: [],
    selectedTasks: [],
    enabled: true,
  });
  const cronValidation = ref({ valid: true, message: "" });
  const cronNextRuns = ref([]);

  const loadScheduledTasks = () => {
    try {
      const saved = localStorage.getItem("scheduledTasks");
      if (!saved) {
        scheduledTasks.value = [];
        return;
      }
      const parsed = JSON.parse(saved);
      scheduledTasks.value = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Failed to load scheduled tasks:", error);
      scheduledTasks.value = [];
    }
  };

  const saveScheduledTasks = () => {
    try {
      localStorage.setItem("scheduledTasks", JSON.stringify(scheduledTasks.value));
    } catch (error) {
      console.error("Failed to save scheduled tasks:", error);
    }
  };

  const resetTaskForm = () => {
    Object.assign(taskForm, {
      name: "",
      runType: "daily",
      runTime: undefined,
      cronExpression: "",
      selectedTokens: [],
      selectedTasks: [],
      enabled: true,
    });
    taskScheduleSelectedGroupIds.value = [];
  };

  const openTaskModal = () => {
    editingTask.value = null;
    resetTaskForm();
    showTaskModal.value = true;
  };

  const editTask = (task) => {
    editingTask.value = task;
    const taskData = { ...task };
    if (
      task.runType === "daily"
      && task.runTime
      && typeof task.runTime === "string"
    ) {
      const [hours, minutes] = task.runTime.split(":").map(Number);
      const now = new Date();
      taskData.runTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hours,
        minutes,
      );
    }
    Object.assign(taskForm, taskData);
    taskScheduleSelectedGroupIds.value = [];
    showTaskModal.value = true;
  };

  const parseCronExpression = (expression) => {
    const validation = validateCronExpression(expression);
    cronValidation.value = validation;

    if (!validation.valid) {
      cronNextRuns.value = [];
      return;
    }

    const cronParts = expression.split(" ").filter(Boolean);
    const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField]
      = cronParts;

    cronNextRuns.value = calculateNextRuns(
      minuteField,
      hourField,
      dayOfMonthField,
      monthField,
      dayOfWeekField,
      5,
    );
  };

  const saveTask = () => {
    if (!taskForm.name) {
      message.warning("请输入任务名称");
      return false;
    }
    if (taskForm.runType === "daily" && !taskForm.runTime) {
      message.warning("请选择运行时间");
      return false;
    }
    if (taskForm.runType === "cron") {
      if (!taskForm.cronExpression) {
        message.warning("请输入Cron表达式");
        return false;
      }
      const validation = validateCronExpression(taskForm.cronExpression);
      if (!validation.valid) {
        message.warning(validation.message);
        return false;
      }
    }
    if (taskForm.selectedTokens.length === 0) {
      message.warning("请选择至少一个账号");
      return false;
    }
    if (taskForm.selectedTasks.length === 0) {
      message.warning("请选择至少一个任务");
      return false;
    }

    let formattedRunTime = null;
    if (taskForm.runType === "daily" && taskForm.runTime) {
      const time = new Date(taskForm.runTime);
      formattedRunTime = time.toLocaleTimeString("zh-CN", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const taskData = {
      id: editingTask.value?.id || `task_${Date.now()}`,
      name: taskForm.name,
      runType: taskForm.runType,
      runTime: formattedRunTime,
      cronExpression:
        taskForm.runType === "cron" ? taskForm.cronExpression : "",
      selectedTokens: [...taskForm.selectedTokens],
      selectedTasks: [...taskForm.selectedTasks],
      enabled: taskForm.enabled,
    };

    const isNew = !editingTask.value;
    if (editingTask.value) {
      const index = scheduledTasks.value.findIndex(
        (task) => task.id === editingTask.value.id,
      );
      if (index !== -1) {
        scheduledTasks.value[index] = taskData;
      }
    } else {
      scheduledTasks.value.push(taskData);
    }

    saveScheduledTasks();
    addTaskSaveLog(taskData, isNew, addLog);
    showTaskModal.value = false;
    message.success("定时任务已保存");
    return true;
  };

  const deleteTask = (taskId) => {
    const task = scheduledTasks.value.find((item) => item.id === taskId);
    if (!task) {
      return;
    }
    scheduledTasks.value = scheduledTasks.value.filter((item) => item.id !== taskId);
    saveScheduledTasks();
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `=== 定时任务 ${task.name} 已删除 ===`,
      type: "info",
    });
    message.success("定时任务已删除");
  };

  const toggleTaskEnabled = (taskId, enabled) => {
    const task = scheduledTasks.value.find((item) => item.id === taskId);
    if (!task) {
      return;
    }
    task.enabled = enabled;
    saveScheduledTasks();
    message.success(`定时任务已${enabled ? "启用" : "禁用"}`);
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `=== 定时任务 ${task.name} 已${enabled ? "启用" : "禁用"} ===`,
      type: "info",
    });
  };

  const selectAllTasks = () => {
    taskForm.selectedTasks = availableTasks.map((task) => task.value);
  };

  const deselectAllTasks = () => {
    taskForm.selectedTasks = [];
  };

  loadBatchSettings();
  loadScheduledTasks();

  return {
    batchSettings,
    cronNextRuns,
    cronValidation,
    deleteTask,
    deselectAllTasks,
    editTask,
    editingTask,
    loadBatchSettings,
    loadScheduledTasks,
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
  };
}
