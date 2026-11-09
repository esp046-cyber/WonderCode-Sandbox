/**
 * WonderCode Sandbox - Persistence Database Layer
 * Safe localStorage with memory fallback and error recovery.
 */

const DB = (() => {
  const mem = {};
  const prefix = 'wcs:';

  return {
    get(k, fallback) {
      try {
        const item = localStorage.getItem(prefix + k);
        return item !== null ? JSON.parse(item) : fallback;
      } catch (err) {
        console.warn(`[DB] Read error for "${k}", falling back to memory/default.`, err);
        return mem[k] !== undefined ? mem[k] : fallback;
      }
    },
    set(k, val) {
      mem[k] = val;
      try {
        localStorage.setItem(prefix + k, JSON.stringify(val));
      } catch (err) {
        console.warn(`[DB] Storage write quota exceeded for "${k}". Using memory cache.`, err);
        if (typeof toast === 'function') {
          toast('Local storage full. Edits saved in session memory only.', 'OK', () => {});
        }
      }
    },
    remove(k) {
      delete mem[k];
      try {
        localStorage.removeItem(prefix + k);
      } catch (_) {}
    }
  };
})();
