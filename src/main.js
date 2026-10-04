import { bindAppShell } from './ui/app-shell.js?v=20261004T170705413';
import { initOnlineApp } from './online/online-app.js?v=20261004T170705413';

bindAppShell();
await initOnlineApp();
