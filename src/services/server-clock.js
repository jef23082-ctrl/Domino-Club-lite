export class ServerClock {
  constructor(database, { now = () => Date.now() } = {}) {
    this.reference = database?.ref?.('.info/serverTimeOffset') || null;
    this.localNow = now;
    this.offsetMs = 0;
    this.listener = null;
  }

  start() {
    if (!this.reference || this.listener) return this;
    this.listener = snapshot => {
      const offset = Number(snapshot?.val?.());
      if (Number.isFinite(offset)) this.offsetMs = offset;
    };
    this.reference.on('value', this.listener);
    return this;
  }

  stop() {
    if (this.reference && this.listener) this.reference.off('value', this.listener);
    this.listener = null;
  }

  now() {
    return this.localNow() + this.offsetMs;
  }
}
