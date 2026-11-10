"use client"

import type { ErrorInfo } from "next/error"

import { AppErrorScreen } from "@/components/app-error"

/**
 * Limite d'erreur de toutes les pages (UX-01) : un écran qui casse est remplacé par
 * la page d'erreur à la marque, sous la mise en page racine — la charte, la langue
 * et l'apparence de la personne restent posées. « Réessayer » rejoue l'écran
 * (`retry` du cadre : relecture du serveur, puis nouveau rendu).
 */
export default function AppError({ error, retry }: ErrorInfo) {
  return <AppErrorScreen error={error} onRetry={retry} />
}
