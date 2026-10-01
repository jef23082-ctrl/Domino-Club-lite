import { createRoundAdvanceRequest } from './round-advance.js?v=20261001T025219457';
import { roomPlayers } from '../game/room-state.js?v=20261001T025219457';
import { roundTransitionConfirmed, roundTransitionMatches, roundTransitionId } from '../game/round-transition.js?v=20261001T025219457';

const TERMINAL = new Set(['player-not-seated', 'stale-match', 'stale-result', 'room-not-found']);

// Independent of renderResult and of the SDK's connection flag. Rendering is
// only a subscriber: it cannot hold a launch lock or cancel a durable command.
export class RoundTransitionController {
  constructor({ repository, roomCode, playerId, storage, legacyStorage, onState = () => {},
    onRoom = () => {}, onDiagnostic = () => {}, stepTimeoutMs = 7000, retryDelayMs = 1500 }) {
    Object.assign(this, { repository, roomCode, playerId, storage, legacyStorage,
      onState, onRoom, onDiagnostic, stepTimeoutMs, retryDelayMs });
    this.storageKey = `domino-next-round:v2:${playerId}:${roomCode}`;
    this.legacyKey = `domino-round-request:${playerId}:${roomCode}`;
    this.room = null;
    this.intent = null;
    this.timer = null;
    this.running = null;
    this.disposed = false;
    this.failures = 0;
    this.state = { phase: 'idle', message: '', commandId: '' };
    try {
      this.intent = JSON.parse(storage?.getItem(this.storageKey) || legacyStorage?.getItem(this.legacyKey) || 'null');
    } catch { /* Storage failure never disables the action. */ }
  }

  #save(request) {
    this.intent = request;
    try {
      if (request) this.storage?.setItem(this.storageKey, JSON.stringify(request));
      else this.storage?.removeItem(this.storageKey);
      this.legacyStorage?.removeItem(this.legacyKey);
    } catch { /* Server command remains durable if browser storage is denied. */ }
  }

  #publish(phase, message = '') {
    if (this.disposed) return;
    this.state = { phase, message, commandId: this.intent ? roundTransitionId(this.intent) : '' };
    this.onState(this.state);
    this.onDiagnostic(phase, { commandId: this.state.commandId, message });
  }

  #isPlayer(room) {
    return roomPlayers(room).some(p => String(p.playerId) === String(this.playerId));
  }

  observe(room) {
    if (this.disposed || !room) return;
    if (this.room && String(this.room.matchId) === String(room.matchId)
      && Number(room.game?.roundNumber) < Number(this.room.game?.roundNumber)) return;
    this.room = room;
    if (this.intent && roundTransitionConfirmed(room, this.intent)) {
      this.failures = 0;
      this.#save(null);
      clearTimeout(this.timer); this.timer = null;
      this.#publish('confirmed', 'Nouvelle manche confirmée par le serveur.');
    } else if (this.intent && !roundTransitionMatches(room, this.intent)) {
      this.#save(null);
      clearTimeout(this.timer); this.timer = null;
      this.#publish('cancelled', 'La table a changé : cette ancienne demande est ignorée.');
    }
    const command = room.roundTransition?.command;
    if (!this.intent && command?.status === 'requested' && roundTransitionMatches(room, command) && this.#isPlayer(room)) {
      this.#save(command);
      this.#publish('queued', 'Demande enregistrée dans la salle.');
    }
    if (!this.intent && room.game?.roundStatus === 'ended' && this.state.phase === 'confirmed') this.#publish('idle');
    if (this.intent) this.wake();
  }

  // An already-open older client may still publish to the V49 relay. Import
  // valid requests once, but never write a new request to that separate branch.
  observeLegacy(request) {
    if (!this.disposed && !this.intent && this.#isPlayer(this.room) && roundTransitionMatches(this.room, request)) {
      this.#save(request);
      this.wake();
    }
  }

  request() {
    if (this.disposed) return;
    const request = createRoundAdvanceRequest(this.room, this.playerId);
    if (!this.intent || roundTransitionId(this.intent) !== roundTransitionId(request)) this.#save(request);
    this.#publish('submitting', 'Demande envoyée · confirmation en cours…');
    clearTimeout(this.timer); this.timer = null;
    this.wake();
    return roundTransitionId(request);
  }

  wake() {
    if (this.disposed || !this.intent || !this.room || this.running || this.timer || !this.#isPlayer(this.room)) return;
    this.timer = setTimeout(() => { this.timer = null; this.#run(); }, 0);
  }

  async #step(operation, run) {
    const abort = new AbortController();
    run.abort = abort;
    let timer;
    try {
      return await Promise.race([
        operation({ signal: abort.signal, timeoutMs: Math.min(4000, this.stepTimeoutMs), attempts: 4 }),
        new Promise((_, reject) => {
          timer = setTimeout(() => { abort.abort(); reject(Object.assign(new Error('Connexion lente ou interrompue.'), { code: 'round-network-timeout' })); }, this.stepTimeoutMs);
        })
      ]);
    } finally { clearTimeout(timer); abort.abort(); }
  }

  #current(run) {
    return !this.disposed && this.running === run && this.intent
      && roundTransitionId(this.intent) === roundTransitionId(run.request);
  }

  #accept(room) {
    if (this.disposed || !room) return;
    this.observe(room);
    this.onRoom(room);
  }

  async #run() {
    if (!this.intent || this.disposed || this.running) return;
    const run = { request: { ...this.intent } };
    this.running = run;
    const context = { request: run.request, playerId: this.playerId };
    try {
      this.#publish('submitting', 'Enregistrement de la demande…');
      const queued = await this.#step(options => this.repository.queueRoundTransition(this.roomCode, context, options), run);
      if (!this.#current(run)) return;
      this.#accept(queued);
      if (!this.#current(run)) return; // A peer has already applied it.
      this.#publish('queued', 'Demande enregistrée · distribution en cours…');
      const applied = await this.#step(options => this.repository.commitRoundTransition(this.roomCode, context, options), run);
      if (!this.#current(run)) return;
      if (!roundTransitionConfirmed(applied, run.request)) throw new Error('Le serveur n’a pas encore confirmé la distribution.');
      this.#accept(applied);
    } catch (error) {
      if (!this.#current(run)) return;
      // First reconcile the SERVER, even when the SDK never reports reconnect.
      // A PUT can succeed while its response is lost. Do not redeal blindly.
      try {
        const actual = await this.#step(options => this.repository.readRoundState(this.roomCode, options), run);
        if (this.#current(run)) this.#accept(actual);
      } catch { /* A disconnected browser keeps the intent until connectivity returns. */ }
      if (!this.#current(run)) return;
      if (TERMINAL.has(error.code)) {
        this.#save(null);
        this.#publish('error', error.message);
      } else {
        this.failures += 1;
        this.#publish('retrying', ['round-read-refused', 'round-write-refused'].includes(error.code)
          ? `${error.message} Tu peux réessayer ; aucune manche n’est annoncée comme lancée.`
          : 'Connexion en attente · relance automatique. Tu peux aussi réessayer.');
      }
    } finally {
      if (this.running === run) this.running = null;
      if (!this.disposed && this.intent && !this.timer) {
        const delay = Math.min(6000, this.retryDelayMs * 2 ** Math.min(2, Math.max(0, this.failures - 1)));
        this.timer = setTimeout(() => { this.timer = null; this.wake(); }, delay);
      }
    }
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.running?.abort?.abort();
    // Keep the saved request: closing/reloading the tab must not lose it.
  }
}
