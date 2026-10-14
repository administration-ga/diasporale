import { Label as LabelPrimitive } from "radix-ui"
import type { ComponentProps, ReactNode } from "react"

import { cn } from "../lib/cn"

/**
 * Champs de formulaire. Le contour (`--input`) tient 3:1 sur la carte dans
 * les deux thèmes (WCAG 1.4.11) ; le focus est l'anneau de la charte.
 */
const controlBase =
  "w-full rounded-md border border-input bg-card px-3 text-[15px] text-foreground placeholder:text-[var(--ink-500)] transition-[box-shadow,border-color] duration-150 ease-charte focus-visible:border-ring focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-destructive"

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input data-slot="input" type={type} className={cn(controlBase, "h-11", className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea data-slot="textarea" className={cn(controlBase, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />
  )
}

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("text-sm font-medium text-foreground select-none", className)}
      {...props}
    />
  )
}

/**
 * Un champ complet : libellé, aide, message d'erreur, reliés au contrôle par
 * `aria-describedby` (le contrôle reçoit `describedBy` via la fonction enfant).
 */
export function Field(props: {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  className?: string
  children: (control: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
}) {
  const hintId = props.hint ? `${props.id}-aide` : undefined
  const errorId = props.error ? `${props.id}-erreur` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined
  return (
    <div className={cn("flex flex-col gap-1.5", props.className)}>
      <Label htmlFor={props.id}>{props.label}</Label>
      {props.children({ id: props.id, describedBy, invalid: Boolean(props.error) })}
      {props.hint ? (
        <p id={hintId} className="text-[13px] leading-snug text-muted-foreground">
          {props.hint}
        </p>
      ) : null}
      {props.error ? (
        <p id={errorId} role="alert" className="text-[13px] font-medium text-destructive">
          {props.error}
        </p>
      ) : null}
    </div>
  )
}
