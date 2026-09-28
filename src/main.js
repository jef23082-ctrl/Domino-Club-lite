import { bindAppShell } from './ui/app-shell.js?v=20260928T204111961';
import { initOnlineApp } from './online/online-app.js?v=20260928T204111961';

bindAppShell();
await initOnlineApp();
