"use client"

import { splitBodyRich } from "@antsia/social-domain/richText"
import { Fragment, type ReactNode } from "react"

import { useRouting } from "../routing"

export type RichPart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "mention"; readonly handle: string; readonly text: string }
  | { readonly kind: "tag"; readonly tag: string; readonly text: string }

/**
 * Longueur, dans le texte d'origine, du jeton qui suit le « # » ou le « @ » : le
 * moteur le rend en minuscules, et une minuscule peut s'allonger (« İ » → « i̇ »).
 */
function originalLength(text: string, start: number, canonical: string): number {
  for (let length = canonical.length; length > 0; length--) {
    if (text.slice(start, start + length).toLowerCase() === canonical) return length
  }
  return canonical.length
}

/**
 * Découpe un texte en morceaux : texte, mention, mot-dièse. Le découpage est
 * celui du moteur (`splitBodyRich`, le motif même qui résout et avise les
 * personnes citées) : l'écran ne met en valeur que ce que le moteur reconnaît.
 * Il garde en revanche la casse que l'auteur a écrite.
 */
export function richParts(text: string): RichPart[] {
  let cursor = 0
  return splitBodyRich(text).map((segment): RichPart => {
    if (segment.type === "text") {
      cursor += segment.value.length
      return { kind: "text", text: segment.value }
    }
    const end = cursor + 1 + originalLength(text, cursor + 1, segment.value)
    const original = text.slice(cursor, end)
    cursor = end
    return segment.type === "mention" ? { kind: "mention", handle: segment.value, text: original } : { kind: "tag", tag: segment.value, text: original }
  })
}

/**
 * Le corps d'une publication ou d'un commentaire : les mentions mènent au profil
 * (le moteur, lui, n'avise que les personnes réellement joignables) ; les
 * mots-dièse mènent au même fil autorisé, filtré par leur jeton canonique.
 * Aucun HTML n'est interprété.
 */
export function RichText(props: { text: string }): ReactNode {
  const { routes, Link } = useRouting()
  return richParts(props.text).map((part, index) => {
    if (part.kind === "mention") {
      return (
        <Link key={index} href={routes.profile(part.handle)} className="font-medium text-[var(--esp-accent-deep)] hover:underline focus-visible:shadow-focus">
          {part.text}
        </Link>
      )
    }
    if (part.kind === "tag") {
      return (
        <Link key={index} href={routes.feed(part.tag)} className="font-medium text-[var(--esp-accent-deep)] hover:underline focus-visible:shadow-focus">
          {part.text}
        </Link>
      )
    }
    return <Fragment key={index}>{part.text}</Fragment>
  })
}
