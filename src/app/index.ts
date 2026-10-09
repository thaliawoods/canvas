import { createGUI } from "./gui";
import { AUDIO, createAudio, updateAudio } from "./audio";

const audioElement = document.querySelector("audio")!;
const canvas = document.querySelector("canvas")!;
const returnButton = document.querySelector<HTMLButtonElement>("#return")!;
const trackButtons =
  document.querySelectorAll<HTMLButtonElement>("#tracks button");
const canvasContext = canvas.getContext("2d")!;

let frequencyBuffer: Uint8Array;
let frequencyBinCount: number;
let playing = false;

// pour spin
let frame = 0;

// l'angle de rotation qu'on accumule au fil des frames
let rotation = 0;

// coup de rotation ponctuel sur les aigus
let spinBurst = 0;

export const SPIN_BURST = {
  // de combien on pousse la rotation sur un coup -> en degres par frame
  strength: 6,
  decay: 0.92,
  max: 18,
  cooldown: 5,
};

// la frame du dernier coup de rotation
let lastBurstFrame = 0;

const TOP_OFFSET_RATIO = 0.3;
const BOTTOM_OFFSET_RATIO = 0.28;
const TOP_SCALE = 0.55;
const BOTTOM_SCALE = 0.45;

const CENTER_INNER_SCALE = 0.5;

const MIDDLE_SPREAD_FACTOR = 1.15;
const CORNER_SPREAD_FACTOR = 0.83;

// de combien le dessin reagit a la musique
export const MUSIC = {
  // les graves font gonfler tout le dessin d'un coup
  bassPunch: 0.5,

  // exagere la forme
  shapeContrast: 1.5,

  // le trait s'affine quand aigus
  thinFromTreble: 0.5,
};

const LINE_WIDTH = 1.4;

// la valeur d'un bucket, exageree selon shapeContrast
function shapedLevel(binIndex: number): number {
  return Math.pow(frequencyBuffer[binIndex] / 255, MUSIC.shapeContrast) * 255;
}

const RADIUS_MARGIN = 0.37;

const SCREEN_MARGIN = 50;

function fitsOnScreen(
  centerX: number,
  centerY: number,
  radius: number,
): boolean {
  return (
    centerX - radius >= SCREEN_MARGIN &&
    centerX + radius <= window.innerWidth - SCREEN_MARGIN &&
    centerY - radius >= SCREEN_MARGIN &&
    centerY + radius <= window.innerHeight - SCREEN_MARGIN
  );
}

// le nombre de cercles depend de la place (3 ou 7)
function countCircles(screenWidth: number): number {
  if (screenWidth < 1100) return 3;

  return 7;
}

export const PARAMS = {
  color: "#ffffff",
  theme: "light",
  dash: 0,
  trail: 1,
  jitter: 0,
  spin: 0,
  amplitude: 2,
  spread: 380,
  offsetY: 1,
  smallScale: 1,
};

export const TARGET = {
  trail: 1,
  jitter: 0,
  dash: 0,
  spin: 0,
  amplitude: 2,
  spread: 380,
  offsetY: 1,
  smallScale: 1,
};

export type Params = typeof PARAMS;
export type Target = typeof TARGET;

// vitesse du glissement -> 0.01 c'est tres lent et 0.3 presque instantane
const SMOOTHING = 0.04;

const PALETTE_LIGHT = [
  // '#7a1f1f', 
  // '#ba2525', 
  // '#ff7f6b',
  // '#f4c6bf', 
  // '#a9c7de', 
  // '#c9dbe9', 
  // '#1b2447', 
  // '#465488', 
  "#020202", 
];

const PALETTE_DARK = [
  // '#ff7f6b', 
  // '#f4c6bf', 
  // '#c9dbe9', 
  // '#a9c7de', 
  "#f5f2ef", 
];

