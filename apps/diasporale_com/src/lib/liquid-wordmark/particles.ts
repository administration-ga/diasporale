/**
 * Le champ de particules du mot-symbole liquide, en fonctions pures (sans
 * WebGL ni DOM) : tirage des particules depuis les pixels du mot-symbole,
 * dispersion d'avant l'assemblage, et géométrie de la scène autour du texte.
 */

/** Largeur des textures de particules : une particule par texel. */
export const PARTICLE_TEXTURE_WIDTH = 1024

export interface ParticleField {
  /** Nombre de particules réelles (le reste des textures est vide). */
  readonly count: number
  /** Hauteur des textures : largeur × hauteur ≥ nombre de particules. */
  readonly textureHeight: number
  /** Par particule : place de repos (x, y ∈ [0, 1] dans le cadre), graine, taille relative. */
  readonly home: Float32Array
  /** Par particule : couleur du pixel d'origine (RGBA 8 bits, alpha plein). */
  readonly color: Uint8Array
}

/**
 * Une particule par pixel encré d'une grille posée sur le mot-symbole (RGBA
 * non prémultiplié, comme `getImageData`). Les bords anticrénelés en donnent
 * proportionnellement moins ; un léger jitter évite la trame régulière.
 */
export function sampleParticles(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  random: () => number = Math.random,
): ParticleField {
  const home: number[] = []
  const color: number[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4
      const alpha = (pixels[index + 3] ?? 0) / 255
      if (alpha < 0.12) continue
      if (alpha < 0.5 && random() > alpha * 2) continue
      const jitterX = (random() - 0.5) * 0.6
      const jitterY = (random() - 0.5) * 0.6
      home.push((x + 0.5 + jitterX) / width, (y + 0.5 + jitterY) / height, random(), 0.85 + random() * 0.3)
      color.push(pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0, 255)
    }
  }
  const count = home.length / 4
  const textureHeight = Math.max(1, Math.ceil(count / PARTICLE_TEXTURE_WIDTH))
  const size = PARTICLE_TEXTURE_WIDTH * textureHeight * 4
  const homeArray = new Float32Array(size)
  homeArray.set(home)
  const colorArray = new Uint8Array(size)
  colorArray.set(color)
  return { count, textureHeight, home: homeArray, color: colorArray }
}

/**
 * Dispersion d'avant l'assemblage (décalages en px CSS, vitesses nulles) : la
 * diaspora qui se rassemble. Chaque particule part de la direction de sa place
 * vue du centre du mot, élargie au hasard, d'autant plus loin qu'elle est au
 * bord du mot : l'ensemble converge de tous les côtés à la fois.
 */
export function introOffsets(
  field: Pick<ParticleField, "count" | "textureHeight" | "home">,
  frame: { readonly w: number; readonly h: number },
  random: () => number = Math.random,
): Float32Array {
  const offsets = new Float32Array(PARTICLE_TEXTURE_WIDTH * field.textureHeight * 4)
  const aspect = frame.h / Math.max(1, frame.w)
  for (let index = 0; index < field.count; index++) {
    const fromCenterX = (field.home[index * 4] ?? 0.5) - 0.5
    const fromCenterY = ((field.home[index * 4 + 1] ?? 0.5) - 0.5) * aspect
    const angle = Math.atan2(fromCenterY, fromCenterX) + (random() - 0.5) * 1.8
    const distance = frame.w * (0.16 + random() * 0.3) * (0.6 + Math.hypot(fromCenterX, fromCenterY) * 1.4)
    offsets[index * 4] = Math.cos(angle) * distance
    offsets[index * 4 + 1] = Math.sin(angle) * distance * 0.7
  }
  return offsets
}

export interface WordmarkLayout {
  /** La scène (le canevas), en px CSS, relative au coin haut-gauche du texte. */
  readonly stage: { readonly left: number; readonly top: number; readonly width: number; readonly height: number }
  /** Le cadre du mot-symbole dans la scène (texte et marge d'encre), en px CSS. */
  readonly frame: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  /** La marge d'encre autour de la boîte du texte (jambages, débords du gras). */
  readonly pad: { readonly x: number; readonly y: number }
}

/**
 * Géométrie autour de la boîte du texte : une marge d'encre (le gras déborde de
 * sa boîte), puis assez de scène pour que la matière soufflée garde de la place
 * avant d'être rognée par le bord du canevas.
 */
export function wordmarkLayout(text: { readonly width: number; readonly height: number }, fontSize: number): WordmarkLayout {
  const pad = { x: Math.ceil(fontSize * 0.12), y: Math.ceil(fontSize * 0.18) }
  const frameW = Math.ceil(text.width) + pad.x * 2
  const frameH = Math.ceil(text.height) + pad.y * 2
  const marginX = Math.round(Math.max(96, frameH * 1.6))
  const marginY = Math.round(Math.max(72, frameH * 1.2))
  return {
    stage: { left: -pad.x - marginX, top: -pad.y - marginY, width: frameW + marginX * 2, height: frameH + marginY * 2 },
    frame: { x: marginX, y: marginY, w: frameW, h: frameH },
    pad,
  }
}
