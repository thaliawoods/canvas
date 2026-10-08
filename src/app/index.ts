import {Pane} from 'tweakpane';

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

const PARAMS = {
  size: 50,
  color: '#ffffff',
  theme: 'dark'
};

const pane = new Pane();

pane.addBinding(
  PARAMS, 'color',
  {options: {Red: '#ff0055', Green: '#00ff55', Blue: '#0055ff'}}
);

pane.addBinding(
  PARAMS, 'theme',
  {options: {Dark: 'dark', Light: 'light'}}
);

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


  const w = window.innerWidth;
  const h = window.innerHeight;

  // const [max, min] = logFrequencyData();

  analyser.getByteFrequencyData(analyserBuffer as Uint8Array<ArrayBuffer>);
  analyser.getByteTimeDomainData(timeData as Uint8Array<ArrayBuffer>);

  canvasContext.fillStyle = PARAMS.theme === 'dark' ? 'rgb(60, 58, 58)' : 'rgb(250, 246, 246)';

  canvasContext.fillRect(0, 0, w, h);

  canvasContext.lineWidth = 1;
  canvasContext.strokeStyle = PARAMS.color;
  canvasContext.beginPath();

  // on / 4 parce que y'a pleins de frequences inutilisees, elles sont toutes sur le debut du bucket
  const zoomedFrequencyBandLength = bufferLength / 16;
  let x = 0;
  // pour avoir la fin du cercle
  let initX: number, initY: number;
  // pour chaque frequence 
  for (let i = 0; i < zoomedFrequencyBandLength / 2; i++) {
    // on déclare l'amplitude avec le analyserBuffer (auquel on rajoute 100 pour le cercle)
    const amplitude =  analyserBuffer[i];
    // normalized par rapport au dernier bucket pour finir le cercle
    const normalizedFreqBand = i / zoomedFrequencyBandLength * 2;
    // placer les points de la ligne sur le cercle
    const x = -500 + Math.cos(normalizedFreqBand * Math.PI * 2) * amplitude + w / 2;
    const y = Math.sin(normalizedFreqBand * Math.PI * 2) * amplitude + h / 2;

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
  canvasContext.beginPath();

   x = 0;

  for (let i = zoomedFrequencyBandLength / 2; i < zoomedFrequencyBandLength; i++) {
    const amplitude =   110 + analyserBuffer[i];
    const normalizedFreqBand = i / zoomedFrequencyBandLength * 2;
    const x = 0 + Math.cos(normalizedFreqBand * Math.PI * 2) * amplitude + w / 2;
    const y = Math.sin(normalizedFreqBand * Math.PI * 2) * amplitude + h / 2;

    if (i === zoomedFrequencyBandLength / 2) {
      canvasContext.moveTo(x, y);
      initX = x;
      initY = y;
    } else {
      canvasContext.lineTo(x, y);
    }
  }

  canvasContext.lineTo(initX, initY);
  canvasContext.stroke();
    canvasContext.beginPath();

    x = 0;

    for (let i = zoomedFrequencyBandLength / 4; i < zoomedFrequencyBandLength; i++) {
    const amplitude = analyserBuffer[i];
    const normalizedFreqBand = i / zoomedFrequencyBandLength * 2;
    const x = 500 + Math.cos(normalizedFreqBand * Math.PI * 2) * amplitude + w / 2;
    const y = Math.sin(normalizedFreqBand * Math.PI * 2) * amplitude + h / 2;

    if (i === zoomedFrequencyBandLength / 4) {
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
  const dpr = window.devicePixelRatio || 1;

  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;

  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';

  canvasContext.setTransform(dpr, 0, 0, dpr, 0, 0);
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
