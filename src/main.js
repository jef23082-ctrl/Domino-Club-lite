import { bindAppShell } from './ui/app-shell.js?v=20260922T161100427';
import { initOnlineApp } from './online/online-app.js?v=20260922T161100427';

bindAppShell();
await initOnlineApp();
