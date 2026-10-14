"use client"

import { isCountryOpen, type CountryCode } from "@diasporale/domain"
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react"
import { useId, useMemo, useRef, useState, type ReactNode } from "react"

import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"
import { countryName, filterCountryOptions, residenceCountryOptions } from "../lib/countries"
import { Input } from "../primitives/field"
import { Sheet, SheetContent, SheetTrigger } from "../primitives/sheet"

/**
 * Sélecteur de pays (C11/P2) : un bouton à étiquette qui ouvre une feuille de
 * recherche. Liste de tous les pays de résidence (jamais le Gabon), triée dans
 * la langue de la personne, recherche par nom sans accents ou par code ISO.
 * Les pays ouverts portent une mention (A8) — un pays fermé reste choisissable :
 * on y entre et on y lit, ses contenus passent par la relecture réseau.
 */
export function CountrySwitch(props: {
  value: CountryCode | null
  onChange: (country: CountryCode) => void
  openCountries: readonly CountryCode[]
  /** Libellé de la feuille (« Changer de pays », « Votre pays de résidence »). */
  title: string
  description: string
  /** Rendu du déclencheur ; par défaut un bouton à étiquette. */
  trigger?: ReactNode
  triggerLabel?: string
  invalid?: boolean
  describedBy?: string
  id?: string
  className?: string
}) {
  const { t, locale } = useDiasporaleT()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const searchId = useId()
  const sheetId = useId()
  const searchRef = useRef<HTMLInputElement>(null)
  const options = useMemo(() => residenceCountryOptions(locale), [locale])
  const shown = useMemo(() => filterCountryOptions(options, query), [options, query])

  const choose = (country: CountryCode) => {
    props.onChange(country)
    setOpen(false)
    setQuery("")
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {props.trigger ?? (
          // Rôle combobox (ARIA 1.2, fenêtre de type dialog) : la valeur affichée est le pays
          // choisi, et l'état invalide du formulaire reste annoncé (aria-invalid).
          <button
            type="button"
            role="combobox"
            id={props.id}
            aria-expanded={open}
            aria-controls={sheetId}
            aria-invalid={props.invalid || undefined}
            aria-describedby={props.describedBy}
            className={cn(
              "inline-flex h-11 w-full items-center gap-3 rounded-md border border-input bg-card px-3 text-left text-[15px] transition-[box-shadow,border-color] duration-150 ease-charte hover:bg-muted focus-visible:border-ring focus-visible:shadow-focus aria-invalid:border-destructive",
              props.className,
            )}
          >
            {props.value ? (
              <>
                <span aria-hidden className="font-mono text-xs font-semibold tracking-[0.06em] text-tag-code">
                  {props.value}
                </span>
                <span className="min-w-0 flex-1 truncate">{countryName(props.value, locale)}</span>
              </>
            ) : (
              <span className="min-w-0 flex-1 truncate text-[var(--ink-500)]">
                {props.triggerLabel ?? t("country.choose")}
              </span>
            )}
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        )}
      </SheetTrigger>
      <SheetContent
        id={sheetId}
        title={props.title}
        description={props.description}
        closeLabel={t("common.close")}
        // Une feuille de recherche s'ouvre sur son champ : on cherche avant de parcourir 248 pays.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          searchRef.current?.focus()
        }}
      >
        <div className="sticky top-0 z-10 -mx-5 -mt-4 bg-card px-5 pb-3 pt-4">
          <label htmlFor={searchId} className="sr-only">
            {t("country.searchLabel")}
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              ref={searchRef}
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("country.searchPlaceholder")}
              autoComplete="off"
              className="pl-9"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            {t("country.resultCount", { count: shown.length })}
          </p>
        </div>
        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("country.noResult")}</p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {shown.map((option) => {
              const selected = option.code === props.value
              const isOpen = isCountryOpen(option.code, props.openCountries)
              return (
                <li key={option.code}>
                  <button
                    type="button"
                    onClick={() => choose(option.code)}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left transition-colors hover:bg-muted focus-visible:shadow-focus",
                      selected && "bg-[var(--primary-50)]",
                    )}
                  >
                    <span aria-hidden className="w-7 font-mono text-xs font-semibold tracking-[0.06em] text-tag-code">
                      {option.code}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.name}</span>
                    {isOpen ? (
                      <span className="rounded-[var(--radius-xs)] bg-published px-1.5 py-0.5 text-[11px] font-semibold text-published-foreground">
                        {t("country.openBadge")}
                      </span>
                    ) : null}
                    {selected ? <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  )
}
