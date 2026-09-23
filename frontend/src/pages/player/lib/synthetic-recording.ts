export const syntheticIntervals = Array.from({ length: 8 }, (_, index) => ({
  id: `synthetic-segment-${index + 1}`,
  start_ms: index * 4000,
  end_ms: index * 4000 + 3000,
  frequency: 440 + index * 110,
}));

/** Generated locally: 32 s of quiet tones with one-second gaps, no personal audio. */
export function createSyntheticRecording() {
  const sampleRate = 8000;
  const samples = sampleRate * 32;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples * 2, true);
  for (let sample = 0; sample < samples; sample += 1) {
    const seconds = sample / sampleRate;
    const local = seconds % 4;
    const frequency = 440 + Math.floor(seconds / 4) * 110;
    const envelope = Math.max(0, Math.min(1, local * 50, (3 - local) * 50));
    view.setInt16(
      44 + sample * 2,
      Math.round(Math.sin(2 * Math.PI * frequency * seconds) * 2600 * envelope),
      true
    );
  }
  return new Blob([buffer], { type: "audio/wav" });
}
