export const AUDIO = {
  // niveau des graves et des aigus, de 0 a 1
  bassLevel: 0,
  trebleLevel: 0,
  bassKick: false,
  trebleKick: false,
};

// a monter si une bande ne declenche jamais, a baisser si ca part trop
export const BANDS = {
  bassGain: 1.4,
  trebleGain: 16,
  // combien de fois au dessus de la moyenne pour parler d'un coup
  threshold: 1.25,
};

// graves -> grosse caisse et basse aigus -> cymbales , on s'arrete a 8000 et pas plus haut, un mp3 a presque rien au dessus
const BASS_HERTZ = [20, 220];
const TREBLE_HERTZ = [1800, 8000];

let bassAverage = 0;
let trebleAverage = 0;

let audioContext: AudioContext;
let analyser: AnalyserNode;
let frequencyBuffer: Uint8Array;

export function createAudio(audioElement: HTMLAudioElement) {
  audioContext = new AudioContext();

  // des fois il nait "suspended" et du coup l'analyseur recoit rien
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const source = audioContext.createMediaElementSource(audioElement);

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 32768;

  source.connect(analyser);
  analyser.connect(audioContext.destination);

  frequencyBuffer = new Uint8Array(analyser.frequencyBinCount);

  return {
    frequencyBuffer,
    frequencyBinCount: analyser.frequencyBinCount,
  };
}

// moyenne de l'energie entre deux frequences, ramenee de 0..255 a 0..1 pour passer d'une frequence a un bucket on divise par la frequence max analysable, qui est la moitie du sample rate
function averageBandLevel(minimumHertz: number, maximumHertz: number): number {
  const maximumAnalysableHertz = audioContext.sampleRate / 2;
  const binCount = analyser.frequencyBinCount;

  const startBin = Math.floor(minimumHertz / maximumAnalysableHertz * binCount);
  const endBin = Math.ceil(maximumHertz / maximumAnalysableHertz * binCount);

  let total = 0;
  for (let binIndex = startBin; binIndex < endBin; binIndex++) {
    total += frequencyBuffer[binIndex];
  }

  return total / (endBin - startBin) / 255;
}

export function updateAudio() {
  if (!analyser) return;

  analyser.getByteFrequencyData(frequencyBuffer as Uint8Array<ArrayBuffer>);

  const bass = Math.min(1, averageBandLevel(BASS_HERTZ[0], BASS_HERTZ[1]) * BANDS.bassGain);
  const treble = Math.min(1, averageBandLevel(TREBLE_HERTZ[0], TREBLE_HERTZ[1]) * BANDS.trebleGain);

  // un coup = un instant plus fort que la moyenne de sa bande -> le > 0.02 vire le silence, au debut la moyenne vaut 0 et tout la depasse
  AUDIO.bassKick = bass > 0.02 && bass > bassAverage * BANDS.threshold;
  AUDIO.trebleKick = treble > 0.02 && treble > trebleAverage * BANDS.threshold;

  // les moyennes se mettent a jour apres, sinon le coup se mange lui meme
  bassAverage = bassAverage + (bass - bassAverage) * 0.02;
  trebleAverage = trebleAverage + (treble - trebleAverage) * 0.02;

  AUDIO.bassLevel = bass;
  AUDIO.trebleLevel = treble;
}
