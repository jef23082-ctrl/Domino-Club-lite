// A timeout is not proof that a write failed: callers must reconcile/idempotently retry.
export function boundedOperation(operation, timeoutMs = 6000, message = 'Le serveur ne répond pas encore.') {
  let timer;
  return Promise.race([
    Promise.resolve().then(operation),
    new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error(message), { code: 'network-timeout' })), timeoutMs); })
  ]).finally(() => clearTimeout(timer));
}
