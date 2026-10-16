// @vitest-environment jsdom
import { coverBannerStyle } from "@antsia/social-features/features/reseau-personnel/profil-personne"
import type { ProfileImageView } from "@diasporale/features/data"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ProfileAvatar, ProfileCover } from "./profile-images"

const IMAGE_URL = "https://images.exemple.test/profil.png"
const SERVED: ProfileImageView = { url: IMAGE_URL, withheld: null }

function images(image: ProfileImageView | null) {
  return <><ProfileCover image={image} /><ProfileAvatar id="person-recette" name="Awa Recette" image={image} /></>
}

afterEach(cleanup)

describe("images du profil — délivrance avant affichage", () => {
  it.each([
    { name: "image absente", image: null },
    { name: "URL nulle", image: { url: null, withheld: null } },
  ])("garde les replis pour une $name", ({ image }) => {
    const { container } = render(images(image))

    expect(container.querySelector("img")).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="avatar"]')).toHaveTextContent("AR")
    expect((container.firstElementChild as HTMLElement).style.backgroundImage).toBe("")
  })

  it.each(["fileScanPending", "fileQuarantined"] as const)("n'expose jamais l'URL d'une image %s dans le DOM ni dans le style", (withheld) => {
    const { container } = render(images({ url: IMAGE_URL, withheld }))

    expect(container.querySelector("img")).not.toBeInTheDocument()
    expect(container.innerHTML).not.toContain(IMAGE_URL)
    expect((container.firstElementChild as HTMLElement).style.backgroundImage).toBe("")
    expect(container.querySelector('[data-slot="avatar"]')).toHaveTextContent("AR")
  })

  it("cadre la couverture délivrée sans déformer l'image", () => {
    const { container } = render(<ProfileCover image={SERVED} />)
    const cover = container.firstElementChild as HTMLElement

    expect(cover.style.backgroundImage).toContain(IMAGE_URL)
    expect(cover.style.backgroundSize).toBe("cover")
    expect(cover.style.backgroundPosition).toBe("center center")
    expect(cover).toHaveAttribute("aria-hidden", "true")
  })

  it("cite les guillemets d'une URL de couverture pour les garder dans url()", () => {
    const style = coverBannerStyle('https://images.exemple.test/profil.png?x=")*{')

    expect(style?.backgroundImage).toBe('url("https://images.exemple.test/profil.png?x=\\")*{")')
    expect(style?.backgroundSize).toBe("cover")
    expect(style?.backgroundPosition).toBe("center")
  })

  it("replie un vrai échec de l'avatar puis essaie une nouvelle URL après remplacement", () => {
    const { container, rerender } = render(<ProfileAvatar id="person-recette" name="Awa Recette" image={SERVED} />)
    const first = container.querySelector("img")
    expect(first).toHaveAttribute("src", IMAGE_URL)
    expect(first).toHaveAttribute("loading", "eager")
    if (!first) throw new Error("L'avatar délivré doit être une image")

    fireEvent.error(first)
    expect(container.querySelector("img")).not.toBeInTheDocument()
    expect(container).toHaveTextContent("AR")
    rerender(<ProfileAvatar id="person-recette" name="Awa Recette" image={SERVED} />)
    expect(container.querySelector("img")).not.toBeInTheDocument()

    rerender(<ProfileAvatar id="person-recette" name="Awa Recette" image={{ url: "https://images.exemple.test/remplacement.webp", withheld: null }} />)
    const replacement = container.querySelector("img")
    expect(replacement).toHaveAttribute("src", "https://images.exemple.test/remplacement.webp")
    expect(replacement).not.toBe(first)
  })

  it.each(["fileScanPending", "fileQuarantined"] as const)("retire les deux images déjà affichées si leur délivrance devient %s", (withheld) => {
    const { container, rerender } = render(images(SERVED))
    expect(container.querySelector("img")).toHaveAttribute("src", IMAGE_URL)
    expect((container.firstElementChild as HTMLElement).style.backgroundImage).toContain(IMAGE_URL)

    rerender(images({ url: IMAGE_URL, withheld }))

    expect(container.querySelector("img")).not.toBeInTheDocument()
    expect(container.innerHTML).not.toContain(IMAGE_URL)
    expect((container.firstElementChild as HTMLElement).style.backgroundImage).toBe("")
    expect(container.querySelector('[data-slot="avatar"]')).toHaveTextContent("AR")
  })
})
