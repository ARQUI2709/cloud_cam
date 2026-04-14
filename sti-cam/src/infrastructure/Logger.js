/**
 * Infrastructure: Logger
 * Central ring-buffer logger. Mirrors to console AND keeps the last N entries
 * in memory so a UI overlay can render them on devices with no devtools
 * (iOS PWA, Android home-screen PWA).
 */

const MAX_ENTRIES = 200;

const buffer = [];
const listeners = new Set();

function push(level, args) {
  const entry = {
    id: Date.now() + Math.random(),
    ts: new Date(),
    level,
    message: args
      .map((a) => {
        if (a instanceof Error) return `${a.name}: ${a.message}`;
        if (typeof a === 'object') {
          try { return JSON.stringify(a); } catch { return String(a); }
        }
        return String(a);
      })
      .join(' '),
  };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
  listeners.forEach((fn) => {
    try { fn(entry); } catch {}
  });
}

export const logger = {
  log: (...args) => { console.log(...args); push('log', args); },
  warn: (...args) => { console.warn(...args); push('warn', args); },
  error: (...args) => { console.error(...args); push('error', args); },
  getEntries: () => buffer.slice(),
  subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  clear: () => { buffer.length = 0; listeners.forEach((fn) => { try { fn(null); } catch {} }); },
};
