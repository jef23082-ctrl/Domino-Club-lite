import { bindAppShell } from './ui/app-shell.js';
import { initOnlineApp } from './online/online-app.js?v=20260903T071755351';

bindAppShell();
await initOnlineApp();