const LOOKS = [
  {
    trail: 1,
    dash: 0,
    jitter: 0,
    spin: 0.07,
    amplitude: 1.65,
    spread: 320,
    offsetY: 0.98,
    circles: 7,
    smallScale: 1,
  },
  // petite, plus ecartee et peu de cercles
  {
    trail: 0.85,
    dash: 0,
    jitter: 0,
    spin: 0,
    amplitude: 1.21,
    spread: 360,
    offsetY: 1,
    circles: 3,
    smallScale: 1.3,
  },
  // la plus grosse, moins ecartee sinon les cotes sortent
  {
    trail: 0.8,
    dash: 9,
    jitter: 0,
    spin: 0.11,
    amplitude: 2.05,
    spread: 280,
    offsetY: 1,
    circles: 3,
    smallScale: 0.7,
  },
  // celle qui tremble
  {
    trail: 1,
    dash: 0,
    jitter: 5,
    spin: 0,
    amplitude: 1.38,
    spread: 345,
    offsetY: 0.92,
    circles: 7,
    smallScale: 1.4,
  },
  // tous les cercles se posent exactement au meme endroit
  {
    trail: 1,
    dash: 4,
    jitter: 0,
    spin: -0.06,
    amplitude: 2,
    spread: 0,
    offsetY: 0,
    circles: 7,
    smallScale: 0.9,
  },
];

let lookIndex = 0;
let colorIndex = 0;

// quand auto est coupe plus des changement d'ambiance 
export const AUTO = {
  autoLooks: true,
};

let wantedCircles = 7;

let lastLookFrame = 0;
let lastColorFrame = 0;

// delai minimum entre deux changements en secondes
const DELAYS = {
  look: 2,
  color: 1.2,
};

const pane = createGUI(PARAMS, TARGET, DELAYS, AUTO, MUSIC, SPIN_BURST);

// rapproche `from` de `to` de 4% de la distance qui les separe et appele a chaque frame -> comme la distance retrecit, le pas retrecit aussi donc ça freine 
function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function updateParams() {
  PARAMS.trail = lerp(PARAMS.trail, TARGET.trail, SMOOTHING);
  PARAMS.jitter = lerp(PARAMS.jitter, TARGET.jitter, SMOOTHING);
  PARAMS.dash = lerp(PARAMS.dash, TARGET.dash, SMOOTHING);
  PARAMS.spin = lerp(PARAMS.spin, TARGET.spin, SMOOTHING);
  PARAMS.amplitude = lerp(PARAMS.amplitude, TARGET.amplitude, SMOOTHING);
  PARAMS.spread = lerp(PARAMS.spread, TARGET.spread, SMOOTHING);
  PARAMS.offsetY = lerp(PARAMS.offsetY, TARGET.offsetY, SMOOTHING);
  PARAMS.smallScale = lerp(PARAMS.smallScale, TARGET.smallScale, SMOOTHING);
}

function startAnimation() {
  PARAMS.amplitude = 2.6;
  PARAMS.spread = 0;
  PARAMS.offsetY = 0;
  PARAMS.smallScale = 1;
  PARAMS.jitter = 0;
  PARAMS.dash = 0;
  PARAMS.trail = 1;

  PARAMS.spin = 1.6;

  lookIndex = 2;
  const look = LOOKS[lookIndex];

  TARGET.trail = look.trail;
  TARGET.jitter = look.jitter;
  TARGET.dash = look.dash;
  TARGET.spin = look.spin;
  TARGET.amplitude = look.amplitude;
  TARGET.spread = look.spread;

  colorIndex = 0;

  lastLookFrame = frame;
  lastColorFrame = frame;

  pane.refresh();
}

