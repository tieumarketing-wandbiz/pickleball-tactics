/** Playback pacing only. Simulation is sampled at wall time, never advanced by 1/FPS. */
export const PLAYBACK_FPS = 24;
export const SHUTTER_SECONDS = 1 / (2 * PLAYBACK_FPS);
export class PlaybackClock {
  private accumulated = 0;
  private origin: number | undefined;
  reset() { this.accumulated = 0; this.origin = undefined; }
  resume(nowSeconds: number) { if (this.origin === undefined) this.origin = nowSeconds; }
  sample(nowSeconds: number) {
    return this.accumulated + (this.origin === undefined ? 0 : Math.max(0, nowSeconds-this.origin));
  }
  pause(nowSeconds: number) {
    this.accumulated = this.sample(nowSeconds); this.origin = undefined;
    return this.accumulated;
  }
}
export class PlaybackRenderClock {
  private deadline = 0;
  reset(nowMs = 0) { this.deadline = nowMs; }
  due(nowMs: number, playing: boolean, immediate: boolean) {
    if (!playing) return immediate;
    const period = 1000 / PLAYBACK_FPS;
    if (nowMs + 1e-6 >= this.deadline) {
      // Drop missed renders, not elapsed simulation time. Keep the original deadline phase.
      this.deadline += (Math.floor((nowMs-this.deadline+1e-6)/period)+1)*period;
      return true;
    }
    return immediate;
  }
}
