import { bindAppShell } from './ui/app-shell.js?v=20260930T205039435';
import { initOnlineApp } from './online/online-app.js?v=20260930T205039435';

bindAppShell();
await initOnlineApp();
