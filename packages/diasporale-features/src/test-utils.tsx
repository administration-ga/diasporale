import { render, type RenderResult } from "@testing-library/react"
import type { ReactElement } from "react"

import type { Locale } from "./i18n"
import { I18nProvider } from "./i18n/client"

/** Monte un composant sous le fournisseur i18n réel (français par défaut). */
export function renderWithI18n(ui: ReactElement, locale: Locale = "fr"): RenderResult {
  return render(<I18nProvider locale={locale}>{ui}</I18nProvider>)
}
