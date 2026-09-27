import { bindAppShell } from './ui/app-shell.js?v=20260927T021825018';
import { initOnlineApp } from './online/online-app.js?v=20260927T021825018';

bindAppShell();
await initOnlineApp();
