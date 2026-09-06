import { bindAppShell } from './ui/app-shell.js?v=20260906T072017857';
import { initOnlineApp } from './online/online-app.js?v=20260906T072017857';

bindAppShell();
await initOnlineApp();
