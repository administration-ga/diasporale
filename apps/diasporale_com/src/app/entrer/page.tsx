import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { idnReturnRefusal } from "@/lib/idn-return"
import { LandingScreen } from "@/screens/landing-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("entry.title") }
}

/**
 * `/entrer` — la même porte que l'accueil (principe de l'accueil d'ANTSIA), avec
 * ses deux intentions validées côté serveur : `inscription=1` ouvre la création
 * de compte, `deconnexion=incomplete` rend visible une déconnexion inachevée.
 * `error` : l'échec d'un passage par IDN (EA-02), lu en un refus fermé (`lib/idn-return.ts`),
 * jamais affiché tel quel. Toute autre valeur (casse, tableau) est ignorée.
 */
export default async function EnterPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await props.searchParams
  return (
    <LandingScreen
      intent={params.inscription === "1" ? "sign-up" : "sign-in"}
      signOutIncomplete={params.deconnexion === "incomplete"}
      idnRefusal={idnReturnRefusal(params.error)}
    />
  )
}
