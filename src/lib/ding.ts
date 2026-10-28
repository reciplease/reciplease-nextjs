export function createDing(): () => void {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return () => {};
  const context = new AudioContextClass();
  return () => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.2);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 1.2);
  };
}
