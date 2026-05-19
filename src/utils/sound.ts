/**
 * Plays a short notification sound using Web Audio API (no external files needed).
 * @param type 'arrival' = doble tono agudo | 'success' = tono suave | 'alert' = tono de alerta
 */
export function playNotificationSound(type: 'arrival' | 'success' | 'alert' = 'arrival') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const pairs: [number, number, number][] = // [freq, startDelay, duration]
      type === 'arrival'
        ? [[880, 0, 0.35], [1100, 0.14, 0.35]]
        : type === 'success'
        ? [[660, 0, 0.3], [880, 0.12, 0.3]]
        : [[440, 0, 0.25], [330, 0.15, 0.4]];

    pairs.forEach(([freq, delay, dur]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0.28, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.05);
    });
  } catch {
    // Browser doesn't support Web Audio API — silently ignore
  }
}
