"use client"

/**
 * Le geste « Signaler » vu par l'application (G9, MD-02). PROPRIÉTAIRE : chantier
 * « confiance des surfaces ».
 *
 * La feuille, le bouton et le masque vivent dans le paquet de surfaces
 * (`@diasporale/features`, `components/report-content`) depuis MD-02, pour servir
 * aussi les commentaires, qui y vivent. Ce fichier garde l'interface que les écrans
 * de l'application emploient déjà : seul le retour d'un contenu masqué qui occupait
 * toute la fiche s'écrit ici, en lien de l'application.
 */
import { ReportedContent as FeatureReportedContent } from "@diasporale/features"
import type { ContentReportTarget } from "@diasporale/features/data"
import NextLink from "next/link"
import type { ReactNode } from "react"

export {
  ReportContentAction,
  ReportContentButton,
  ReportContentSheet,
  useOptionalContentReports,
  type ReportContentActionProps,
  type ReportContentSheetProps,
} from "@diasporale/features"

export interface ReportedContentProps {
  readonly target: ContentReportTarget
  readonly children: ReactNode
  /** Le retour, quand le contenu masqué occupait toute la fiche. */
  readonly back?: { readonly href: string; readonly label: string }
  readonly className?: string
}

/** Le contenu ; signalé par la personne de la session, l'avis qui le remplace pour elle. */
export function ReportedContent(props: ReportedContentProps) {
  const back = props.back === undefined ? undefined : (
    <NextLink href={props.back.href} className="inline-flex min-h-11 items-center font-medium text-primary hover:underline focus-visible:shadow-focus">
      {props.back.label}
    </NextLink>
  )
  return (
    <FeatureReportedContent target={props.target} back={back} className={props.className}>
      {props.children}
    </FeatureReportedContent>
  )
}
