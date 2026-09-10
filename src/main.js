import { bindAppShell } from './ui/app-shell.js?v=20260910T004553338';
import { initOnlineApp } from './online/online-app.js?v=20260910T004553338';

bindAppShell();
await initOnlineApp();
