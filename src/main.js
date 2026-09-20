import { bindAppShell } from './ui/app-shell.js?v=20260920T151452528';
import { initOnlineApp } from './online/online-app.js?v=20260920T151452528';

bindAppShell();
await initOnlineApp();
