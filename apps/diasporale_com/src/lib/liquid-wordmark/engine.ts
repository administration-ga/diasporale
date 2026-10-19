/**
 * Moteur du mot-symbole liquide de la porte d'entrée (WebGL2, particules
 * simulées sur le GPU).
 *
 * Provenance : adapté de « Sculpture Hero » (Guglielmo Giannattasio,
 * guglielmogiannattasio.it, publié sur 21st.dev), fourni par le propriétaire le
 * 19/10/2026 comme inspiration. Adaptations : la source est un canevas — le
 * mot-symbole tramé par le navigateur, dans la couleur du thème —, jamais une
 * image distante ; aucun mouvement ambiant au repos ; l'assemblage d'entrée
 * rassemble des particules venues de tous les côtés ; la boucle s'arrête dès que
 * la matière a repris sa place ; le composant ne crée jamais ce moteur quand le
 * mouvement réduit ou le contraste forcé est demandé.
 *
 * Principe : chaque pixel encré du mot-symbole devient une particule (place de
 * repos, décalage, vitesse). Au repos, la passe « image » dessine le mot net ;
 * sous le curseur, la matière devient liquide (souffle, tourbillon, sillage),
 * puis revient à sa place et le mot net réapparaît.
 */
import { introOffsets, PARTICLE_TEXTURE_WIDTH, sampleParticles, type ParticleField } from "./particles"
import { FLOW_FS, IMAGE_FS, PART_FS, PART_VS, QUAD_VS, SIM_FS } from "./shaders"

/** Le cadre du mot-symbole dans la scène, en px CSS. */
export interface LiquidFrame {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface LiquidOptions {
  /** 0 – 2 : force du souffle sous le curseur. */
  readonly strength: number
  /** Rayon de la perturbation, en hauteurs du cadre du mot-symbole. */
  readonly radius: number
  /** Particules par px CSS de largeur du cadre. */
  readonly density: number
  /** 0,2 – 3 : taille d'une particule, relative au pas de la grille. */
  readonly dotSize: number
  /** 0 – 2 : distance parcourue par la matière troublée. */
  readonly spread: number
  /** 0 – 2 : tourbillons de la matière troublée. */
  readonly turbulence: number
  /** 0 – 2 : vitesse du retour à la forme. */
  readonly returnSpeed: number
  /** 0 – 2 : ondulation du mot entier pendant le survol. */
  readonly liquid: number
  /** Étirer la matière rapide en traînées. */
  readonly streaks: boolean
  /** Durée de l'assemblage d'entrée, en millisecondes. */
  readonly introMs: number
}

export const LIQUID_DEFAULTS: LiquidOptions = {
  strength: 1,
  radius: 0.9,
  density: 1.6,
  dotSize: 1.2,
  spread: 1,
  turbulence: 1,
  returnSpeed: 1,
  liquid: 0.6,
  streaks: true,
  introMs: 2600,
}

export type LiquidPointer = "move" | "down" | "up" | "leave"

interface Program {
  readonly handle: WebGLProgram
  readonly uniforms: ReadonlyMap<string, WebGLUniformLocation>
}

const FLOW_WIDTH = 256
/** Images simulées après le dernier geste, le temps que la matière revienne. */
const SETTLE_FRAMES = 270
/** L'assemblage fini, encore une seconde et demie pour poser les retardataires. */
const INTRO_TAIL_FRAMES = 90
/** Plafond de pixels du canevas (la densité de l'écran est réduite au-delà). */
const MAX_CANVAS_PIXELS = 3e6

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function uniform(program: Program, name: string): WebGLUniformLocation | null {
  return program.uniforms.get(name) ?? null
}

function compile(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): Program {
  const shader = (type: number, source: string) => {
    const handle = gl.createShader(type)
    if (!handle) throw new Error("shader")
    gl.shaderSource(handle, source)
    gl.compileShader(handle)
    if (!gl.getShaderParameter(handle, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(handle) ?? ""
      gl.deleteShader(handle)
      throw new Error(`shader: ${log}`)
    }
    return handle
  }
  const handle = gl.createProgram()
  if (!handle) throw new Error("program")
  const vertex = shader(gl.VERTEX_SHADER, vertexSource)
  const fragment = shader(gl.FRAGMENT_SHADER, fragmentSource)
  gl.attachShader(handle, vertex)
  gl.attachShader(handle, fragment)
  gl.bindAttribLocation(handle, 0, "aPos")
  gl.linkProgram(handle)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) throw new Error(`link: ${gl.getProgramInfoLog(handle) ?? ""}`)
  const uniforms = new Map<string, WebGLUniformLocation>()
  const count = gl.getProgramParameter(handle, gl.ACTIVE_UNIFORMS) as number
  for (let index = 0; index < count; index++) {
    const info = gl.getActiveUniform(handle, index)
    const location = info ? gl.getUniformLocation(handle, info.name) : null
    if (info && location) uniforms.set(info.name, location)
  }
  return { handle, uniforms }
}

export class LiquidWordmarkEngine {
  /** Appelé une fois, quand une première image a réellement été présentée. */
  onFirstFrame: (() => void) | null = null

