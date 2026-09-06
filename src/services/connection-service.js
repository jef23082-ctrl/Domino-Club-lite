export class ConnectionService {
  constructor(database) { this.reference = database.ref('.info/connected'); this.connected = false; }
  watch(onChange) {
    const listener = snapshot => { this.connected = snapshot.val() === true; onChange(this.connected); };
    this.reference.on('value', listener);
    return () => this.reference.off('value', listener);
  }
  require() { if (!this.connected) throw new Error('Connexion interrompue. Attendez la reconnexion avant de jouer.'); }
}
