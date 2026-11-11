import { bindAppShell } from './ui/app-shell.js?v=58-r14';
import { initOnlineApp } from './online/online-app.js?v=58-r14';

bindAppShell();
await initOnlineApp();
