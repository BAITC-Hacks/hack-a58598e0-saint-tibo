/** Runs before the meeting application. Only standard inbound audio tracks;
 * no data channels, captions, roster, microphone or desktop audio access. */
export function installAudioBridge() {
  const tracks = new Set<MediaStreamTrack>();
  const sources = new Map<MediaStreamTrack, MediaStreamAudioSourceNode>();
  const playback = new Map<MediaStreamTrack, HTMLAudioElement>();
  let context: AudioContext | undefined;
  let output: MediaStreamAudioDestinationNode | undefined;
  let recorder: MediaRecorder | undefined;
  let error = false;
  let stopped = false;
  let bytes = 0;
  let start = 0;
  let end = 0;
  const queue: { blob: Blob; end_ms: number }[] = [];
  const connect = (track: MediaStreamTrack) => {
    if (!context || !output || sources.has(track) || track.readyState === "ended") return;
    const stream = new MediaStream([track]);
    // Chromium needs an HTML media consumer to advance remote WebRTC playout.
    // Zero volume keeps this extra consumer out of the system audio output.
    const player = new Audio();
    player.srcObject = stream;
    player.volume = 0;
    void player.play().catch(() => { error = true; });
    playback.set(track, player);
    const source = context.createMediaStreamSource(stream);
    source.connect(output);
    sources.set(track, source);
  };
  const Original = window.RTCPeerConnection;
  window.RTCPeerConnection = class extends Original {
    constructor(configuration?: RTCConfiguration) {
      super(configuration);
      this.addEventListener("track", ({ track }) => {
        if (track.kind !== "audio" || tracks.has(track)) return;
        tracks.add(track);
        track.addEventListener("ended", () => {
          sources.get(track)?.disconnect();
          sources.delete(track);
          playback.get(track)?.pause();
          playback.delete(track);
          tracks.delete(track);
        }, { once: true });
        connect(track);
      });
    }
  };
  const bridge = {
    async start() {
      if (recorder || ![...tracks].some(track => track.readyState === "live")) return false;
      if (!MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return false;
      context = new AudioContext({ sampleRate: 48000 });
      output = context.createMediaStreamDestination();
      for (const track of tracks) connect(track);
      await context.resume();
      if (context.state !== "running") return false;
      recorder = new MediaRecorder(output.stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 64000 });
      recorder.ondataavailable = ({ data }) => {
        if (!data.size || error) return;
        // Timeslices are approximate. Never derive time from chunk count.
        end = Math.max(end + 1, Math.round(performance.now() - start));
        bytes += data.size;
        if (bytes > 8 * 1024 * 1024 || queue.length >= 8) {
          error = true; // Fail visibly on backpressure; never drop/pause recorded time.
          if (recorder?.state === "recording") recorder.stop();
          return;
        }
        queue.push({ blob: data, end_ms: end });
      };
      recorder.onerror = () => { error = true; };
      recorder.onstop = () => { stopped = true; };
      start = performance.now();
      recorder.start(4000);
      return true;
    },
    stop() { if (recorder?.state === "recording") recorder.stop(); },
    async next() {
      const has_tracks = [...tracks].some(track => track.readyState === "live");
      error ||= context?.state !== "running";
      const item = queue.shift();
      if (!item) return { error, stopped, has_tracks, part: null };
      bytes -= item.blob.size;
      const data = new Uint8Array(await item.blob.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < data.length; offset += 8192) {
        binary += String.fromCharCode(...data.subarray(offset, offset + 8192));
      }
      return { error, stopped, has_tracks, part: { end_ms: item.end_ms, base64: btoa(binary) } };
    },
    async dispose() {
      bridge.stop();
      for (const source of sources.values()) source.disconnect();
      sources.clear();
      for (const player of playback.values()) { player.pause(); player.srcObject = null; }
      playback.clear();
      output?.stream.getTracks().forEach(track => track.stop());
      await context?.close();
      queue.length = 0;
    },
  };
  Object.defineProperty(window, "__localMeetingAudio", { value: bridge });
}

declare global {
  interface Window { __localMeetingAudio: {
    start(): Promise<boolean>;
    stop(): void;
    next(): Promise<{ error: boolean; stopped: boolean; has_tracks: boolean; part: { end_ms: number; base64: string } | null }>;
    dispose(): Promise<void>;
  } }
}
