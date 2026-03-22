import { withRouteMeta } from "../meta";

export const adminTestChildRoutes = [
  {
    path: "message-test",
    name: "MessageTest",
    component: () => import("@/components/Test/MessageTester.vue"),
    meta: withRouteMeta({
      title: "消息测试",
      requiresAuth: true,
      requiresAdmin: true,
      layout: "default",
      hidden: true,
    }),
  },
  {
    path: "/websocket-test",
    name: "WebSocketTest",
    component: () => import("@/components/Test/WebSocketTester.vue"),
    meta: withRouteMeta({
      title: "WebSocket测试",
      requiresAuth: true,
      requiresAdmin: true,
      layout: "default",
      hidden: true,
    }),
  },
];

export const testRoutes = [];
