import { createGUI } from "./gui";
import { AUDIO, createAudio, updateAudio } from "./audio";

const audioElement = document.querySelector("audio")!;
const canvas = document.querySelector("canvas")!;
const returnButton = document.querySelector<HTMLButtonElement>("#return")!;
const trackButtons =
  document.querySelectorAll<HTMLButtonElement>("#tracks button");
const ownTrackInput =
  document.querySelector<HTMLInputElement>("#bring-your-own input")!;
const toggleButton = document.querySelector<HTMLButtonElement>("#toggle")!;
const seekInput = document.querySelector<HTMLInputElement>("#seek")!;
const timeLabel = document.querySelector<HTMLSpanElement>("#time")!;
const canvasContext = canvas.getContext("2d")!;

// la taille de la zone de dessin, mise a jour par resize()
// on les garde ici plutot que de lire window.innerWidth dans draw : sur mobile
// la barre d'url qui se retracte change innerHeight en plein milieu d'une frame
let viewWidth = 0;
let viewHeight = 0;

// tout le dessin a ete cale a la main sur un ecran de 900 de haut, donc on compare a ca
const REFERENCE_SIZE = 900;

// la taille de l'ecran par rapport a la reference, sans rien d'autre.
// on prend le plus petit cote sinon un ecran large et bas deborderait en hauteur.
// c'est lui qui sert aux marges : elles suivent l'ecran, pas le dessin
let viewScale = 1;

// combien on agrandit le trace lui meme : la taille de l'ecran, plus le
// rattrapage du nombre de cercles. separe de viewScale, sinon agrandir le
// dessin agrandirait la marge, qui le re-retrecirait aussitot
let screenScale = 1;

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

// la bande laissee libre en bas pour les commandes de lecture.
// le dessin se recentre dans ce qui reste, sinon il parait pousse vers le bas
const CONTROLS_SPACE = 72;

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
  // la marge aussi doit retrecir, sinon elle mange tout l'ecran sur un telephone
  const margin = SCREEN_MARGIN * viewScale;

  return (
    centerX - radius >= margin &&
    centerX + radius <= viewWidth - margin &&
    centerY - radius >= margin &&
    centerY + radius <= viewHeight - margin
  );
}

// quand une frequence tape fort le point part tres loin et sort de l'ecran.
// tanh ecrase les grandes valeurs sans toucher aux petites : sous le plafond
// le trait garde sa forme exacte, au dessus il sature au lieu de deborder.
// c'est le principe d'un limiteur en audio, pas un ciseau qui coupe net
function softCap(value: number, maximum: number): number {
  return maximum * Math.tanh(value / maximum);
}

// la place qui reste entre le centre d'un cercle et le bord le plus proche
function maxRadiusAt(centerX: number, centerY: number): number {
  const margin = SCREEN_MARGIN * viewScale;

  return Math.max(
    10,
    Math.min(
      centerX - margin,
      viewWidth - margin - centerX,
      centerY - margin,
      viewHeight - margin - centerY,
    ),
  );
}

// le nombre de cercles depend de la place (1, 3 ou 7)
// en dessous de 700 un seul gros cercle se lit mieux que trois minuscules
function countCircles(screenWidth: number): number {
  if (screenWidth < 700) return 1;
  if (screenWidth < 1100) return 3;

  return 7;
}

