// const canvas = document.querySelector('canvas')!
// const context = canvas.getContext('2d')!
// const audioElement = document.querySelector('audio')!

// let audioContext: AudioContext
// let playing = false
// let analyser: AnalyserNode
// let analyserBuffer: Uint8Array

// addEventListener('resize', resize)

// addEventListener('click', async () => {
//   audioContext || await createContext()
//   playing ? pause() : play()
//   resize()
//   tick()
// })

// async function createContext() {
//   audioContext = new AudioContext()

//   const mediaSourceNode = audioContext.createMediaElementSource(audioElement)
//   analyser = audioContext.createAnalyser()
//   analyser.fftSize = 32768
//   analyserBuffer = new Uint8Array(analyser.frequencyBinCount)

//   mediaSourceNode.connect(analyser)
//   mediaSourceNode.connect(audioContext.destination)
// }

// function render() {
//   analyser.getByteTimeDomainData(analyserBuffer as Uint8Array<ArrayBuffer>)

//   context.fillStyle = 'rgb(255, 255, 255)'
//   context.fillRect(0, 0, canvas.width, canvas.height)

//   context.lineWidth = 1
//   context.strokeStyle = '#000'

//   context.beginPath()

//   const sliceWidth = canvas.width / analyserBuffer.length
//   let x = 0

//   for (let i = 0; i < analyserBuffer.length; i++) {
//     const v = analyserBuffer[i] / 128
//     const y = (v * canvas.height) / 2

//     if (i === 0) {
//       context.moveTo(x, y)
//     } else {
//       context.lineTo(x, y)
//     }

//     x += sliceWidth
//   }

//   context.lineTo(canvas.width, canvas.height / 2)
//   context.stroke()
// }

// function resize() {
//   canvas.width = window.innerWidth
//   canvas.height = window.innerHeight
// }

// function tick() {
//   requestAnimationFrame(tick)
//   render()
// }

// function play() {
//   playing = true
//   audioElement.play()
// }

// function pause() {
//   playing = false
//   audioElement.pause()
// }