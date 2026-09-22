import { bindAppShell } from './ui/app-shell.js?v=20260922T005918368';
import { initOnlineApp } from './online/online-app.js?v=20260922T005918368';

bindAppShell();
await initOnlineApp();
