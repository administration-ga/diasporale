import { describe, expect, it } from "vitest"

import { introOffsets, PARTICLE_TEXTURE_WIDTH, sampleParticles, wordmarkLayout } from "./particles"

/** Une grille RGBA (non prémultipliée, comme `getImageData`) : pixels encrés posés à la main. */
function bitmap(width: number, height: number, inked: Record<string, readonly [number, number, number, number]>) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (const [position, rgba] of Object.entries(inked)) {
    const [x, y] = position.split(",").map(Number) as [number, number]
    pixels.set(rgba, (y * width + x) * 4)
  }
  return pixels
}

const middle = () => 0.5

describe("champ de particules du mot-symbole", () => {
  it("tire une particule par pixel encré, à sa place et dans sa couleur, et ignore le vide", () => {
    const pixels = bitmap(4, 2, {
      "0,0": [10, 20, 30, 255],
      "2,0": [10, 20, 30, 20],
      "3,0": [10, 20, 30, 100],
      "1,1": [40, 50, 60, 255],
    })
    const field = sampleParticles(pixels, 4, 2, middle)

    // (2,0) est sous le seuil d'encre ; (3,0), bord anticrénelé, est gardé par le tirage.
    expect(field.count).toBe(3)
    expect(field.textureHeight).toBe(1)
    expect(field.home).toHaveLength(PARTICLE_TEXTURE_WIDTH * 4)
    expect(Array.from(field.home.slice(0, 4))).toEqual([0.125, 0.25, 0.5, 1])
    expect(Array.from(field.home.slice(8, 10))).toEqual([0.375, 0.75])
    expect(Array.from(field.color.slice(0, 12))).toEqual([10, 20, 30, 255, 10, 20, 30, 255, 40, 50, 60, 255])
    // Le reste des textures est vide : taille nulle, jamais dessiné.
    expect(field.home[3 * 4 + 3]).toBe(0)
  })

  it("écarte un bord trop pâle quand le tirage le refuse", () => {
    const field = sampleParticles(bitmap(1, 1, { "0,0": [0, 0, 0, 40] }), 1, 1, () => 0.9)
    expect(field.count).toBe(0)
    expect(field.textureHeight).toBe(1)
  })

  it("agrandit les textures d'une rangée par tranche de particules", () => {
    const width = PARTICLE_TEXTURE_WIDTH + 1
    const inked = Object.fromEntries(Array.from({ length: width }, (_, x) => [`${x},0`, [1, 2, 3, 255] as const]))
    const field = sampleParticles(bitmap(width, 1, inked), width, 1, middle)
    expect(field.count).toBe(width)
    expect(field.textureHeight).toBe(2)
  })

  it("disperse chaque particule vers l'extérieur de sa place avant l'assemblage, et rien au-delà", () => {
    const pixels = bitmap(4, 1, { "0,0": [0, 0, 0, 255], "3,0": [0, 0, 0, 255] })
    const field = sampleParticles(pixels, 4, 1, middle)
    const offsets = introOffsets(field, { w: 400, h: 100 }, middle)

    expect(offsets).toHaveLength(PARTICLE_TEXTURE_WIDTH * field.textureHeight * 4)
    // À gauche du centre, la particule part de la gauche ; à droite, de la droite.
    expect(offsets[0]).toBeLessThan(0)
    expect(offsets[4]).toBeGreaterThan(0)
    for (const index of [0, 4]) expect(Math.abs(offsets[index] ?? 0)).toBeLessThanOrEqual(400 * 0.46 * (0.6 + 0.71 * 1.4))
    // Vitesses nulles et entrées vides intactes.
    expect(offsets[2]).toBe(0)
    expect(offsets[3]).toBe(0)
    expect(Array.from(offsets.slice(8, 16))).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })

  it("pose le cadre (texte et marge d'encre) au milieu d'une scène qui laisse place à la matière soufflée", () => {
    const layout = wordmarkLayout({ width: 413.8, height: 99 }, 76)

    expect(layout.pad).toEqual({ x: 10, y: 14 })
    expect(layout.frame).toEqual({ x: 203, y: 152, w: 434, h: 127 })
    expect(layout.stage).toEqual({ left: -213, top: -166, width: 840, height: 431 })
    // Un petit mot-symbole (téléphone) garde une marge minimale.
    const small = wordmarkLayout({ width: 200, height: 20 }, 16)
    expect(small.frame.x).toBe(96)
    expect(small.frame.y).toBe(72)
  })
})