  private readonly canvas: HTMLCanvasElement
  private readonly gl: WebGL2RenderingContext
  private readonly options: LiquidOptions
  private readonly lowPower: boolean
  private readonly onFail: () => void

  private readonly flowProgram: Program
  private readonly simulationProgram: Program
  private readonly particleProgram: Program
  private readonly imageProgram: Program
  private readonly vao: WebGLVertexArrayObject
  private readonly quad: WebGLBuffer

  private imageTexture: WebGLTexture | null = null
  private readonly flowTextures: WebGLTexture[] = []
  private readonly flowBuffers: WebGLFramebuffer[] = []
  private flowHeight = 64
  private flowIndex = 0
  private flowDirty = false

  private homeTexture: WebGLTexture | null = null
  private colorTexture: WebGLTexture | null = null
  private stateTextures: WebGLTexture[] = []
  private stateBuffers: WebGLFramebuffer[] = []
  private stateIndex = 0
  private stateDirty = false
  private field: ParticleField | null = null
  private gridWidth = 1

  private frame: LiquidFrame = { x: 0, y: 0, w: 1, h: 1 }
  private cssWidth = 1
  private cssHeight = 1

  private readonly target = { x: -9999, y: -9999 }
  private readonly mouse = { x: -9999, y: -9999 }
  private readonly previous = { x: -9999, y: -9999 }
  private readonly mouseVelocity = { x: 0, y: 0 }
  private presence = 0
  private presenceTarget = 0
  private burst = 0
  private flowing = 0
  private settle = 1e9
  private touchRelease = 0

  private time = 0
  private introProgress = 1
  private animationFrame = 0
  private running = false
  private last = 0
  private visible = true
  private ready = false
  private destroyed = false
  private lost = false

  constructor(canvas: HTMLCanvasElement, options: LiquidOptions, onFail: () => void, lowPower: boolean) {
    this.canvas = canvas
    this.options = options
    this.onFail = onFail
    this.lowPower = lowPower
    // Canevas transparent : tant qu'il n'a rien présenté, le texte réel se voit dessous.
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    })
    if (!gl) throw new Error("webgl2")
    this.gl = gl
    // Cibles flottantes : RGBA16F suffit (décalages en px, précision sous le pixel).
    if (!gl.getExtension("EXT_color_buffer_float") && !gl.getExtension("EXT_color_buffer_half_float")) throw new Error("float targets")

    this.flowProgram = compile(gl, QUAD_VS, FLOW_FS)
    this.simulationProgram = compile(gl, QUAD_VS, SIM_FS)
    this.particleProgram = compile(gl, PART_VS, PART_FS)
    this.imageProgram = compile(gl, QUAD_VS, IMAGE_FS)

