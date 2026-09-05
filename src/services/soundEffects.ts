/**
 * Web Audio API synthesizer for realistic thermal receipt printer motor buzz and paper feed chatter
 */
class SoundEffects {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Plays a quick confirmation beep
   */
  public playBeep(freq = 880, duration = 0.12) {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio might be blocked until user gesture
    }
  }

  /**
   * Simulates the mechanical rhythmic stepper motor chatter and thermal head burn of a POS printer
   */
  public playThermalPrintSound(durationMs = 1800) {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const durationSec = durationMs / 1000;
      const bufferSize = ctx.sampleRate * durationSec;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Synthesize periodic stepper motor clicks and thermal hiss
      for (let i = 0; i < bufferSize; i++) {
        const t = i / ctx.sampleRate;
        const motorFreq = 160 + (i % 80); // stepper harmonics
        const square = Math.sin(2 * Math.PI * motorFreq * t) > 0 ? 0.08 : -0.08;
        const noise = (Math.random() * 2 - 1) * 0.04;
        // Pulse every 40ms to simulate line feeds
        const linePulse = Math.sin(2 * Math.PI * 25 * t) > 0.4 ? 1.4 : 0.6;
        data[i] = (square + noise) * linePulse * 0.2;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, ctx.currentTime);
      filter.Q.setValueAtTime(3, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + durationSec - 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      source.start();
      source.stop(ctx.currentTime + durationSec);
    } catch {
      // ignore
    }
  }

  /**
   * Success notification chime
   */
  public playSuccess() {
    this.playBeep(520, 0.08);
    setTimeout(() => this.playBeep(659.25, 0.08), 80);
    setTimeout(() => this.playBeep(783.99, 0.16), 160);
  }

  /**
   * Cash drawer 'Ka-ching' mechanical chime
   */
  public playDrawerKick() {
    this.playBeep(520, 0.08);
    setTimeout(() => this.playBeep(780, 0.15), 90);
  }
}

export const soundEffects = new SoundEffects();
