"use client";

/**
 * Plays a joyful notification sound using the Web Audio API.
 * Bright, bubbly three-note chime — like a happy pop.
 */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  audioCtx ??= new AudioContext();
  return audioCtx;
}

export function playNotificationSound() {
  try {
    const ctx = getAudioContext();

    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const now = ctx.currentTime;

    // Joyful rising three-note chime: C6 → E6 → G6 (major triad = happy sound)
    const notes = [
      { freq: 1047, time: 0, duration: 0.1 },      // C6
      { freq: 1319, time: 0.08, duration: 0.1 },    // E6
      { freq: 1568, time: 0.16, duration: 0.15 },   // G6 (held slightly longer)
    ];

    notes.forEach(({ freq, time, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + time);

      // Soft attack, gentle decay
      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(0.18, now + time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + duration + 0.05);
    });
  } catch {
    // Silently fail if audio is not available
  }
}
