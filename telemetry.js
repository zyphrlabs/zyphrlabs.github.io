// Measures the orb's own load path. Web Analytics already reports pageviews and
// core web vitals; this covers what those cannot see: time to first WebGL frame
// and whether the photographic environment ever arrived.
const marks = {};

export function mark(name) {
  const at = Math.round(performance.now());
  marks[name] = at;
  performance.mark(`zyphr:${name}`);
  return at;
}

export function report() {
  const kb = {};
  let totalKb = 0;
  for (const entry of performance.getEntriesByType('resource')) {
    const size = Math.round((entry.encodedBodySize || 0) / 1024);
    kb[entry.name.split('/').pop().split('?')[0]] = size;
    totalKb += size;
  }
  const fcp = performance.getEntriesByType('paint')
    .find(entry => entry.name === 'first-contentful-paint');
  window.zyphrMetrics = {
    ...marks,
    fcp: fcp ? Math.round(fcp.startTime) : null,
    totalKb: Math.round(totalKb),
    kb,
    dpr: devicePixelRatio,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    touch: matchMedia('(pointer: coarse)').matches,
  };
  return window.zyphrMetrics;
}
