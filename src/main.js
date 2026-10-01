import { bindAppShell } from './ui/app-shell.js?v=20261001T025219457';
import { initOnlineApp } from './online/online-app.js?v=20261001T025219457';

bindAppShell();
await initOnlineApp();
