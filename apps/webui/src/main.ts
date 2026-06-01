import { createApp } from "vue";
import { createPinia } from "pinia";
import AppShell from "./AppShell.vue";
import router from "./router";
import "./style.css";

const app = createApp(AppShell);
app.use(createPinia());
app.use(router);
app.mount("#app");
