import {createGUI} from './gui';

const audioElement = document.querySelector('audio')!;
const canvas = document.querySelector('canvas')!;
const button = document.querySelector('button')!;
const canvasContext = canvas.getContext("2d")!;

let audioContext: AudioContext;
let analyser: AnalyserNode;
let analyserBuffer: Uint8Array;
let timeData: Uint8Array;
let dataArray: Uint8Array;
let bufferLength: number;
let playing = false;
let frequencyData: Uint8Array;
let frequencyDataFloat: Float32Array;
// pour spin 
let frame = 0;

// function logFrequencyData() {
//   if (!analyser) return;

//   analyser.getByteFrequencyData(frequencyData);
//   // console.log("Fréquences (0-255) :", frequencyData);

//   analyser.getFloatFrequencyData(frequencyDataFloat);
//   // console.log("Fréquences (Décibels) :", frequencyDataFloat);

//   const max = Math.max(...frequencyDataFloat)

//   const min = Math.min(...frequencyDataFloat)

//   console.log(max,min)

//   return [max, min];
// }

export const PARAMS = {
  size: 50,
  color: '#ffffff',
  theme: 'dark',
  lineWidth: 1,    
  dash: 0,       
  trail: 1,    
  fill: false,     
  fillColor: '#000000',
  glow: 0,        
  jitter: 0,    
  spin: 0,         
  amplitude: 1,    
  spread: 500      
};

export type Params = typeof PARAMS;

createGUI(PARAMS);

function createContext() {
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 32768;

  bufferLength = analyser.frequencyBinCount;
  analyserBuffer = new Uint8Array(bufferLength);
  timeData = new Uint8Array(analyser.frequencyBinCount);
  frequencyData = new Uint8Array(analyser.frequencyBinCount);
  frequencyDataFloat = new Float32Array(analyser.frequencyBinCount);

  const source = audioContext.createMediaElementSource(audioElement);
  source.connect(analyser);
  analyser.connect(audioContext.destination);

  playing = true;
}

function draw() {
  requestAnimationFrame(draw);

  frame++;

  const w = window.innerWidth;
  const h = window.innerHeight;

  analyser.getByteFrequencyData(analyserBuffer as Uint8Array<ArrayBuffer>);
  analyser.getByteTimeDomainData(timeData as Uint8Array<ArrayBuffer>);

  canvasContext.fillStyle = PARAMS.theme === 'dark'
    ? `rgba(60, 58, 58, ${PARAMS.trail})`
    : `rgba(250, 246, 246, ${PARAMS.trail})`;

  canvasContext.fillRect(0, 0, w, h);

  canvasContext.lineWidth = PARAMS.lineWidth;
  canvasContext.strokeStyle = PARAMS.color;
  canvasContext.setLineDash(PARAMS.dash > 0 ? [PARAMS.dash, PARAMS.dash] : []);
  canvasContext.shadowBlur = PARAMS.glow;
  canvasContext.shadowColor = PARAMS.color;

  const zoomedFrequencyBandLength = bufferLength / 16;
  let initX: number;
  let initY: number;

  const offset1 = -PARAMS.spread;

  canvasContext.beginPath();

  for (let i = 0; i < zoomedFrequencyBandLength / 2; i++) {
    const amplitude = analyserBuffer[i] * PARAMS.amplitude;
    const normalizedFreqBand = i / zoomedFrequencyBandLength * 2;
    const angle = normalizedFreqBand * Math.PI * 2 + frame * PARAMS.spin * Math.PI / 180;
    const x = offset1 + Math.cos(angle) * amplitude + w / 2 + (Math.random() - 0.5) * PARAMS.jitter;
    const y = Math.sin(angle) * amplitude + h / 2 + (Math.random() - 0.5) * PARAMS.jitter;

    if (i === 0) {
      canvasContext.moveTo(x, y);
      initX = x;
      initY = y;
    } else {
      canvasContext.lineTo(x, y);
    }
  }

  canvasContext.lineTo(initX, initY);

  if (PARAMS.fill) {
    canvasContext.fillStyle = PARAMS.fillColor;
    canvasContext.fill();
  }

  canvasContext.stroke();

  const offset2 = 0;

  canvasContext.beginPath();

  for (let i = zoomedFrequencyBandLength / 2; i < zoomedFrequencyBandLength; i++) {
    const amplitude = (110 + analyserBuffer[i]) * PARAMS.amplitude;
    const normalizedFreqBand = i / zoomedFrequencyBandLength * 2;
    const angle = normalizedFreqBand * Math.PI * 2 + frame * PARAMS.spin * Math.PI / 180;
    const x = offset2 + Math.cos(angle) * amplitude + w / 2 + (Math.random() - 0.5) * PARAMS.jitter;
    const y = Math.sin(angle) * amplitude + h / 2 + (Math.random() - 0.5) * PARAMS.jitter;

    if (i === zoomedFrequencyBandLength / 2) {
      canvasContext.moveTo(x, y);
      initX = x;
      initY = y;
    } else {
      canvasContext.lineTo(x, y);
    }
  }

  canvasContext.lineTo(initX, initY);

  if (PARAMS.fill) {
    canvasContext.fillStyle = PARAMS.fillColor;
    canvasContext.fill();
  }

  canvasContext.stroke();

  const offset3 = PARAMS.spread;

  canvasContext.beginPath();

  for (let i = zoomedFrequencyBandLength / 4; i < zoomedFrequencyBandLength; i++) {
    const amplitude = analyserBuffer[i] * PARAMS.amplitude;
    const normalizedFreqBand = i / zoomedFrequencyBandLength * 2;
    const angle = normalizedFreqBand * Math.PI * 2 + frame * PARAMS.spin * Math.PI / 180;
    const x = offset3 + Math.cos(angle) * amplitude + w / 2 + (Math.random() - 0.5) * PARAMS.jitter;
    const y = Math.sin(angle) * amplitude + h / 2 + (Math.random() - 0.5) * PARAMS.jitter;

    if (i === zoomedFrequencyBandLength / 4) {
      canvasContext.moveTo(x, y);
      initX = x;
      initY = y;
    } else {
      canvasContext.lineTo(x, y);
    }
  }

  canvasContext.lineTo(initX, initY);

  if (PARAMS.fill) {
    canvasContext.fillStyle = PARAMS.fillColor;
    canvasContext.fill();
  }

  canvasContext.stroke();
}


function resize() {
  const devicePixelRatio = window.devicePixelRatio || 1;

  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;

  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';

  canvasContext.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

button.addEventListener("click", () => {
  if (!playing) {
    createContext();
    resize();
    draw();
  }

  if (button.dataset.playing === "false") {
    audioElement.play();
    button.dataset.playing = "true";
    draw();
  } else {
    audioElement.pause();
    button.dataset.playing = "false";
  }
});
