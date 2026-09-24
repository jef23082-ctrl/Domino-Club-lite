import { bindAppShell } from './ui/app-shell.js?v=20260924T185554830';
import { initOnlineApp } from './online/online-app.js?v=20260924T185554830';

bindAppShell();
await initOnlineApp();
