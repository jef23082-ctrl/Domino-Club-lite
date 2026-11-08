import { bindAppShell } from './ui/app-shell.js?v=20261005T162819119';
import { initOnlineApp } from './online/online-app.js?v=58-noel';

bindAppShell();
await initOnlineApp();
