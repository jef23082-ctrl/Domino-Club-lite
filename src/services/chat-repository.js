import { FIREBASE_PATHS } from '../config/firebase.js';

export class ChatRepository {
  constructor(database, { serverTimestamp = () => Date.now() } = {}) {
    this.database = database;
    this.chats = database.ref(FIREBASE_PATHS.chats);
    this.typing = database.ref(FIREBASE_PATHS.typing);
    this.serverTimestamp = serverTimestamp;
  }

  watch(channel, handlers, limit = 80) {
    const reference = this.chats.child(channel).limitToLast(limit);
    const added = snapshot => handlers.added?.({ id: snapshot.key, ...(snapshot.val() || {}) });
    const changed = snapshot => handlers.changed?.({ id: snapshot.key, ...(snapshot.val() || {}) });
    const removed = snapshot => handlers.removed?.(snapshot.key);
    reference.on('child_added', added, handlers.error);
    reference.on('child_changed', changed, handlers.error);
    reference.on('child_removed', removed, handlers.error);
    return () => {
      reference.off('child_added', added);
      reference.off('child_changed', changed);
      reference.off('child_removed', removed);
    };
  }

  async send(channel, { profile, clientToken, role, text }) {
    const message = this.chats.child(channel).push();
    const payload = {
      messageId: message.key,
      senderId: profile.id,
      senderToken: clientToken,
      name: profile.name,
      avatar: profile.avatar || '❓',
      role,
      text: String(text || '').trim().slice(0, 300),
      createdAt: this.serverTimestamp()
    };
    if (!payload.text) throw new Error('Le message est vide.');
    await message.set(payload);
    return message.key;
  }

  async markTyping(channel, { clientToken, profile }) {
    const reference = this.typing.child(`${channel}/${clientToken}`);
    await reference.set({
      playerId: profile.id,
      name: profile.name,
      at: this.serverTimestamp()
    });
    await reference.onDisconnect().remove();
  }

  watchTyping(channel, onValue) {
    const reference = this.typing.child(channel);
    const listener = snapshot => onValue(snapshot.val() || {});
    reference.on('value', listener);
    return () => reference.off('value', listener);
  }

  clearTyping(channel, clientToken) {
    return this.typing.child(`${channel}/${clientToken}`).remove();
  }
}