    const vao = gl.createVertexArray()
    const quad = gl.createBuffer()
    if (!vao || !quad) throw new Error("buffers")
    this.vao = vao
    this.quad = quad
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    for (let index = 0; index < 2; index++) {
      const texture = this.texture(gl.RGBA8, FLOW_WIDTH, this.flowHeight, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.LINEAR)
      this.flowTextures.push(texture)
      this.flowBuffers.push(this.framebuffer(texture))
    }
    this.clearFlow()
    canvas.addEventListener("webglcontextlost", this.handleContextLost, false)
  }

  /** Taille de la scène (px CSS) et cadre du mot-symbole dedans. À poser avant `setSource`. */
  resize(cssWidth: number, cssHeight: number, frame: LiquidFrame) {
    this.cssWidth = Math.max(1, cssWidth)
    this.cssHeight = Math.max(1, cssHeight)
    this.frame = frame
    let dpr = Math.min(window.devicePixelRatio || 1, this.lowPower ? 1.5 : 2)
    const area = this.cssWidth * this.cssHeight
    if (area * dpr * dpr > MAX_CANVAS_PIXELS) dpr = Math.max(1, Math.sqrt(MAX_CANVAS_PIXELS / area))
    const width = Math.round(this.cssWidth * dpr)
    const height = Math.round(this.cssHeight * dpr)
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
    this.draw()
  }

  /** Pose le mot-symbole tramé (fond transparent) et en tire les particules ; `intro` joue l'assemblage. */
  setSource(source: HTMLCanvasElement, intro: boolean) {
    if (this.destroyed || this.lost) return
    const gl = this.gl
    const aspect = source.width / Math.max(1, source.height)
    this.flowHeight = Math.max(16, Math.round(FLOW_WIDTH / aspect))
    for (const texture of this.flowTextures) {
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, FLOW_WIDTH, this.flowHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    }
    this.clearFlow()

    if (this.imageTexture) gl.deleteTexture(this.imageTexture)
    const image = gl.createTexture()
    if (!image) throw new Error("texture")
    gl.bindTexture(gl.TEXTURE_2D, image)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this.imageTexture = image

    this.buildParticles(source)
    this.ready = true
    if (intro) this.startIntro()
    this.wake()
  }

  setVisible(visible: boolean) {
    this.visible = visible
    if (visible) this.wake()
    else this.stop()
  }

  /** Un geste, en px CSS dans la scène. Le clavier n'anime jamais rien (charte §9). */
  pointer(kind: LiquidPointer, x: number, y: number, touch: boolean) {
    if (this.lost || this.destroyed) return
    const now = performance.now()
    if (kind === "leave" || kind === "up") {
      if (touch) this.touchRelease = now + 260
      else this.presenceTarget = 0
      this.wake()
      return
    }
    if (this.mouse.x < -9000 || kind === "down") {
      this.mouse.x = this.previous.x = x
      this.mouse.y = this.previous.y = y
    }
    this.target.x = x
    this.target.y = y
    this.presenceTarget = 1
    this.settle = 0
    if (kind === "down") {
      this.burst = 1
      this.touchRelease = 0
    }
    this.wake()
  }

  destroy() {
    this.destroyed = true
    this.stop()
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost)
    const gl = this.gl
    if (!this.lost) {
      gl.deleteBuffer(this.quad)
      gl.deleteVertexArray(this.vao)
      for (const texture of [...this.flowTextures, ...this.stateTextures, this.imageTexture, this.homeTexture, this.colorTexture]) {
        if (texture) gl.deleteTexture(texture)
      }
      for (const buffer of [...this.flowBuffers, ...this.stateBuffers]) gl.deleteFramebuffer(buffer)
      for (const program of [this.flowProgram, this.simulationProgram, this.particleProgram, this.imageProgram]) gl.deleteProgram(program.handle)
    }
    gl.getExtension("WEBGL_lose_context")?.loseContext()
  }

  private readonly handleContextLost = (event: Event) => {
    event.preventDefault()
    this.lost = true
    this.stop()
    this.onFail()
  }

  private texture(internal: number, width: number, height: number, format: number, type: number, data: ArrayBufferView | null, filter: number) {
    const gl = this.gl
    const texture = gl.createTexture()
    if (!texture) throw new Error("texture")
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, format, type, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
  }

  private framebuffer(texture: WebGLTexture) {
    const gl = this.gl
    const buffer = gl.createFramebuffer()
    if (!buffer) throw new Error("framebuffer")
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    if (!complete) throw new Error("framebuffer incomplete")
    return buffer
  }

  private clearFlow() {
    const gl = this.gl
    for (const buffer of this.flowBuffers) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer)
      gl.viewport(0, 0, FLOW_WIDTH, this.flowHeight)
      // Vitesse nulle (128 / 255), aucune énergie.
      gl.clearColor(128 / 255, 128 / 255, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.flowDirty = false
  }

  private clearState() {
    const gl = this.gl
    const height = this.field?.textureHeight ?? 1
    for (const buffer of this.stateBuffers) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer)
      gl.viewport(0, 0, PARTICLE_TEXTURE_WIDTH, height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.stateDirty = false
  }

  /** Une particule par pixel encré d'une grille posée sur le mot-symbole. */
  private buildParticles(source: HTMLCanvasElement) {
    const gl = this.gl
    const perPixel = this.options.density * (this.lowPower ? 0.7 : 1)
    const gridWidth = Math.round(clamp(this.frame.w * perPixel, 96, 1400))
    const gridHeight = Math.max(1, Math.round((gridWidth * source.height) / Math.max(1, source.width)))
    const sampler = document.createElement("canvas")
    sampler.width = gridWidth
    sampler.height = gridHeight
    const context = sampler.getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("2d")
    context.imageSmoothingQuality = "high"
    context.drawImage(source, 0, 0, gridWidth, gridHeight)
    const field = sampleParticles(context.getImageData(0, 0, gridWidth, gridHeight).data, gridWidth, gridHeight)

    for (const texture of [this.homeTexture, this.colorTexture, ...this.stateTextures]) if (texture) gl.deleteTexture(texture)
    for (const buffer of this.stateBuffers) gl.deleteFramebuffer(buffer)
    this.homeTexture = this.texture(gl.RGBA32F, PARTICLE_TEXTURE_WIDTH, field.textureHeight, gl.RGBA, gl.FLOAT, field.home, gl.NEAREST)
    this.colorTexture = this.texture(gl.RGBA8, PARTICLE_TEXTURE_WIDTH, field.textureHeight, gl.RGBA, gl.UNSIGNED_BYTE, field.color, gl.NEAREST)
    this.stateTextures = []
    this.stateBuffers = []
    for (let index = 0; index < 2; index++) {
      const texture = this.texture(gl.RGBA16F, PARTICLE_TEXTURE_WIDTH, field.textureHeight, gl.RGBA, gl.HALF_FLOAT, null, gl.NEAREST)
      this.stateTextures.push(texture)
      this.stateBuffers.push(this.framebuffer(texture))
    }
    this.stateIndex = 0
    this.field = field
    this.gridWidth = gridWidth
    this.clearState()
  }

  /** La diaspora qui se rassemble : la matière part dispersée et converge vers le mot. */
  private startIntro() {
    const field = this.field
    const texture = this.stateTextures[this.stateIndex]
    if (!field || field.count === 0 || !texture) return
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, PARTICLE_TEXTURE_WIDTH, field.textureHeight, 0, gl.RGBA, gl.FLOAT, introOffsets(field, this.frame))
    this.introProgress = 0
    this.stateDirty = true
  }

  private wake() {
    if (!this.ready || this.running || !this.visible || this.destroyed || this.lost) {
      if (this.ready && !this.running && !this.destroyed && !this.lost) this.draw()
      return
    }
    this.running = true
    this.last = performance.now()
    this.animationFrame = requestAnimationFrame(this.tick)
  }

  private stop() {
    this.running = false
    cancelAnimationFrame(this.animationFrame)
  }

  private radius() {
    return this.options.radius * this.frame.h
  }

  private readonly tick = (now: number) => {
    if (!this.running) return
    const elapsed = now - this.last
    const dt = clamp(elapsed / 16.6667, 0.25, 3)
    this.last = now

    if (this.touchRelease && now > this.touchRelease) {
      this.presenceTarget = 0
      this.touchRelease = 0
    }
    const ease = 1 - Math.pow(1 - 0.22, dt)
    this.mouse.x += (this.target.x - this.mouse.x) * ease
    this.mouse.y += (this.target.y - this.mouse.y) * ease
    const velocityX = (this.mouse.x - this.previous.x) / dt
    const velocityY = (this.mouse.y - this.previous.y) / dt
    this.previous.x = this.mouse.x
    this.previous.y = this.mouse.y
    this.mouseVelocity.x += (clamp(velocityX, -60, 60) - this.mouseVelocity.x) * 0.5
    this.mouseVelocity.y += (clamp(velocityY, -60, 60) - this.mouseVelocity.y) * 0.5
    const presenceRate = this.presenceTarget > this.presence ? 0.1 : 0.035
    this.presence += (this.presenceTarget - this.presence) * (1 - Math.pow(1 - presenceRate, dt))
    if (this.presence < 0.001 && this.presenceTarget === 0) this.presence = 0
    const flowRate = this.presenceTarget > this.flowing ? 0.05 : 0.018
    this.flowing += (this.presenceTarget - this.flowing) * (1 - Math.pow(1 - flowRate, dt))
    if (this.flowing < 0.002 && this.presenceTarget === 0) this.flowing = 0
    if (this.introProgress < 1) {
      this.introProgress = Math.min(1, this.introProgress + Math.min(elapsed, 100) / this.options.introMs)
      if (this.introProgress >= 1) this.settle = SETTLE_FRAMES - INTRO_TAIL_FRAMES
    }

    const interacting = this.presence > 0.001 || this.burst > 0
    // Compté en images simulées : un appareil lent ne coupe jamais un retour en cours.
    this.settle = interacting ? 0 : this.settle + dt
    const active = interacting || this.settle < SETTLE_FRAMES || this.introProgress < 1
    if (!active) {
      if (this.flowDirty) this.clearFlow()
      if (this.stateDirty) this.clearState()
      this.draw()
      this.firstFrame()
      this.stop()
      return
    }
    this.animationFrame = requestAnimationFrame(this.tick)
    // Le champ accélère tant que la matière est remuée.
    this.time += (dt * (1 + this.flowing * 1.6)) / 60
    this.stepFlow(dt)
    this.stepSimulation(dt)
    this.burst = Math.max(0, this.burst - 0.1 * dt)
    this.draw()
    this.firstFrame()
  }

  private firstFrame() {
    const callback = this.onFirstFrame
    if (!callback) return
    this.onFirstFrame = null
    // Une image de plus : le compositeur a présenté le canevas.
    requestAnimationFrame(() => callback())
  }

  private stepFlow(dt: number) {
    const gl = this.gl
    const program = this.flowProgram
    const target = 1 - this.flowIndex
    const frame = this.frame
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.flowBuffers[target] ?? null)
    gl.viewport(0, 0, FLOW_WIDTH, this.flowHeight)
    gl.disable(gl.BLEND)
    gl.useProgram(program.handle)
    gl.bindVertexArray(this.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.flowTextures[this.flowIndex] ?? null)
    gl.uniform1i(uniform(program, "uPrev"), 0)
    gl.uniform2f(uniform(program, "uTexel"), 1 / FLOW_WIDTH, 1 / this.flowHeight)
    gl.uniform2f(uniform(program, "uMouse"), (this.mouse.x - frame.x) / frame.w, (this.mouse.y - frame.y) / frame.h)
    gl.uniform2f(uniform(program, "uVel"), clamp(this.mouseVelocity.x / 40, -1, 1), clamp(this.mouseVelocity.y / 40, -1, 1))
    gl.uniform2f(uniform(program, "uSize"), frame.w, frame.h)
    gl.uniform1f(uniform(program, "uRadius"), this.radius())
    gl.uniform1f(uniform(program, "uPresence"), Math.max(this.presence, this.burst))
    gl.uniform1f(uniform(program, "uDecay"), Math.pow(0.968, dt))
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    this.flowIndex = target
    this.flowDirty = true
  }

  private stepSimulation(dt: number) {
    const field = this.field
    if (!field || field.count === 0) return
    const gl = this.gl
    const program = this.simulationProgram
    const options = this.options
    const frame = this.frame
    const target = 1 - this.stateIndex
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.stateBuffers[target] ?? null)
    gl.viewport(0, 0, PARTICLE_TEXTURE_WIDTH, field.textureHeight)
    gl.disable(gl.BLEND)
    gl.useProgram(program.handle)
    gl.bindVertexArray(this.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.stateTextures[this.stateIndex] ?? null)
    gl.uniform1i(uniform(program, "uState"), 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.homeTexture)
    gl.uniform1i(uniform(program, "uHome"), 1)
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, this.flowTextures[this.flowIndex] ?? null)
    gl.uniform1i(uniform(program, "uFlow"), 2)
    gl.uniform2f(uniform(program, "uSize"), frame.w, frame.h)
    gl.uniform2f(uniform(program, "uMouse"), this.mouse.x - frame.x, this.mouse.y - frame.y)
    gl.uniform1f(uniform(program, "uRadius"), this.radius())
    gl.uniform1f(uniform(program, "uPresence"), Math.max(this.presence, this.burst))
    gl.uniform1f(uniform(program, "uStrength"), options.strength * (1 + this.burst * 1.5))
    gl.uniform1f(uniform(program, "uSpread"), clamp(options.spread, 0, 2))
    gl.uniform1f(uniform(program, "uTurb"), clamp(options.turbulence, 0, 2))
    gl.uniform1f(uniform(program, "uReturn"), clamp(options.returnSpeed, 0, 2))
    gl.uniform1f(uniform(program, "uTime"), this.time)
    gl.uniform1f(uniform(program, "uDt"), dt)
    gl.uniform1f(uniform(program, "uIntro"), Math.pow(1 - this.introProgress, 2))
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    this.stateIndex = target
    this.stateDirty = true
  }

  private draw() {
    if (!this.ready || this.lost || this.destroyed) return
    const gl = this.gl
    const options = this.options
    const frame = this.frame
    const introVisibility = Math.pow(this.introProgress, 2.2)
    const ambient = this.flowing * 0.85 * clamp(options.liquid, 0, 2)
    const dpr = this.canvas.width / this.cssWidth
    const presence = Math.max(this.presence, this.burst)
    const mouseX = this.mouse.x - frame.x
    const mouseY = this.mouse.y - frame.y
    const radius = this.radius()

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.bindVertexArray(this.vao)
    gl.disable(gl.BLEND)

    const image = this.imageProgram
    gl.useProgram(image.handle)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture)
    gl.uniform1i(uniform(image, "uImg"), 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.flowTextures[this.flowIndex] ?? null)
    gl.uniform1i(uniform(image, "uFlow"), 1)
    gl.uniform2f(uniform(image, "uRes"), this.cssWidth, this.cssHeight)
    gl.uniform1f(uniform(image, "uDpr"), dpr)
    gl.uniform4f(uniform(image, "uRect"), frame.x, frame.y, frame.w, frame.h)
    gl.uniform2f(uniform(image, "uMouse"), mouseX, mouseY)
    gl.uniform1f(uniform(image, "uPresence"), presence)
    gl.uniform1f(uniform(image, "uRadius"), radius)
    gl.uniform1f(uniform(image, "uStrength"), options.strength)
    gl.uniform1f(uniform(image, "uTime"), this.time)
    gl.uniform1f(uniform(image, "uAmbient"), ambient)
    gl.uniform1f(uniform(image, "uIntroVis"), introVisibility)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // Au repos, les particules sont invisibles : on ne les dessine pas.
    const field = this.field
    if (!field || field.count === 0 || (!this.stateDirty && introVisibility >= 1)) return
    const particles = this.particleProgram
    gl.useProgram(particles.handle)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.stateTextures[this.stateIndex] ?? null)
    gl.uniform1i(uniform(particles, "uState"), 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.homeTexture)
    gl.uniform1i(uniform(particles, "uHome"), 1)
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, this.colorTexture)
    gl.uniform1i(uniform(particles, "uCol"), 2)
    gl.activeTexture(gl.TEXTURE3)
    gl.bindTexture(gl.TEXTURE_2D, this.flowTextures[this.flowIndex] ?? null)
    gl.uniform1i(uniform(particles, "uFlow"), 3)
    gl.uniform1i(uniform(particles, "uTexW"), PARTICLE_TEXTURE_WIDTH)
    gl.uniform4f(uniform(particles, "uRect"), frame.x, frame.y, frame.w, frame.h)
    gl.uniform2f(uniform(particles, "uRes"), this.cssWidth, this.cssHeight)
    gl.uniform2f(uniform(particles, "uMouse"), mouseX, mouseY)
    gl.uniform1f(uniform(particles, "uRadius"), radius)
    gl.uniform1f(uniform(particles, "uPresence"), presence)
    gl.uniform1f(uniform(particles, "uDot"), (frame.w / this.gridWidth) * 1.45 * clamp(options.dotSize, 0.2, 3))
    gl.uniform1f(uniform(particles, "uTime"), this.time)
    gl.uniform1f(uniform(particles, "uAmbient"), ambient)
    gl.uniform1f(uniform(particles, "uStreak"), (options.streaks ? 1 : 0) * (0.45 + 0.55 * introVisibility))
    gl.uniform1f(uniform(particles, "uIntroVis"), introVisibility)
    gl.uniform1f(uniform(particles, "uDpr"), dpr)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, field.count)
    gl.disable(gl.BLEND)
  }
}
