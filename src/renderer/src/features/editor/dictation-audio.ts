export interface Media {
  stop: () => void;
}

/** Emits base64-encoded mono PCM16 at 24 kHz, without retaining audio after the turn. */
export async function captureMicrophone(onChunk: (audio: string) => void): Promise<Media> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1 },
    video: false,
  });
  let context: AudioContext | null = null;
  try {
    context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    let accumulator = 0;
    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(Math.ceil((input.length * 24_000) / context!.sampleRate) + 1);
      let count = 0;
      for (const sample of input) {
        accumulator += 24_000;
        const clipped = Math.max(-1, Math.min(1, sample));
        while (accumulator >= context!.sampleRate) {
          accumulator -= context!.sampleRate;
          pcm[count++] = Math.round(clipped < 0 ? clipped * 32768 : clipped * 32767);
        }
      }
      if (count === 0) return;
      const bytes = new Uint8Array(pcm.buffer, 0, count * 2);
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      onChunk(btoa(binary));
    };
    source.connect(processor);
    processor.connect(context.destination);
    await context.resume();
    let stopped = false;
    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        processor.disconnect();
        source.disconnect();
        processor.onaudioprocess = null;
        stream.getTracks().forEach((track) => track.stop());
        void context?.close();
      },
    };
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    if (context) void context.close();
    throw error;
  }
}