function draw() {
  requestAnimationFrame(draw);

  // pour le spin
  frame++;

  // un coup dans les aigus donne une impulsion de rotation mais ponctuellement
  if (AUDIO.trebleKick && frame - lastBurstFrame > SPIN_BURST.cooldown * 60) {
    spinBurst = Math.min(SPIN_BURST.max, spinBurst + SPIN_BURST.strength);
    lastBurstFrame = frame;
  }

  // l'impulsion retombe toute seule
  spinBurst *= SPIN_BURST.decay;

  // on avance la rotation : la vitesse de l'ambiance, plus l'impulsion
  rotation += ((PARAMS.spin + spinBurst) * Math.PI) / 180;

  updateAudio();
  updateParams();

  // un coup de grosse caisse -> ambiance suivante
  if (
    AUTO.autoLooks &&
    AUDIO.bassKick &&
    frame - lastLookFrame > DELAYS.look * 60
  ) {
    lookIndex = (lookIndex + 1) % LOOKS.length;
    const look = LOOKS[lookIndex];

    TARGET.trail = look.trail;
    TARGET.jitter = look.jitter;
    TARGET.dash = look.dash;
    TARGET.spin = look.spin;
    TARGET.amplitude = look.amplitude;
    TARGET.spread = look.spread;
    TARGET.offsetY = look.offsetY;
    TARGET.smallScale = look.smallScale;
    wantedCircles = look.circles;

    lastLookFrame = frame;
  }

  // un coup dans les aigus -> couleur suivante
  if (AUDIO.trebleKick && frame - lastColorFrame > DELAYS.color * 60) {
    colorIndex = colorIndex + 1;
    lastColorFrame = frame;
  }

  // la couleur du trait suit le theme
  const palette = PARAMS.theme === "dark" ? PALETTE_DARK : PALETTE_LIGHT;
  PARAMS.color = palette[colorIndex % palette.length];

  // les graves font gonfler tout le dessin
  const amplitudeNow =
    PARAMS.amplitude * (1 + AUDIO.bassLevel * MUSIC.bassPunch);

  const canvasWidth = window.innerWidth;
  const canvasHeight = window.innerHeight;

  // le nombre -> plafonne par la place dispo
  const circleCount = Math.min(countCircles(canvasWidth), wantedCircles);

  // les positions et les rayons de reference, pour savoir qui tient l'ecartement reel de chaque groupe
  const middleSpread = PARAMS.spread * MIDDLE_SPREAD_FACTOR;
  const cornerSpread = PARAMS.spread * CORNER_SPREAD_FACTOR;

  const middleX = canvasWidth / 2;
  const middleY = canvasHeight / 2;
  const topY = middleY - canvasHeight * TOP_OFFSET_RATIO * PARAMS.offsetY;
  const bottomY = middleY + canvasHeight * BOTTOM_OFFSET_RATIO * PARAMS.offsetY;

  const plainRadius = 255 * PARAMS.amplitude * RADIUS_MARGIN;
  const centerRadius = (110 + 255) * PARAMS.amplitude * RADIUS_MARGIN;
  const topRadius = plainRadius * TOP_SCALE * PARAMS.smallScale;
  const bottomRadius = plainRadius * BOTTOM_SCALE * PARAMS.smallScale;

  const showLeft = fitsOnScreen(middleX - middleSpread, middleY, plainRadius);
  const showCenter = fitsOnScreen(middleX, middleY, centerRadius);
  const showRight = fitsOnScreen(middleX + middleSpread, middleY, plainRadius);
  const showTopLeft =
    circleCount >= 5 && fitsOnScreen(middleX - cornerSpread, topY, topRadius);
  const showTopRight =
    circleCount >= 5 && fitsOnScreen(middleX + cornerSpread, topY, topRadius);
  const showBottomLeft =
    circleCount >= 7 &&
    fitsOnScreen(middleX - cornerSpread, bottomY, bottomRadius);
  const showBottomRight =
    circleCount >= 7 &&
    fitsOnScreen(middleX + cornerSpread, bottomY, bottomRadius);

  // on efface jamais vraiment, on pose un voile de la couleur du fond.
  // trail a 1 = effacement total donc pas de trainee, 0.8 = trainee courte
  canvasContext.fillStyle =
    PARAMS.theme === "dark"
      ? `rgba(60, 58, 58, ${PARAMS.trail})`
      : `rgba(250, 246, 246, ${PARAMS.trail})`;

  canvasContext.fillRect(0, 0, canvasWidth, canvasHeight);

  // le trait s'affine quand les aigus brillent
  canvasContext.lineWidth = Math.max(
    0.2,
    LINE_WIDTH * (1 - AUDIO.trebleLevel * MUSIC.thinFromTreble),
  );
  canvasContext.strokeStyle = PARAMS.color;
  canvasContext.setLineDash(PARAMS.dash > 1 ? [PARAMS.dash, PARAMS.dash] : []);

  // on / 4 parce que y'a pleins de frequences inutilisees, elles sont toutes sur le debut du bucket
  const zoomedFrequencyBandLength = frequencyBinCount / 16;
  // pour avoir la fin du cercle
  let firstPointX = 0;
  let firstPointY = 0;

  // cercle 1
  if (showLeft) {
    const offset1 = -middleSpread;

    canvasContext.beginPath();

    // pour chaque frequence
    for (
      let frequencyIndex = 0;
      frequencyIndex < zoomedFrequencyBandLength / 2;
      frequencyIndex++
    ) {
      // on déclare l'amplitude avec le analyserBuffer (auquel on rajoute 100 pour le cercle)
      // amplitude -> on multiplie tout par le facteur d'echelle
      const amplitude = shapedLevel(frequencyIndex) * amplitudeNow;
      // normalized par rapport au dernier bucket pour finir le cercle
      const normalizedFrequencyBand =
        (frequencyIndex / zoomedFrequencyBandLength) * 2;
      // spin -> on ajoute a l'angle un petit decalage qui grandit a chaque frame
      // * Math.PI / 180 parce que spin est en degres et Math.cos attend des radians
      const angle = normalizedFrequencyBand * Math.PI * 2 + rotation;
      // placer les points de la ligne sur le cercle
      // jitter -> Math.random() donne 0 a 1, on retire 0.5 pour le recentrer sur -0.5 a +0.5, sinon le decalage partirait toujours dans le meme sens
      const pointX =
        offset1 +
        Math.cos(angle) * amplitude +
        canvasWidth / 2 +
        (Math.random() - 0.5) * PARAMS.jitter;
      const pointY =
        Math.sin(angle) * amplitude +
        canvasHeight / 2 +
        (Math.random() - 0.5) * PARAMS.jitter;

      if (frequencyIndex === 0) {
        canvasContext.moveTo(pointX, pointY);
        firstPointX = pointX;
        firstPointY = pointY;
      } else {
        canvasContext.lineTo(pointX, pointY);
      }
    }

    canvasContext.lineTo(firstPointX, firstPointY);

    canvasContext.stroke();
  }

  // cercle 2 
  if (showCenter) {
    const offset2 = 0;

    canvasContext.beginPath();

    for (
      let frequencyIndex = zoomedFrequencyBandLength / 2;
      frequencyIndex < zoomedFrequencyBandLength;
      frequencyIndex++
    ) {
      const amplitude = (110 + shapedLevel(frequencyIndex)) * amplitudeNow;
      const normalizedFrequencyBand =
        (frequencyIndex / zoomedFrequencyBandLength) * 2;
      const angle = normalizedFrequencyBand * Math.PI * 2 + rotation;
      const pointX =
        offset2 +
        Math.cos(angle) * amplitude +
        canvasWidth / 2 +
        (Math.random() - 0.5) * PARAMS.jitter;
      const pointY =
        Math.sin(angle) * amplitude +
        canvasHeight / 2 +
        (Math.random() - 0.5) * PARAMS.jitter;

      if (frequencyIndex === zoomedFrequencyBandLength / 2) {
        canvasContext.moveTo(pointX, pointY);
        firstPointX = pointX;
        firstPointY = pointY;
      } else {
        canvasContext.lineTo(pointX, pointY);
      }
    }

    canvasContext.lineTo(firstPointX, firstPointY);

    canvasContext.stroke();
  }

  // cercle dans celui du milieu
  if (showCenter) {
    canvasContext.beginPath();

    for (
      let frequencyIndex = zoomedFrequencyBandLength / 2;
      frequencyIndex < zoomedFrequencyBandLength;
      frequencyIndex++
    ) {
      const amplitude =
        shapedLevel(frequencyIndex) * amplitudeNow * CENTER_INNER_SCALE;
      const normalizedFrequencyBand =
        (frequencyIndex / zoomedFrequencyBandLength) * 2;
      const angle = normalizedFrequencyBand * Math.PI * 2 + rotation;
      const pointX =
        Math.cos(angle) * amplitude +
        canvasWidth / 2 +
        (Math.random() - 0.5) * PARAMS.jitter;
      const pointY =
        Math.sin(angle) * amplitude +
        canvasHeight / 2 +
        (Math.random() - 0.5) * PARAMS.jitter;

      if (frequencyIndex === zoomedFrequencyBandLength / 2) {
        canvasContext.moveTo(pointX, pointY);
        firstPointX = pointX;
        firstPointY = pointY;
      } else {
        canvasContext.lineTo(pointX, pointY);
      }
    }

    canvasContext.lineTo(firstPointX, firstPointY);

    canvasContext.stroke();
  }

  // cercle 3
  if (showRight) {
    const offset3 = middleSpread;

    canvasContext.beginPath();

    const thirdCircleStart = zoomedFrequencyBandLength / 4;
    const thirdCircleSpan = zoomedFrequencyBandLength - thirdCircleStart;

    for (
      let frequencyIndex = thirdCircleStart;
      frequencyIndex < zoomedFrequencyBandLength;
      frequencyIndex++
    ) {
      const amplitude = shapedLevel(frequencyIndex) * amplitudeNow;
      const normalizedFrequencyBand =
        (frequencyIndex - thirdCircleStart) / thirdCircleSpan;
      const angle = normalizedFrequencyBand * Math.PI * 2 + rotation;
      const pointX =
        offset3 +
        Math.cos(angle) * amplitude +
        canvasWidth / 2 +
        (Math.random() - 0.5) * PARAMS.jitter;
      const pointY =
        Math.sin(angle) * amplitude +
        canvasHeight / 2 +
        (Math.random() - 0.5) * PARAMS.jitter;

      if (frequencyIndex === thirdCircleStart) {
        canvasContext.moveTo(pointX, pointY);
        firstPointX = pointX;
        firstPointY = pointY;
      } else {
        canvasContext.lineTo(pointX, pointY);
      }
    }

    canvasContext.lineTo(firstPointX, firstPointY);

    canvasContext.stroke();
  }

  // cercle 4 
  if (showTopLeft) {
    const offset4 = -cornerSpread;
    const topLeftSpan = zoomedFrequencyBandLength / 4;

    canvasContext.beginPath();

    for (
      let frequencyIndex = 0;
      frequencyIndex < topLeftSpan;
      frequencyIndex++
    ) {
      const amplitude =
        shapedLevel(frequencyIndex) *
        amplitudeNow *
        TOP_SCALE *
        PARAMS.smallScale;
      const normalizedFrequencyBand = frequencyIndex / topLeftSpan;
      const angle = normalizedFrequencyBand * Math.PI * 2 + rotation;
      const pointX =
        offset4 +
        Math.cos(angle) * amplitude +
        canvasWidth / 2 +
        (Math.random() - 0.5) * PARAMS.jitter;
      const pointY =
        Math.sin(angle) * amplitude +
        canvasHeight / 2 -
        canvasHeight * TOP_OFFSET_RATIO * PARAMS.offsetY +
        (Math.random() - 0.5) * PARAMS.jitter;

      if (frequencyIndex === 0) {
        canvasContext.moveTo(pointX, pointY);
        firstPointX = pointX;
        firstPointY = pointY;
      } else {
        canvasContext.lineTo(pointX, pointY);
      }
    }

    canvasContext.lineTo(firstPointX, firstPointY);

    canvasContext.stroke();
  }

  // cercle 5 
  if (showTopRight) {
    const offset5 = cornerSpread;
    const topRightStart = zoomedFrequencyBandLength / 2;
    const topRightSpan = zoomedFrequencyBandLength / 4;

    canvasContext.beginPath();

    for (
      let frequencyIndex = topRightStart;
      frequencyIndex < topRightStart + topRightSpan;
      frequencyIndex++
    ) {
      const amplitude =
        shapedLevel(frequencyIndex) *
        amplitudeNow *
        TOP_SCALE *
        PARAMS.smallScale;
      const normalizedFrequencyBand =
        (frequencyIndex - topRightStart) / topRightSpan;
      const angle = normalizedFrequencyBand * Math.PI * 2 + rotation;
      const pointX =
        offset5 +
        Math.cos(angle) * amplitude +
        canvasWidth / 2 +
        (Math.random() - 0.5) * PARAMS.jitter;
      const pointY =
        Math.sin(angle) * amplitude +
        canvasHeight / 2 -
        canvasHeight * TOP_OFFSET_RATIO * PARAMS.offsetY +
        (Math.random() - 0.5) * PARAMS.jitter;

      if (frequencyIndex === topRightStart) {
        canvasContext.moveTo(pointX, pointY);
        firstPointX = pointX;
        firstPointY = pointY;
      } else {
        canvasContext.lineTo(pointX, pointY);
      }
    }

    canvasContext.lineTo(firstPointX, firstPointY);

    canvasContext.stroke();
  }

  // cercle 6
  if (showBottomLeft) {
    const offset6 = -cornerSpread;
    const bottomLeftStart = zoomedFrequencyBandLength / 4;
    const bottomLeftSpan = zoomedFrequencyBandLength / 4;

    canvasContext.beginPath();

    for (
      let frequencyIndex = bottomLeftStart;
      frequencyIndex < bottomLeftStart + bottomLeftSpan;
      frequencyIndex++
    ) {
      const amplitude =
        shapedLevel(frequencyIndex) *
        amplitudeNow *
        BOTTOM_SCALE *
        PARAMS.smallScale;
      const normalizedFrequencyBand =
        (frequencyIndex - bottomLeftStart) / bottomLeftSpan;
      const angle = normalizedFrequencyBand * Math.PI * 2 + rotation;
      const pointX =
        offset6 +
        Math.cos(angle) * amplitude +
        canvasWidth / 2 +
        (Math.random() - 0.5) * PARAMS.jitter;
      const pointY =
        Math.sin(angle) * amplitude +
        canvasHeight / 2 +
        canvasHeight * BOTTOM_OFFSET_RATIO * PARAMS.offsetY +
        (Math.random() - 0.5) * PARAMS.jitter;

      if (frequencyIndex === bottomLeftStart) {
        canvasContext.moveTo(pointX, pointY);
        firstPointX = pointX;
        firstPointY = pointY;
      } else {
        canvasContext.lineTo(pointX, pointY);
      }
    }

    canvasContext.lineTo(firstPointX, firstPointY);

    canvasContext.stroke();
  }

  //  cercle 7
  if (showBottomRight) {
    const offset7 = cornerSpread;
    const bottomRightStart = (zoomedFrequencyBandLength * 3) / 4;
    const bottomRightSpan = zoomedFrequencyBandLength / 4;

    canvasContext.beginPath();

    for (
      let frequencyIndex = bottomRightStart;
      frequencyIndex < zoomedFrequencyBandLength;
      frequencyIndex++
    ) {
      const amplitude =
        shapedLevel(frequencyIndex) *
        amplitudeNow *
        BOTTOM_SCALE *
        PARAMS.smallScale;
      const normalizedFrequencyBand =
        (frequencyIndex - bottomRightStart) / bottomRightSpan;
      const angle = normalizedFrequencyBand * Math.PI * 2 + rotation;
      const pointX =
        offset7 +
        Math.cos(angle) * amplitude +
        canvasWidth / 2 +
        (Math.random() - 0.5) * PARAMS.jitter;
      const pointY =
        Math.sin(angle) * amplitude +
        canvasHeight / 2 +
        canvasHeight * BOTTOM_OFFSET_RATIO * PARAMS.offsetY +
        (Math.random() - 0.5) * PARAMS.jitter;

      if (frequencyIndex === bottomRightStart) {
        canvasContext.moveTo(pointX, pointY);
        firstPointX = pointX;
        firstPointY = pointY;
      } else {
        canvasContext.lineTo(pointX, pointY);
      }
    }

    canvasContext.lineTo(firstPointX, firstPointY);

    canvasContext.stroke();
  }
}

function resize() {
  const devicePixelRatio = window.devicePixelRatio || 1;

  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;

  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";

  canvasContext.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

trackButtons.forEach((trackButton) => {
  trackButton.addEventListener("click", () => {
    const src = trackButton.dataset.src!;

    audioElement.src = src;

    if (!playing) {
      const audio = createAudio(audioElement);
      frequencyBuffer = audio.frequencyBuffer;
      frequencyBinCount = audio.frequencyBinCount;
      playing = true;

      resize();
      startAnimation();
      draw();
    }

    audioElement.play();

    document.body.dataset.view = "canvas";
  });
});

returnButton.addEventListener("click", () => {
  document.body.dataset.view = "intro";

  audioElement.pause();
});
