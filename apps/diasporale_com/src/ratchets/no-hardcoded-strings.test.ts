import ts from "typescript"
import { describe, expect, it } from "vitest"

import { productSources } from "./sources"

/**
 * Cliquet « UI en français via i18n » : aucun texte affiché n'est écrit en dur
 * dans un composant. L'arbre TSX est analysé par le compilateur TypeScript —
 * texte JSX, expressions `{"…"}` et attributs lus par une personne
 * (`aria-label`, `placeholder`, `title`, `alt`, et les libellés des
 * composants de la charte) doivent passer par `t()`.
 */

/** Attributs dont la valeur est lue ou entendue par une personne. */
const SPOKEN_ATTRIBUTES = new Set([
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "placeholder",
  "title",
  "alt",
  "label",
  "description",
  "hint",
  "error",
  "closeLabel",
  "triggerLabel",
])

/** Au moins deux lettres d'affilée : « @ », « · » ou « — » ne sont pas du texte. */
const WORDS = /\p{L}{2,}/u

function findings(path: string, text: string): string[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out: string[] = []
  const report = (node: ts.Node, value: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
    out.push(`${path}:${line + 1} « ${value.trim().slice(0, 60)} »`)
  }
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && WORDS.test(node.text)) report(node, node.text)
    if (ts.isJsxExpression(node) && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      const expression = node.expression
      if (expression && (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) && WORDS.test(expression.text)) {
        report(node, expression.text)
      }
    }
    if (ts.isJsxAttribute(node) && SPOKEN_ATTRIBUTES.has(node.name.getText(source))) {
      const initializer = node.initializer
      const literal =
        initializer && ts.isStringLiteral(initializer)
          ? initializer
          : initializer && ts.isJsxExpression(initializer) && initializer.expression && ts.isStringLiteral(initializer.expression)
            ? initializer.expression
            : null
      if (literal && WORDS.test(literal.text)) report(node, literal.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return out
}

describe("cliquet i18n — aucune chaîne affichée en dur", () => {
  const files = productSources([".tsx"])

  it("relit bien les composants du produit", () => {
    expect(files.length).toBeGreaterThan(30)
  })

  it("le cliquet sait reconnaître une chaîne en dur", () => {
    const sample = `export const A = () => <p title="Bonjour">Salut {"tout le monde"} <b aria-label={"Fermer"}>@</b></p>`
    expect(findings("exemple.tsx", sample)).toHaveLength(4)
  })

  it("aucun texte JSX, aucun attribut lu par une personne, n'échappe à t()", () => {
    expect(files.flatMap((file) => findings(file.path, file.text))).toEqual([])
  })
})
