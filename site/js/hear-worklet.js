// Runs beside the page's sound, in an AudioWorklet: hands what the microphone hears to the
// page (site/js/hearing.js) a few thousand samples at a time, as it is recorded.
/* global AudioWorkletProcessor, registerProcessor */
class Hear extends AudioWorkletProcessor {
  constructor() {
    super();
    this.held = new Float32Array(4096);
    this.at = 0;
  }

  process(inputs) {
    const samples = inputs[0]?.[0];
    if (!samples) return true;
    for (let i = 0; i < samples.length; i++) {
      this.held[this.at++] = samples[i];
      if (this.at === this.held.length) {
        this.port.postMessage(this.held);
        this.held = new Float32Array(4096);
        this.at = 0;
      }
    }
    return true;
  }
}

registerProcessor('pixelreel-hear', Hear);
