let audioContext = null;

export function enableWorkoutTimerSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        audioContext ??= new AudioContext();
        if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    } catch {
        // Le minuteur reste utilisable si le navigateur refuse le son.
    }
}

export function playWorkoutTimerSignal(seconds, ending = "start") {
    if (!audioContext || audioContext.state !== "running") return;
    try {
        const final = seconds === 0;
        const duration = final ? 0.65 : 0.12;
        const now = audioContext.currentTime;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(final ? (ending === "finish" ? 330 : 1100) : 880, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
        gain.gain.setValueAtTime(0.15, now + duration - 0.03);
        gain.gain.linearRampToValueAtTime(0, now + duration);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(now);
        oscillator.stop(now + duration);
    } catch {
        // Ne pas interrompre la seance pour un probleme audio.
    }
}
