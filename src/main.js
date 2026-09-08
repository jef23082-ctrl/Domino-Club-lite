import { bindAppShell } from './ui/app-shell.js?v=20260908T233254904';
import { initOnlineApp } from './online/online-app.js?v=20260908T233254904';

bindAppShell();
await initOnlineApp();