// sept cercles se partagent la largeur, donc chacun doit rester petit.
// quand il n'en reste qu'un il a toute la place pour lui, et une echelle
// calculee seulement sur la taille de l'ecran le laisserait ridiculement maigre
function layoutBoost(screenWidth: number): number {
  if (screenWidth < 700) return 1.9;
  if (screenWidth < 1100) return 1.35;

  return 1;
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
  // screenScale est ici parce que chaque point du dessin passe par amplitudeNow :
  // le mettre a un seul endroit suffit a mettre tout le trace a l'echelle
  const amplitudeNow =
    PARAMS.amplitude * (1 + AUDIO.bassLevel * MUSIC.bassPunch) * screenScale;

  // le tremblement et les pointilles sont en pixels, donc ils retrecissent aussi
  const jitterNow = PARAMS.jitter * screenScale;
  const dashNow = PARAMS.dash * screenScale;

  const canvasWidth = viewWidth;
  const canvasHeight = viewHeight;

  // le nombre -> plafonne par la place dispo
  const circleCount = Math.min(countCircles(canvasWidth), wantedCircles);

  // les positions et les rayons de reference, pour savoir qui tient l'ecartement reel de chaque groupe
  const middleSpread = PARAMS.spread * MIDDLE_SPREAD_FACTOR * screenScale;
  const cornerSpread = PARAMS.spread * CORNER_SPREAD_FACTOR * screenScale;

  const middleX = canvasWidth / 2;
  // pas canvasHeight / 2 : on centre sur la hauteur moins la bande des commandes
  const middleY = (canvasHeight - CONTROLS_SPACE) / 2;
  const topY = middleY - canvasHeight * TOP_OFFSET_RATIO * PARAMS.offsetY;
  const bottomY = middleY + canvasHeight * BOTTOM_OFFSET_RATIO * PARAMS.offsetY;

  const plainRadius = 255 * PARAMS.amplitude * RADIUS_MARGIN * screenScale;
  const centerRadius =
    (110 + 255) * PARAMS.amplitude * RADIUS_MARGIN * screenScale;
  const topRadius = plainRadius * TOP_SCALE * PARAMS.smallScale;
  const bottomRadius = plainRadius * BOTTOM_SCALE * PARAMS.smallScale;

  const showLeft =
    circleCount >= 3 && fitsOnScreen(middleX - middleSpread, middleY, plainRadius);
  // quand le centre est le seul cercle on ne le filtre pas : sur certaines
  // ambiances il ne passerait pas le test et l'ecran se retrouverait vide
  const showCenter =
    circleCount === 1 || fitsOnScreen(middleX, middleY, centerRadius);
  const showRight =
    circleCount >= 3 && fitsOnScreen(middleX + middleSpread, middleY, plainRadius);
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

  // chaque cercle a son propre plafond : celui du bord vers lequel il penche
  const maxLeft = maxRadiusAt(middleX - middleSpread, middleY);
  const maxCenter = maxRadiusAt(middleX, middleY);
  const maxRight = maxRadiusAt(middleX + middleSpread, middleY);
  const maxTopLeft = maxRadiusAt(middleX - cornerSpread, topY);
  const maxTopRight = maxRadiusAt(middleX + cornerSpread, topY);
  const maxBottomLeft = maxRadiusAt(middleX - cornerSpread, bottomY);
  const maxBottomRight = maxRadiusAt(middleX + cornerSpread, bottomY);

  // on efface jamais vraiment, on pose un voile de la couleur du fond.
  // trail a 1 = effacement total donc pas de trainee, 0.8 = trainee courte
  canvasContext.fillStyle =
    PARAMS.theme === "dark"
      ? `rgba(60, 58, 58, ${PARAMS.trail})`
      : `rgba(250, 246, 246, ${PARAMS.trail})`;

  canvasContext.fillRect(0, 0, canvasWidth, canvasHeight);

  // le trait s'affine quand les aigus 
  canvasContext.lineWidth = Math.max(
    0.2,
    LINE_WIDTH * (1 - AUDIO.trebleLevel * MUSIC.thinFromTreble),
  );
  canvasContext.strokeStyle = PARAMS.color;
  canvasContext.setLineDash(dashNow > 1 ? [dashNow, dashNow] : []);

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
      const amplitude = softCap(
        shapedLevel(frequencyIndex) * amplitudeNow,
        maxLeft,
      );
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
        (Math.random() - 0.5) * jitterNow;
      const pointY =
        Math.sin(angle) * amplitude +
        middleY +
        (Math.random() - 0.5) * jitterNow;

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
      const amplitude = softCap(
        (110 + shapedLevel(frequencyIndex)) * amplitudeNow,
        maxCenter,
      );
      const normalizedFrequencyBand =
        (frequencyIndex / zoomedFrequencyBandLength) * 2;
      const angle = normalizedFrequencyBand * Math.PI * 2 + rotation;
      const pointX =
        offset2 +
        Math.cos(angle) * amplitude +
        canvasWidth / 2 +
        (Math.random() - 0.5) * jitterNow;
      const pointY =
        Math.sin(angle) * amplitude +
        middleY +
        (Math.random() - 0.5) * jitterNow;

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
      const amplitude = softCap(
        shapedLevel(frequencyIndex) * amplitudeNow * CENTER_INNER_SCALE,
        maxCenter,
      );
      const normalizedFrequencyBand =
        (frequencyIndex / zoomedFrequencyBandLength) * 2;
      const angle = normalizedFrequencyBand * Math.PI * 2 + rotation;
      const pointX =
        Math.cos(angle) * amplitude +
        canvasWidth / 2 +
        (Math.random() - 0.5) * jitterNow;
      const pointY =
        Math.sin(angle) * amplitude +
        middleY +
        (Math.random() - 0.5) * jitterNow;

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
      const amplitude = softCap(
        shapedLevel(frequencyIndex) * amplitudeNow,
        maxRight,
      );
      const normalizedFrequencyBand =
        (frequencyIndex - thirdCircleStart) / thirdCircleSpan;
      const angle = normalizedFrequencyBand * Math.PI * 2 + rotation;
      const pointX =
        offset3 +
        Math.cos(angle) * amplitude +
        canvasWidth / 2 +
        (Math.random() - 0.5) * jitterNow;
      const pointY =
        Math.sin(angle) * amplitude +
        middleY +
        (Math.random() - 0.5) * jitterNow;

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
      const amplitude = softCap(
        shapedLevel(frequencyIndex) * amplitudeNow * TOP_SCALE * PARAMS.smallScale,
        maxTopLeft,
      );
      const normalizedFrequencyBand = frequencyIndex / topLeftSpan;
      const angle = normalizedFrequencyBand * Math.PI * 2 + rotation;
      const pointX =
        offset4 +
        Math.cos(angle) * amplitude +
        canvasWidth / 2 +
        (Math.random() - 0.5) * jitterNow;
      const pointY =
        Math.sin(angle) * amplitude +
        middleY -
        canvasHeight * TOP_OFFSET_RATIO * PARAMS.offsetY +
        (Math.random() - 0.5) * jitterNow;

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
      const amplitude = softCap(
        shapedLevel(frequencyIndex) * amplitudeNow * TOP_SCALE * PARAMS.smallScale,
        maxTopRight,
      );
      const normalizedFrequencyBand =
        (frequencyIndex - topRightStart) / topRightSpan;
      const angle = normalizedFrequencyBand * Math.PI * 2 + rotation;
      const pointX =
        offset5 +
        Math.cos(angle) * amplitude +
        canvasWidth / 2 +
        (Math.random() - 0.5) * jitterNow;
      const pointY =
        Math.sin(angle) * amplitude +
        middleY -
        canvasHeight * TOP_OFFSET_RATIO * PARAMS.offsetY +
        (Math.random() - 0.5) * jitterNow;

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
      const amplitude = softCap(
        shapedLevel(frequencyIndex) * amplitudeNow * BOTTOM_SCALE * PARAMS.smallScale,
        maxBottomLeft,
      );
      const normalizedFrequencyBand =
        (frequencyIndex - bottomLeftStart) / bottomLeftSpan;
      const angle = normalizedFrequencyBand * Math.PI * 2 + rotation;
      const pointX =
        offset6 +
        Math.cos(angle) * amplitude +
        canvasWidth / 2 +
        (Math.random() - 0.5) * jitterNow;
      const pointY =
        Math.sin(angle) * amplitude +
        middleY +
        canvasHeight * BOTTOM_OFFSET_RATIO * PARAMS.offsetY +
        (Math.random() - 0.5) * jitterNow;

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
      const amplitude = softCap(
        shapedLevel(frequencyIndex) * amplitudeNow * BOTTOM_SCALE * PARAMS.smallScale,
        maxBottomRight,
      );
      const normalizedFrequencyBand =
        (frequencyIndex - bottomRightStart) / bottomRightSpan;
      const angle = normalizedFrequencyBand * Math.PI * 2 + rotation;
      const pointX =
        offset7 +
        Math.cos(angle) * amplitude +
        canvasWidth / 2 +
        (Math.random() - 0.5) * jitterNow;
      const pointY =
        Math.sin(angle) * amplitude +
        middleY +
        canvasHeight * BOTTOM_OFFSET_RATIO * PARAMS.offsetY +
        (Math.random() - 0.5) * jitterNow;

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

  // le css place deja le canvas en plein ecran (position fixed, inset 0),
  // donc on lit la taille qu'il lui a donnee au lieu de la refixer nous memes.
  // ca evite la boucle avec le ResizeObserver et ca ignore la barre d'url mobile
  viewWidth = canvas.clientWidth;
  viewHeight = canvas.clientHeight;

  // le canvas a deux tailles : celle qu'on voit, et son nombre de pixels reels.
  // sur un ecran retina il en faut 2 ou 3 fois plus, sinon le trait de 1px bave
  canvas.width = viewWidth * devicePixelRatio;
  canvas.height = viewHeight * devicePixelRatio;

  // changer canvas.width remet le contexte a zero, donc on repose la transformation
  canvasContext.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

  viewScale = Math.min(viewWidth, viewHeight) / REFERENCE_SIZE;
  screenScale = viewScale * layoutBoost(viewWidth);
}

