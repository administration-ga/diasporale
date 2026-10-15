import { act, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"

import { Sheet, SheetContent, useSheetOpen } from "./sheet"

function Probe() {
  return <span data-testid="probe">{useSheetOpen() ? "ouverte" : "fermée"}</span>
}

/** Une feuille ouverte, la pile des avis (sonner) à côté, et un autre élément de la page. */
function Page() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <Probe />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title="Nouvelle publication" description="Rédiger un message" closeLabel="Fermer">
          <p>Contenu</p>
        </SheetContent>
      </Sheet>
      <section aria-label="Avis">
        <ol data-sonner-toaster="">
          <li>
            <button type="button">Écarter cet avis</button>
          </li>
        </ol>
      </section>
      <button type="button">Ailleurs</button>
    </>
  )
}

/** Radix n'écoute les clics hors de la feuille qu'un tour après son ouverture. */
async function nextTurn() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/** Un clic complet : Radix diffère le retrait hors de la feuille jusqu'au `click`. */
function clickOn(element: Element) {
  fireEvent.pointerDown(element, { button: 0 })
  fireEvent.mouseDown(element, { button: 0 })
  fireEvent.pointerUp(element, { button: 0 })
  fireEvent.mouseUp(element, { button: 0 })
  fireEvent.click(element, { button: 0 })
}

describe("Sheet — la feuille et les cartes flottantes", () => {
  it("annonce qu'elle est ouverte, puis fermée (les cartes persistantes s'écartent en attendant)", async () => {
    render(<Page />)
    expect(screen.getByTestId("probe")).toHaveTextContent("ouverte")
    await nextTurn()
    clickOn(screen.getByText("Ailleurs"))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByTestId("probe")).toHaveTextContent("fermée")
  })

  it("un geste dans la pile des avis ne ferme pas la feuille", async () => {
    render(<Page />)
    await nextTurn()
    clickOn(screen.getByText("Écarter cet avis"))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByTestId("probe")).toHaveTextContent("ouverte")
  })
})
