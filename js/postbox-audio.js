// Postbox Web Audio Synthesizer (Zero-dependency realistic audio effects)
const PostboxAudio = {
  ctx: null,

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  play(type) {
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      if (type === 'beep' || type === 'scan') {
        // High crisp supermarket/postal barcode scanner beep
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1850, now);
        osc.frequency.exponentialRampToValueAtTime(2400, now + 0.08);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'unlock' || type === 'click') {
        // Heavy solenoid / smart locker magnetic door release click
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);

        // Followup second spring clack
        setTimeout(() => {
          if (!this.ctx) return;
          const now2 = this.ctx.currentTime;
          const osc2 = this.ctx.createOscillator();
          const gain2 = this.ctx.createGain();
          osc2.type = 'square';
          osc2.frequency.setValueAtTime(320, now2);
          osc2.frequency.exponentialRampToValueAtTime(80, now2 + 0.08);
          gain2.gain.setValueAtTime(0.18, now2);
          gain2.gain.exponentialRampToValueAtTime(0.001, now2 + 0.08);
          osc2.connect(gain2);
          gain2.connect(this.ctx.destination);
          osc2.start(now2);
          osc2.stop(now2 + 0.08);
        }, 80);
      } else if (type === 'success' || type === 'payment') {
        // Joyful 2-tone melodic success chime (C5 -> G5)
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const noteTime = now + idx * 0.08;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, noteTime);

          gain.gain.setValueAtTime(0.12, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(noteTime);
          osc.stop(noteTime + 0.35);
        });
      } else if (type === 'arrival' || type === 'bell') {
        // Friendly courier doorbell ding-dong
        const bell = (freq, delay) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const t = now + delay;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.2, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(t);
          osc.stop(t + 0.6);
        };
        bell(784, 0);      // G5
        bell(659.25, 0.28); // E5
      }
    } catch (e) {
      console.warn('Audio playback error (safe to ignore):', e);
    }
  }
};

window.PostboxAudio = PostboxAudio;
