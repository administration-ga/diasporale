// Dupliqué de ANTSIA/tests/ratchets/lib/detectors.ts (section no-hardcoded-urls : detectHardcodedUrls) @ 8e2485a — adaptations : outils `parseSource`, `lineOf` et `walk` de ANTSIA/tests/ratchets/lib/source-files.ts repris ici ; option `routesOnly` retirée (sans usage dans DIASPORALE) ; défauts rendus en chaînes `fichier:ligne — message` comme les autres cliquets de DIASPORALE ; en-tête de provenance.
/**
 * Détecteur PUR du cliquet « aucune adresse en dur » : une route s'écrit dans
 * la table des routes de l'application (`apps/diasporale_com/src/lib/routes.ts`),
 * une adresse absolue se lit dans l'environnement. Le compilateur TypeScript
 * analyse la source : seules les chaînes passées à un lien, à une propriété de
 * route ou à une navigation comptent, pas un `split("/")`.
 */
import { extname } from "node:path"

import ts from "typescript"

const ABSOLUTE_URL = /^(?:https?|wss?):\/\//i
const ROUTE_LIKE = /^\/[\w\-./[\]@:?=&%]*$/
const ROUTE_ATTRIBUTES = new Set(["href", "src", "action", "formAction"])
const ROUTE_PROPERTIES = new Set(["href", "url", "pathname", "callbackURL", "callbackUrl", "redirectTo", "returnTo"])
const NAVIGATION_CALLS = new Set(["push", "replace", "redirect", "permanentRedirect", "prefetch", "fetch", "navigate", "assign"])

function parseSource(fileName: string, text: string): ts.SourceFile {
  const kind = extname(fileName) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind)
}

function lineOf(source: ts.SourceFile, position: number): number {
  return source.getLineAndCharacterOfPosition(position).line + 1
}

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

/** Les routes et adresses absolues écrites en dur dans une source, en `fichier:ligne — message`. */
export function detectHardcodedUrls(file: string, text: string): string[] {
  const findings: string[] = []
  const source = parseSource(file, text)
  const report = (node: ts.Node, message: string) => findings.push(`${file}:${lineOf(source, node.getStart(source))} — ${message}`)
  walk(source, (node) => {
    if (!ts.isStringLiteralLike(node)) return
    const parent = node.parent
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isExternalModuleReference(parent)) return
    if (ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword) return
    if (ts.isLiteralTypeNode(parent)) return
    if (ABSOLUTE_URL.test(node.text)) {
      report(node, `URL absolue « ${node.text} » en dur — la lire dans l'environnement`)
      return
    }
    if (!ROUTE_LIKE.test(node.text)) return
    const jsxAttribute = ts.isJsxAttribute(parent) ? parent : ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent) ? parent.parent : undefined
    const inRouteAttribute = jsxAttribute !== undefined && ROUTE_ATTRIBUTES.has(jsxAttribute.name.getText(source))
    const inRouteProperty = ts.isPropertyAssignment(parent) && ROUTE_PROPERTIES.has(parent.name.getText(source))
    const inNavigationCall =
      ts.isCallExpression(parent) &&
      parent.arguments[0] === node &&
      ((ts.isIdentifier(parent.expression) && NAVIGATION_CALLS.has(parent.expression.text)) ||
        (ts.isPropertyAccessExpression(parent.expression) && NAVIGATION_CALLS.has(parent.expression.name.text)))
    if (inRouteAttribute || inRouteProperty || inNavigationCall) {
      report(node, `route « ${node.text} » en dur — passer par la table des routes (src/lib/routes.ts)`)
    }
  })
  return findings
}
