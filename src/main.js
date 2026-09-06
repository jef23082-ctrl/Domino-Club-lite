import { bindAppShell } from './ui/app-shell.js?v=20260906T181957527';
import { initOnlineApp } from './online/online-app.js?v=20260906T181957527';

bindAppShell();
await initOnlineApp();
