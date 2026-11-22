import { tableLines } from './table-lines.js';
import { statsLines } from './stats-lines.js';

function readEntries(source, type) {
  let group = '';
  return source.trim().split('\n').filter(Boolean).flatMap(line => {
    if (line.startsWith('# ')) {
      group = line.slice(2);
      return [];
    }
    const [id, title, trigger, ...lines] = line.split('|');
    return [{ id: Number(id), type, group, title, trigger, lines }];
  });
}

export const entries = [...readEntries(tableLines, 'table'), ...readEntries(statsLines, 'stats')];
export const entriesById = new Map(entries.map(entry => [entry.id, entry]));

export function renderLine(template, { name, rival, other, values = {} }) {
  const replacements = { joueur: name, rival, autre: other, ...values };
  return template.replace(/@|\{([\w-]+)\}/g, (token, key) => replacements[key ?? 'joueur'] ?? '');
}

export function createSpeaker(emit, now = Date.now, random = Math.random) {
  const recentlyHeard = [];
  const lastById = new Map();
  let lastSpokenAt = -Infinity;
  return function speak(id, names, { priority = 1, preview = false } = {}) {
    const entry = entriesById.get(id);
    const at = now();
    if (!entry || !names.name) return false;
    if (!preview && (at - lastSpokenAt < (priority >= 3 ? 4500 : 23000) || at - (lastById.get(id) ?? -Infinity) < 90000)) return false;

    const unused = entry.lines.filter(line => !recentlyHeard.includes(line));
    const template = unused.length ? unused[Math.floor(random() * unused.length)]
      : recentlyHeard.find(line => entry.lines.includes(line));
    const index = recentlyHeard.indexOf(template);
    if (index >= 0) recentlyHeard.splice(index, 1);
    recentlyHeard.push(template);
    if (recentlyHeard.length > 32) recentlyHeard.shift();
    lastSpokenAt = at;
    if (!preview) lastById.set(id, at);

    const text = renderLine(template, names);
    emit(text, entry, Math.min(9000, Math.max(priority === 3 ? 5200 : 4200, text.length * 66)));
    return true;
  };
}
