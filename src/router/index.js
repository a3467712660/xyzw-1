import { createRouter, createWebHistory } from "vue-router";
import { adminRoutes } from "./modules/admin.routes";
import { publicRoutes } from "./modules/public.routes";
import { userRoutes } from "./modules/user.routes";

const routes = [
  ...publicRoutes,
  ...userRoutes,
  ...adminRoutes,
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition)
      return savedPosition;
    return { top: 0 };
  },
});

export default router;
