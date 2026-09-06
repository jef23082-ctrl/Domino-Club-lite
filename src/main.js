import { bindAppShell } from './ui/app-shell.js?v=20260906T072753858';
import { initOnlineApp } from './online/online-app.js?v=20260906T072753858';

bindAppShell();
await initOnlineApp();
