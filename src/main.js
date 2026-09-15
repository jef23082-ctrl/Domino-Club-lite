import { bindAppShell } from './ui/app-shell.js?v=20260915T095227534';
import { initOnlineApp } from './online/online-app.js?v=20260915T095227534';

bindAppShell();
await initOnlineApp();
