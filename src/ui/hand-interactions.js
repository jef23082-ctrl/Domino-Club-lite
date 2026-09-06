export const HAND_DRAG_THRESHOLD = 9;
export const HAND_CLICK_SUPPRESSION = 420;

function sameTiles(left, right) {
  return left.length === right.length && left.every(id => right.includes(id));
}

// Bound once to stable containers, not rebound to each Firebase snapshot.
export function bindHandInteractions(container, { getSnapshot, onSelect, onReorder, onAnnounce = () => {} }) {
  const document = container.ownerDocument;
  let gesture = null;
  let suppressClickUntil = 0;

  function clearMarkers() {
    container.querySelectorAll('.drop-before, .drop-after').forEach(tile => tile.classList.remove('drop-before', 'drop-after'));
  }

  function cleanup() {
    const previous = gesture;
    gesture = null;
    clearMarkers();
    container.classList.remove('is-reordering');
    previous?.source.classList.remove('is-dragging');
    try {
      if (previous && container.hasPointerCapture?.(previous.pointerId)) container.releasePointerCapture(previous.pointerId);
    } catch (_) {}
    return previous;
  }

  function cancel() {
    if (!gesture) return;
    suppressClickUntil = Date.now() + HAND_CLICK_SUPPRESSION;
    cleanup();
  }

  function reconcile(snapshot = getSnapshot()) {
    if (gesture && (!snapshot.enabled || snapshot.key !== gesture.key || !sameTiles(snapshot.hand, gesture.hand))) cancel();
  }

  function pointerDown(event) {
    if (gesture || event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const source = event.target.closest('.hand-domino');
    const snapshot = getSnapshot();
    if (!source || !container.contains(source) || !snapshot.enabled || !snapshot.hand.includes(source.dataset.tileId)) return;
    gesture = {
      pointerId: event.pointerId, source, tileId: source.dataset.tileId,
      startX: event.clientX, startY: event.clientY, key: snapshot.key,
      hand: [...snapshot.hand], moved: false, targetId: '', after: false
    };
  }

  function pointerMove(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    reconcile();
    if (!gesture) return;
    if (!gesture.moved && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < HAND_DRAG_THRESHOLD) return;
    if (!gesture.moved) {
      gesture.moved = true;
      container.classList.add('is-reordering');
      gesture.source.classList.add('is-dragging');
      try { container.setPointerCapture?.(event.pointerId); } catch (_) {}
    }
    event.preventDefault();
    clearMarkers();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.hand-domino');
    if (!target || !container.contains(target) || target === gesture.source) {
      gesture.targetId = '';
      return;
    }
    gesture.targetId = target.dataset.tileId;
    const rect = target.getBoundingClientRect();
    gesture.after = event.clientX >= rect.left + rect.width / 2;
    target.classList.add(gesture.after ? 'drop-after' : 'drop-before');
  }

  function pointerUp(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    reconcile();
    if (!gesture) return;
    const completed = cleanup();
    if (!completed.moved) return;
    event.preventDefault();
    suppressClickUntil = Date.now() + HAND_CLICK_SUPPRESSION;
    if (completed.targetId) {
      onReorder({ key: completed.key, tileId: completed.tileId, targetId: completed.targetId, after: completed.after });
    }
  }

  function pointerCancel(event) {
    if (gesture?.pointerId === event.pointerId) cancel();
  }

  function captureLost(event) {
    // Touch starts with implicit capture on the button. Transferring capture to
    // our stable container emits a bubbling loss on that button; it is not a cancellation.
    if (event.target === container) pointerCancel(event);
  }

  function click(event) {
    if (Date.now() < suppressClickUntil || gesture?.moved) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const tile = event.target.closest('.hand-domino');
    if (tile && container.contains(tile)) onSelect(tile.dataset.tileId);
  }

  function keydown(event) {
    if (event.key === 'Escape' && gesture) {
      event.preventDefault();
      cancel();
      onAnnounce('Rangement annulé.');
      return;
    }
    if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const tile = event.target.closest('.hand-domino');
    const snapshot = getSnapshot();
    if (!tile || !container.contains(tile) || !snapshot.enabled) return;
    event.preventDefault();
    const index = snapshot.hand.indexOf(tile.dataset.tileId);
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const targetId = snapshot.hand[index + offset];
    if (index < 0 || !targetId) return;
    cancel();
    onReorder({ key: snapshot.key, tileId: tile.dataset.tileId, targetId, after: offset > 0 });
    tile.focus({ preventScroll: true });
  }

  const preventNativeDrag = event => event.preventDefault();
  container.addEventListener('pointerdown', pointerDown);
  container.addEventListener('click', click);
  container.addEventListener('dragstart', preventNativeDrag);
  container.addEventListener('lostpointercapture', captureLost);
  document.addEventListener('pointermove', pointerMove, { passive: false });
  document.addEventListener('pointerup', pointerUp);
  document.addEventListener('pointercancel', pointerCancel);
  document.addEventListener('keydown', keydown);
  document.defaultView?.addEventListener('blur', cancel);

  return {
    reconcile, cancel,
    destroy() {
      cancel();
      container.removeEventListener('pointerdown', pointerDown);
      container.removeEventListener('click', click);
      container.removeEventListener('dragstart', preventNativeDrag);
      container.removeEventListener('lostpointercapture', captureLost);
      document.removeEventListener('pointermove', pointerMove);
      document.removeEventListener('pointerup', pointerUp);
      document.removeEventListener('pointercancel', pointerCancel);
      document.removeEventListener('keydown', keydown);
      document.defaultView?.removeEventListener('blur', cancel);
    }
  };
}
