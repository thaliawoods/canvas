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

//   function logFrequencyData() {
//   if (!analyser) return;

//   analyser.getByteFrequencyData(frequencyData);
//   console.log("Fréquences (0-255) :", frequencyData);

//   analyser.getFloatFrequencyData(frequencyDataFloat);
//   console.log("Fréquences (Décibels) :", frequencyDataFloat);


// let frameCount = 0;
//   frameCount++;
//   if (frameCount % 30 !== 0) return;
// }

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
  const drawVisual = requestAnimationFrame(draw);
  analyser.getByteFrequencyData(analyserBuffer as Uint8Array<ArrayBuffer>);
  analyser.getByteTimeDomainData(timeData as Uint8Array<ArrayBuffer>);

  canvasContext.fillStyle = "rgb(200 200 200)";
  canvasContext.fillRect(0, 0, canvas.width, canvas.height);

  canvasContext.lineWidth = 2;
  canvasContext.strokeStyle = "rgb(0 0 0)";
  canvasContext.beginPath();

  const sliceWidth = canvas.width / bufferLength;
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    const v = analyserBuffer[i] / 128.0;
    const y = v * (canvas.height / 2);

    if (i === 0) {
      canvasContext.moveTo(x, y);
    } else {
      canvasContext.lineTo(x, y);
    }

    x += sliceWidth;
  }

  canvasContext.lineTo(canvas.width, canvas.height / 2);
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
