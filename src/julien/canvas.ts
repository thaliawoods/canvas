import { createGUI } from "./gui"

const parameters = {
  pointerDamping: 0.01,
};

export type Parameters = typeof parameters;

;(async () =>{
const canvas = document.querySelector("canvas")!;
const context = canvas.getContext("2d")!;

let frameRequest: number | undefined;
let time: number;
let delta: number;
let elapsed: number = 0;
let pointerX: number = 0;
let pointerY: number = 0;
let easedPointerX: number = 0;
let easedPointerY: number = 0;

const image = await new Promise <HTMLImageElement>((resolve, reject) => {
    const image = new Image()

image.addEventListener("load", () => {
  resolve(image)
})

image.addEventListener("load", () => {
  reject(event)
})

image.src = "/image.png";

})

addEventListener("resize", resize);
addEventListener("pointermove", onPointermove, { passive: true });

createGUI(parameters);
resize();
play();

function onPointermove(event: PointerEvent) {
  pointerX = event.clientX;
  pointerY = event.clientY;
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// afficher un carré vert
// context.fillStyle = "green";
// context.fillRect(10, 10, 100, 100);

function render() {
  const currentTime = Date.now();
  delta = currentTime - time;
  time = currentTime;
  elapsed += delta;

  easedPointerX += (pointerX - easedPointerX) * delta * parameters.pointerDamping;
  easedPointerY += (pointerY - easedPointerY) * delta * parameters.pointerDamping;

    context.drawImage(image, 0, 0, 400, 400);

  // context.clearRect(0, 0, canvas.width, canvas.height)

  // context.strokeStyle = '#000';
  // context.lineWidth = 5

  // // context.fillRect(
  // //     easedPointerX - 50,
  // //     easedPointerY - 50,
  // //     100,
  // //     100
  // // );

  // context.stroke()
}

function tick() {
  render();
  frameRequest = requestAnimationFrame(tick);
}

function play() {
  if (frameRequest === undefined) {
    time = Date.now();
    tick();
  }
}

function pause() {
  frameRequest && cancelAnimationFrame(frameRequest);
  // pareil que la ligne du dessus
  // if (frameRequest) {
  //     cancelAnimationFrame(frameRequest)
  // }
  frameRequest = undefined;
}
})
