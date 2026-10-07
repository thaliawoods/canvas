console.log('starting')

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

function logFrequencyData() {
  if (!analyser) return;

  analyser.getByteFrequencyData(frequencyData);
  // console.log("Fréquences (0-255) :", frequencyData);

  analyser.getFloatFrequencyData(frequencyDataFloat);
  // console.log("Fréquences (Décibels) :", frequencyDataFloat);

  const max = Math.max(...frequencyDataFloat)

  const min = Math.min(...frequencyDataFloat)

  console.log(max,min)

  return [max, min];
}

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
  const [max, min] = logFrequencyData();
  analyser.getByteFrequencyData(analyserBuffer as Uint8Array<ArrayBuffer>);
  analyser.getByteTimeDomainData(timeData as Uint8Array<ArrayBuffer>);

  canvasContext.fillStyle = "rgb(200 200 200)";
  canvasContext.fillRect(0, 0, canvas.width, canvas.height);

  canvasContext.lineWidth = 2;
  canvasContext.strokeStyle = "rgb(0 0 0)";
  canvasContext.beginPath();

  // on / 4 parce que y'a pleins de frequences inutilisees, elles sont toutes sur le debut du bucket
  const zoomedFrequencyBandLength = bufferLength / 32;
  const sliceWidth = canvas.width / zoomedFrequencyBandLength;
  let x = 0;
  let initX = 0, initY = 0;
  for (let i = 0; i < zoomedFrequencyBandLength; i++) {
    const amplitude = 100 + analyserBuffer[i];
    const normalizedFreqBand = i / zoomedFrequencyBandLength;
    const x = Math.cos(normalizedFreqBand * Math.PI * 2) * amplitude + canvas.width / 2;
    const y = Math.sin(normalizedFreqBand * Math.PI * 2) * amplitude + canvas.height / 2;

    if (i === 0) {
      canvasContext.moveTo(x, y);
      initX = x;
      initY = y;
    } else {
      canvasContext.lineTo(x, y);
    }
  }

  canvasContext.lineTo(initX, initY);
  canvasContext.stroke();
}

function resize() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}

button.addEventListener("click", () => {
  if (!playing) {
    createContext();
    draw();
    resize();
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
