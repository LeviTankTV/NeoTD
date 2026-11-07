import type { SfxName } from '../game/types';

type AudioContextCtor = typeof AudioContext;

export class Sound {
  enabled = true;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private padGain: GainNode | null = null;
  private intensity = -1;

  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }

    const Ctor: AudioContextCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return;

    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.42 : 0.0001;
    this.master.connect(this.ctx.destination);

    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;

    this.startAmbient();
    this.startMusic();
  }

  setIntensity(value: number): void {
    if (!this.ctx || !this.padFilter || !this.padGain) return;
    const target = Math.max(0, Math.min(1, value));
    if (Math.abs(target - this.intensity) < 0.02) return;
    this.intensity = target;

    const now = this.ctx.currentTime;
    this.padFilter.frequency.setTargetAtTime(420 + target * 780, now, 0.6);
    this.padGain.gain.setTargetAtTime(0.03 + target * 0.03, now, 0.8);
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(value ? 0.42 : 0.0001, this.ctx.currentTime, 0.05);
    }
  }

  play(name: SfxName): void {
    if (!this.ctx || !this.master || !this.enabled) return;

    switch (name) {
      case 'shot':
        this.blip(880, 300, 0.07, 'square', 0.05);
        break;
      case 'pulse':
        this.blip(180, 48, 0.34, 'sine', 0.16);
        this.hiss(0.22, 0.09, 420);
        break;
      case 'rail':
        this.blip(1600, 90, 0.42, 'sawtooth', 0.07);
        this.hiss(0.35, 0.12, 1800);
        break;
      case 'kill':
        this.blip(320, 70, 0.16, 'triangle', 0.07);
        this.hiss(0.12, 0.05, 900);
        break;
      case 'leak':
        this.blip(96, 40, 0.7, 'sine', 0.2);
        this.blip(140, 60, 0.55, 'square', 0.05, 0.06);
        break;
      case 'build':
        this.blip(420, 430, 0.09, 'triangle', 0.09);
        this.blip(660, 670, 0.12, 'triangle', 0.07, 0.08);
        break;
      case 'upgrade':
        this.blip(520, 940, 0.22, 'triangle', 0.1);
        break;
      case 'sell':
        this.blip(620, 240, 0.2, 'square', 0.06);
        break;
      case 'error':
        this.blip(130, 90, 0.16, 'square', 0.09);
        break;
      case 'wave':
        this.blip(120, 620, 0.8, 'sawtooth', 0.05);
        this.hiss(0.7, 0.05, 260);
        break;
      case 'win':
        [440, 554, 659, 880].forEach((freq, i) => this.blip(freq, freq * 1.01, 0.5, 'triangle', 0.07, i * 0.15));
        break;
      case 'lose':
        this.blip(220, 32, 2.2, 'sawtooth', 0.1);
        this.blip(110, 24, 2.6, 'sine', 0.14, 0.2);
        break;
    }
  }

  private startAmbient(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;

    const bus = ctx.createGain();
    bus.gain.value = 0.05;
    bus.connect(this.master);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    filter.Q.value = 0.7;
    filter.connect(bus);

    const oscA = ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 55;

    const oscB = ctx.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = 82.4;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(bus.gain);

    oscA.connect(filter);
    oscB.connect(filter);
    oscA.start();
    oscB.start();
    lfo.start();
  }

  private startMusic(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;

    const padGain = ctx.createGain();
    padGain.gain.value = 0.03;
    padGain.connect(this.master);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 1.4;
    filter.connect(padGain);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 160;
    lfo.connect(lfoDepth);
    lfoDepth.connect(filter.frequency);
    lfo.start();

    const chord = [110, 130.81, 164.81, 246.94];
    chord.forEach((freq, index) => {
      for (const detune of [-4, 4]) {
        const osc = ctx.createOscillator();
        osc.type = index === 0 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = detune;

        const gain = ctx.createGain();
        gain.gain.value = index === 0 ? 0.5 : 0.18;
        osc.connect(gain);
        gain.connect(filter);
        osc.start();
      }
    });

    this.padGain = padGain;
    this.padFilter = filter;
  }

  private blip(
    from: number,
    to: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const start = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, from), start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(env);
    env.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private hiss(duration: number, gain: number, frequency: number): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const ctx = this.ctx;
    const start = ctx.currentTime;

    const source = ctx.createBufferSource();
    source.buffer = this.noise;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.9;

    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    source.start(start);
    source.stop(start + duration);
  }
}
