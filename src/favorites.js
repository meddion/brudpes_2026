export function createFavorites(festivalId) {
  const key = `fest.favorites.${festivalId}`;
  const listeners = new Set();

  function read() {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? new Set(arr) : new Set();
    } catch {
      return new Set();
    }
  }

  function write(set) {
    try {
      localStorage.setItem(key, JSON.stringify([...set]));
    } catch {}
  }

  let set = read();

  window.addEventListener("storage", (event) => {
    if (event.key !== key) return;
    const next = read();
    const changed = symmetricDiff(set, next);
    set = next;
    for (const id of changed) emit(id);
  });

  function emit(id) {
    const fav = set.has(id);
    for (const fn of listeners) fn(id, fav);
  }

  return {
    has(id) {
      return set.has(id);
    },
    toggle(id) {
      if (set.has(id)) set.delete(id);
      else set.add(id);
      write(set);
      emit(id);
      return set.has(id);
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

function symmetricDiff(a, b) {
  const out = [];
  for (const id of a) if (!b.has(id)) out.push(id);
  for (const id of b) if (!a.has(id)) out.push(id);
  return out;
}
