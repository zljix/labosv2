import assert from 'node:assert/strict';

// A label or failed HTTP request alone is not proof of network isolation.
export function validateIsolation({namespace,onlineNamespace,links}) {
  assert.match(namespace,/^net:\[\d+\]$/);
  assert.match(onlineNamespace,/^net:\[\d+\]$/);
  assert.notEqual(namespace,onlineNamespace,'Offline process must use a separate network namespace');
  assert(Array.isArray(links)&&links.length===1,'Only the disconnected loopback interface may exist');
  assert.equal(links[0].ifname,'lo');
  assert(Array.isArray(links[0].flags)&&!links[0].flags.includes('UP'),'Loopback must remain down');
  return true;
}