// resize ne partait qu'au clic sur un morceau : redimensionner la fenetre ou
// tourner le telephone laissait le canvas a son ancienne taille.
// l'observer se declenche aussi des qu'on observe, donc il fait le premier appel
new ResizeObserver(resize).observe(canvas);

// le meme chemin pour les trois morceaux et pour un fichier depose,
// sinon la mise en route de l'analyseur serait ecrite deux fois
function playTrack(src: string, chosen: HTMLElement) {
  audioElement.src = src;

  // le morceau d'avant arrete de clignoter si on change d'avis en cours de route
  document
    .querySelectorAll("[data-chosen]")
    .forEach((element) => element.removeAttribute("data-chosen"));

  chosen.dataset.chosen = "";
  document.body.dataset.loading = "";

  if (!playing) {
    const audio = createAudio(audioElement);
    frequencyBuffer = audio.frequencyBuffer;
    frequencyBinCount = audio.frequencyBinCount;
    playing = true;

    resize();
    startAnimation();
    draw();
  }

  // play() rend une promesse qui peut etre refusee : safari demande parfois
  // un geste de plus, et changer de morceau trop vite coupe le precedent.
  // sans ce catch, le refus remonte en erreur dans la console
  audioElement.play().catch((error: DOMException) => {
    // on a change de morceau avant que celui la demarre : le suivant prend
    // le relais, il n'y a rien a nettoyer
    if (error.name === "AbortError") return;

    // sinon le clignotement tournerait dans le vide
    stopLoading();
  });
}

