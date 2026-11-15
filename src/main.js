import { bindAppShell } from './ui/app-shell.js?v=58-r14';
import { initOnlineApp } from './online/online-app.js?v=59-r2';

bindAppShell();
await initOnlineApp();
