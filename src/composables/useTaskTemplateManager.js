import { computed, reactive, ref } from "vue";

function createDefaultTemplate() {
  return {
    arenaFormation: 1,
    towerFormation: 1,
    bossFormation: 1,
    bossTimes: 2,
    claimBottle: true,
    payRecruit: true,
    openBox: true,
    arenaEnable: true,
    claimHangUp: true,
    claimEmail: true,
    blackMarketPurchase: true,
  };
}

export function useTaskTemplateManager({ message, sortedTokens }) {
  const showTaskTemplateModal = ref(false);
  const showApplyTemplateModal = ref(false);
  const showTemplateManagerModal = ref(false);
  const showAccountTemplateModal = ref(false);
  const taskTemplates = ref([]);
  const selectedTemplateId = ref(null);
  const selectedTokensForApply = ref([]);
  const currentTemplateName = ref("");
  const currentTemplateId = ref(null);
  const currentTemplate = reactive(createDefaultTemplate());
  const accountTemplateReferences = ref([]);
  const filteredAccountTemplates = ref([]);
  const selectedTemplateForFilter = ref(null);

  const isAllSelectedForApply = computed(() => {
    return (
      selectedTokensForApply.value.length === sortedTokens.value.length
      && sortedTokens.value.length > 0
    );
  });

  const isIndeterminateForApply = computed(() => {
    return (
      selectedTokensForApply.value.length > 0
      && selectedTokensForApply.value.length < sortedTokens.value.length
    );
  });

  const filteredTaskTemplates = computed(() => {
    return taskTemplates.value;
  });

  const resetTemplateForm = () => {
    currentTemplateId.value = null;
    currentTemplateName.value = "";
    Object.assign(currentTemplate, createDefaultTemplate());
  };

  const loadTaskTemplates = () => {
    const templates = localStorage.getItem("task-templates");
    const parsed = templates ? JSON.parse(templates) : [];
    taskTemplates.value = parsed;
    return parsed;
  };

  const openTaskTemplateModal = () => {
    loadTaskTemplates();
    resetTemplateForm();
    showTaskTemplateModal.value = true;
  };

  const openApplyTemplateModal = () => {
    loadTaskTemplates();
    selectedTemplateId.value = null;
    selectedTokensForApply.value = [];
    showApplyTemplateModal.value = true;
  };

  const handleSelectAllForApply = (checked) => {
    if (checked) {
      selectedTokensForApply.value = sortedTokens.value.map((token) => token.id);
    } else {
      selectedTokensForApply.value = [];
    }
  };

  const applyTemplate = () => {
    if (!selectedTemplateId.value || selectedTokensForApply.value.length === 0) {
      message.error("请选择模板和要应用的账号");
      return;
    }

    const templates = loadTaskTemplates();
    const template = templates.find((item) => item.id === selectedTemplateId.value);
    if (!template) {
      message.error("模板不存在");
      return;
    }

    let successCount = 0;
    selectedTokensForApply.value.forEach((tokenId) => {
      const accountSettings = {
        ...template.settings,
        templateId: template.id,
      };
      localStorage.setItem(
        `daily-settings:${tokenId}`,
        JSON.stringify(accountSettings),
      );
      successCount++;
    });

    message.success(`已成功应用模板到 ${successCount} 个账号`);
    showApplyTemplateModal.value = false;
  };

  const openTemplateManagerModal = () => {
    loadTaskTemplates();
    showTemplateManagerModal.value = true;
  };

  const openEditTemplateModal = (template) => {
    currentTemplateId.value = template.id;
    currentTemplateName.value = template.name;
    Object.assign(currentTemplate, createDefaultTemplate(), template.settings);
    showTaskTemplateModal.value = true;
  };

  const updateTaskTemplate = () => {
    if (!currentTemplateName.value.trim()) {
      message.error("请输入模板名称");
      return;
    }

    const templates = loadTaskTemplates();
    const templateIndex = templates.findIndex(
      (item) => item.id === currentTemplateId.value,
    );
    if (templateIndex === -1) {
      message.error("模板不存在");
      return;
    }

    templates[templateIndex] = {
      ...templates[templateIndex],
      name: currentTemplateName.value.trim(),
      settings: {
        ...currentTemplate,
      },
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem("task-templates", JSON.stringify(templates));
    taskTemplates.value = templates;

    message.success(`已更新模板 "${templates[templateIndex].name}"`);
    showTaskTemplateModal.value = false;
    resetTemplateForm();
  };

  const deleteTaskTemplate = (templateId) => {
    if (confirm("确定要删除这个模板吗？")) {
      const templates = loadTaskTemplates();
      const filteredTemplates = templates.filter((item) => item.id !== templateId);
      localStorage.setItem("task-templates", JSON.stringify(filteredTemplates));
      taskTemplates.value = filteredTemplates;
      message.success("模板已删除");
    }
  };

  const loadAccountTemplateReferences = () => {
    const templates = loadTaskTemplates();
    const references = [];

    sortedTokens.value.forEach((token) => {
      const settingsStr = localStorage.getItem(`daily-settings:${token.id}`);
      if (settingsStr) {
        try {
          const settings = JSON.parse(settingsStr);
          const templateId = settings.templateId;
          const template = templates.find((item) => item.id === templateId);

          references.push({
            tokenId: token.id,
            tokenName: token.name,
            templateId,
            templateName: template ? template.name : "未引用模板",
          });
        } catch (error) {
          console.error(`解析账号 ${token.name} 的设置失败:`, error);
        }
      } else {
        references.push({
          tokenId: token.id,
          tokenName: token.name,
          templateId: null,
          templateName: "未引用模板",
        });
      }
    });

    accountTemplateReferences.value = references;
    filteredAccountTemplates.value = references;
  };

  const openAccountTemplateModal = () => {
    loadAccountTemplateReferences();
    showAccountTemplateModal.value = true;
  };

  const filterAccountTemplates = () => {
    if (!selectedTemplateForFilter.value) {
      filteredAccountTemplates.value = accountTemplateReferences.value;
    } else {
      filteredAccountTemplates.value = accountTemplateReferences.value.filter(
        (item) => item.templateId === selectedTemplateForFilter.value,
      );
    }
  };

  const openNewTemplateModal = () => {
    resetTemplateForm();
    showTaskTemplateModal.value = true;
  };

  const saveTaskTemplate = () => {
    if (!currentTemplateName.value.trim()) {
      message.error("请输入模板名称");
      return;
    }

    if (currentTemplateId.value) {
      updateTaskTemplate();
      return;
    }

    const templates = loadTaskTemplates();
    const template = {
      id: Date.now().toString(),
      name: currentTemplateName.value.trim(),
      settings: {
        ...currentTemplate,
      },
      createdAt: new Date().toISOString(),
    };

    templates.push(template);
    localStorage.setItem("task-templates", JSON.stringify(templates));
    taskTemplates.value = templates;

    message.success(`已保存模板 "${template.name}"`);
    showTaskTemplateModal.value = false;
    resetTemplateForm();
  };

  return {
    accountTemplateReferences,
    applyTemplate,
    currentTemplate,
    currentTemplateId,
    currentTemplateName,
    deleteTaskTemplate,
    filteredAccountTemplates,
    filteredTaskTemplates,
    filterAccountTemplates,
    handleSelectAllForApply,
    isAllSelectedForApply,
    isIndeterminateForApply,
    loadAccountTemplateReferences,
    loadTaskTemplates,
    openAccountTemplateModal,
    openApplyTemplateModal,
    openEditTemplateModal,
    openNewTemplateModal,
    openTaskTemplateModal,
    openTemplateManagerModal,
    resetTemplateForm,
    saveTaskTemplate,
    selectedTemplateForFilter,
    selectedTemplateId,
    selectedTokensForApply,
    showAccountTemplateModal,
    showApplyTemplateModal,
    showTaskTemplateModal,
    showTemplateManagerModal,
    taskTemplates,
    updateTaskTemplate,
  };
}
