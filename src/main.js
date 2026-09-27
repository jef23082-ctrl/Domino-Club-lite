import { bindAppShell } from './ui/app-shell.js?v=20260927T015033192';
import { initOnlineApp } from './online/online-app.js?v=20260927T015033192';

bindAppShell();
await initOnlineApp();
