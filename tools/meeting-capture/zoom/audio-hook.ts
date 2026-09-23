// Runs before Zoom scripts in every frame. Only remote WebRTC audio enters the recorder.
export const audioHook = `(() => {
  const NativePC = window.RTCPeerConnection;
  if (!NativePC || window.__zoomAudio) return;
  const tracks = new Map();
  const context = new AudioContext();
  const mixed = context.createMediaStreamDestination();
  let recorder, started = 0, previous = 0, pending = Promise.resolve();
  let finish;
  const done = new Promise(resolve => { finish = resolve; });
  window.__zoomAudio = {
    async start() {
      if (recorder || !tracks.size) return false;
      if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return false;
      await context.resume();
      recorder = new MediaRecorder(mixed.stream, { mimeType: 'audio/webm;codecs=opus' });
      recorder.ondataavailable = event => {
        if (!event.data.size) return;
        const end = Math.max(previous + 1, Math.round(performance.now() - started));
        const start = previous;
        previous = end;
        pending = pending.then(async () => {
          const bytes = Array.from(new Uint8Array(await event.data.arrayBuffer()));
          await window.__zoomAudioChunk({ start, end, bytes });
        });
      };
      recorder.onstop = () => { pending.finally(finish); };
      recorder.onerror = () => { pending.finally(finish); };
      started = performance.now();
      recorder.start(1000);
      return true;
    },
    async stop() {
      if (recorder && recorder.state !== 'inactive') {
        recorder.requestData();
        recorder.stop();
        await done;
      }
      await pending;
      await context.close();
    },
    hasAudio() { return tracks.size > 0; },
  };
  window.RTCPeerConnection = new Proxy(NativePC, {
    construct(target, args) {
      const pc = Reflect.construct(target, args);
      pc.addEventListener('track', event => {
        const track = event.track;
        if (track.kind !== 'audio' || tracks.has(track.id)) return;
        const source = context.createMediaStreamSource(new MediaStream([track]));
        source.connect(mixed);
        tracks.set(track.id, source);
        track.addEventListener('ended', () => { tracks.delete(track.id); source.disconnect(); }, { once: true });
      });
      return pc;
    },
  });
})();`;
