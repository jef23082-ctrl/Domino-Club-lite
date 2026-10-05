import { conditionalRoomWrite } from './conditional-room-write.js?v=20261005T162819119';
import { boundedOperation } from './bounded-operation.js?v=20261005T162819119';

export function writeCompletePresence(reference, payload, timeoutMs = 5000) {
  if (/^https?:\/\//.test(String(reference))) {
    return conditionalRoomWrite(reference, current => Number(current?.revision || 0) > Number(payload.revision || 0)
      ? current : payload, { timeoutMs, totalTimeoutMs: timeoutMs * 2, recoverWrites: true });
  }
  return boundedOperation(() => reference.set(payload), timeoutMs);
}