// 83 secondes -> "1:23". le padStart met le zero des dizaines
function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);

  return minutes + ":" + String(rest).padStart(2, "0");
}

// vrai pendant qu'on tient le curseur : le temps du morceau continue
// d'avancer, et sans ca il repousserait le curseur sous le doigt
let scrubbing = false;

function updateTime() {
  const duration = audioElement.duration;

  timeLabel.textContent =
    formatTime(audioElement.currentTime) + " / " + formatTime(duration);

  if (scrubbing || !isFinite(duration) || duration === 0) return;

  seekInput.value = String((audioElement.currentTime / duration) * 1000);
}

toggleButton.addEventListener("click", () => {
  if (audioElement.paused) {
    audioElement.play();
  } else {
    audioElement.pause();
  }
});

seekInput.addEventListener("pointerdown", () => {
  scrubbing = true;
});

// pointerup part meme si le doigt a glisse hors de la barre
window.addEventListener("pointerup", () => {
  scrubbing = false;
});

// "input" se declenche pendant le glissement, "change" seulement a la fin :
// on prend input pour que le son suive le doigt tout de suite
seekInput.addEventListener("input", () => {
  const duration = audioElement.duration;

  if (!isFinite(duration) || duration === 0) return;

  audioElement.currentTime = (Number(seekInput.value) / 1000) * duration;

  updateTime();
});

