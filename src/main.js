import { bindAppShell } from './ui/app-shell.js';
import { initOnlineApp } from './online/online-app.js?v=20260902T015215899';

bindAppShell();
await initOnlineApp();
