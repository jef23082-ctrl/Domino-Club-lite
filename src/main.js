import { bindAppShell } from './ui/app-shell.js?v=20260929T190638113';
import { initOnlineApp } from './online/online-app.js?v=20260929T190638113';

bindAppShell();
await initOnlineApp();
