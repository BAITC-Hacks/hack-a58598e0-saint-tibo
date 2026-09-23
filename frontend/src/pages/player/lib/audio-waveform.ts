/** A small overview for an authorized recording already selected in the player. */
export async function readAudioWaveform(file: File): Promise<number[] | null> {
  // Decoding a long meeting can consume much more memory than the encoded file.
  if (file.size > 32 * 1024 * 1024 || typeof AudioContext === "undefined")
    return null;

  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await file.arrayBuffer());
    const count = 180;
    const peaks = Array.from({ length: count }, () => 0);
    for (let channel = 0; channel < audio.numberOfChannels; channel++) {
      const samples = audio.getChannelData(channel);
      for (let index = 0; index < count; index++) {
        const start = Math.floor((index * samples.length) / count);
        const end = Math.floor(((index + 1) * samples.length) / count);
        const stride = Math.max(1, Math.floor((end - start) / 256));
        let peak = 0;
        for (let sample = start; sample < end; sample += stride)
          peak = Math.max(peak, Math.abs(samples[sample] ?? 0));
        peaks[index] = Math.max(peaks[index] ?? 0, peak);
      }
    }
    const max = Math.max(...peaks, 0.01);
    return peaks.map((peak) => Math.max(0.08, peak / max));
  } catch {
    // Video codecs and some audio containers cannot be decoded by Web Audio.
    return null;
  } finally {
    await context.close();
  }
}
