import {
  Megaphone,
  Settings,
} from "@vicons/ionicons5";

export const createSupportMenuOptions = (renderIcon) => [
  { label: "个人设置", key: "/admin/profile", icon: renderIcon(Settings) },
  { label: "功能反馈", key: "/admin/feedback", icon: renderIcon(Megaphone) },
];

export const createUserMenuOptions = () => [
  {
    label: "个人设置",
    key: "profile",
  },
  {
    label: "退出账号",
    key: "logout-account",
  },
  {
    label: "仅清除当前账号Token",
    key: "clear-tokens",
  },
];
