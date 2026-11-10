"use client"

import { useEffect } from "react"

import { syncServiceWorker } from "@/lib/service-worker"

/**
 * Inscrit le script de fond unique du site (MO-05) une fois la page chargée, pour ne pas
 * concurrencer le premier affichage ; ou le retire proprement s'il est retiré. N'affiche rien.
 * Aucune inscription aux notifications ici : elle relève de DS-14, sur un geste de la personne.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    const sync = () => void syncServiceWorker()
    if (document.readyState === "complete") {
      sync()
      return
    }
    window.addEventListener("load", sync, { once: true })
    return () => window.removeEventListener("load", sync)
  }, [])
  return null
}
