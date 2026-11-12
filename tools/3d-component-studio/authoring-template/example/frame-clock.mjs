// Events only reset; the baseline is established exclusively by RAF timestamps.
export function createFrameClock() {
  let last = null;
  return {
    reset() { last = null; },
    advance(stamp) {
      if (!Number.isFinite(stamp)) return 0;
      if (last === null) { last = stamp; return 0; }
      const delta = Math.max(0, Math.min((stamp - last) / 1000, .1));
      last = Math.max(last, stamp);
      return delta;
    }
  };
}
