// Compatibility gate only. A static client cannot enforce Firebase authorization.
// Preserve the V2 password without copying its plaintext into a second source file.
const LEGACY_DIGEST = 'a4d2928e75f9badd04e661b8e9a1348431912fa519d260cc16e000064dceb856';

export async function authenticateAdmin(candidate) {
  const normalized = String(candidate || '').trim().toLowerCase();
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('') === LEGACY_DIGEST;
}

export class AdminAccess {
  #unlocked = false;
  #generation = 0;
  constructor(verify = authenticateAdmin) { this.verify = verify; }
  get unlocked() { return this.#unlocked; }
  async unlock(candidate) {
    const generation = ++this.#generation;
    const valid = await this.verify(candidate);
    if (generation !== this.#generation) return false;
    this.#unlocked = Boolean(valid);
    return this.#unlocked;
  }
  lock() { this.#generation++; this.#unlocked = false; }
  require() { if (!this.#unlocked) throw new Error('Accès administrateur verrouillé.'); }
}
