"use client";

/**
 * Plays a short notification sound using the Web Audio API.
 * No external audio file needed — generates a pleasant tone programmatically.
 */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  audioCtx ??= new AudioContext();
  return audioCtx;
}

export function playNotificationSound() {
  try {
    const ctx = getAudioContext();

    // Resume if suspended (browsers block autoplay until user interaction)
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const now = ctx.currentTime;

    // Two-tone chime: pleasant and short
    const frequencies = [880, 1100]; // A5, C#6 — a nice major third
    const duration = 0.12;

    frequencies.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, now);

      // Quick fade in/out to avoid clicks
      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.08 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + duration);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(now + i * 0.08);
      oscillator.stop(now + i * 0.08 + duration + 0.05);
    });
  } catch {
    // Silently fail if audio is not available
  }
}
