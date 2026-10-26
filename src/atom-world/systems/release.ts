/**
 * Clean-up hooks for when the player leaves /atom-world. Heavy modules (three.js caches) register
 * themselves when they load, so the light first bundle does not have to import them.
 */
const hooks = new Set<() => void>();

export function onRelease(fn: () => void) {
  hooks.add(fn);
}

export function releaseAll() {
  hooks.forEach((fn) => {
    try {
      fn();
    } catch {
      /* best effort */
    }
  });
}