audioElement.addEventListener("timeupdate", updateTime);
audioElement.addEventListener("loadedmetadata", updateTime);

// le picto du bouton suit l'etat reel du son, pas ce qu'on a demande :
// si la lecture echoue, il ne faut pas afficher pause alors que rien ne joue
audioElement.addEventListener("play", () => {
  document.body.dataset.playing = "";
});

audioElement.addEventListener("pause", () => {
  delete document.body.dataset.playing;
});

audioElement.addEventListener("ended", () => {
  delete document.body.dataset.playing;
});

// le clignotement s'arrete et la liste des morceaux redevient cliquable
function stopLoading() {
  delete document.body.dataset.loading;

  document
    .querySelectorAll("[data-chosen]")
    .forEach((element) => element.removeAttribute("data-chosen"));
}

// on ne bascule pas des le clic : un mp3 met plusieurs secondes a arriver
// en 4g, et on regarderait un canvas vide pendant tout le telechargement.
// "playing" ne part qu'au moment ou le son sort vraiment
audioElement.addEventListener("playing", () => {
  stopLoading();

  document.body.dataset.view = "canvas";
});

// si le fichier n'arrive jamais, sans ca le morceau clignoterait sans fin
// et les autres resteraient grises donc impossibles a choisir
audioElement.addEventListener("error", stopLoading);
audioElement.addEventListener("stalled", stopLoading);

trackButtons.forEach((trackButton) => {
  trackButton.addEventListener("click", () => {
    playTrack(trackButton.dataset.src!, trackButton);
  });
});

// l'adresse locale du fichier depose, gardee pour pouvoir la relacher
let ownTrackUrl = "";

ownTrackInput.addEventListener("change", () => {
  const file = ownTrackInput.files?.[0];

  if (!file) return;

  // le fichier ne part sur aucun serveur : createObjectURL fabrique juste
  // une adresse qui pointe vers la memoire du navigateur
  if (ownTrackUrl) URL.revokeObjectURL(ownTrackUrl);

  ownTrackUrl = URL.createObjectURL(file);

  playTrack(ownTrackUrl, ownTrackInput.parentElement!);
});

returnButton.addEventListener("click", () => {
  document.body.dataset.view = "intro";

  audioElement.pause();

  // sans ca, revenir en arriere pendant un chargement long laissait les
  // autres morceaux grises et impossibles a cliquer : on restait bloque
  stopLoading();
});

// barre d'espace pour mettre en pause, comme partout ailleurs.
// on laisse tranquille les champs de saisie et les boutons, sinon la touche
// rejouerait le bouton qui a le focus en plus de mettre en pause
window.addEventListener("keydown", (keyEvent) => {
  if (keyEvent.key !== " ") return;
  if (document.body.dataset.view !== "canvas") return;

  const focused = document.activeElement;

  if (focused instanceof HTMLInputElement) return;
  if (focused instanceof HTMLButtonElement) return;

  keyEvent.preventDefault();

  if (audioElement.paused) {
    audioElement.play();
  } else {
    audioElement.pause();
  }
});
