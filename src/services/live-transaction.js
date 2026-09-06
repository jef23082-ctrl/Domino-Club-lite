// A one-shot read can be evicted before transaction() starts in Firebase compat.
// Retain a listener until the transaction ends so reducers see an initialized
// server-backed cache. The transaction still checks/retries against live data.
export async function liveTransaction(reference, update) {
  let listener;
  try {
    await new Promise((resolve, reject) => {
      listener = () => resolve();
      reference.on('value', listener, reject);
    });
    return await reference.transaction(update, undefined, false);
  } finally {
    if (listener) reference.off('value', listener);
  }
}
