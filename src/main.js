import { bindAppShell } from './ui/app-shell.js?v=20261001T003934265';
import { initOnlineApp } from './online/online-app.js?v=20261001T003934265';

bindAppShell();
await initOnlineApp();
