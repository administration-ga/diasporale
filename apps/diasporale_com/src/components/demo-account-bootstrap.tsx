"use client"

import { DAY_MS, DIASPORALE_DEMO_ACTOR_SPECS, diasporaleDemoDisplayName, type DiasporaleDemoActor, type DiasporaleDemoActorSpec } from "@diasporale/domain"
import {
  useActions,
  useDemoAccounts,
  useJobs,
  useMentoring,
  useMutualAid,
  useServices,
  useSession,
  type AidMissionInputView,
  type DemoAccountsCapability,
  type DemoEquipmentView,
  type JobOfferInputView,
  type MentorProfileInputView,
  type ServiceOfferInputView,
  type TalentProfileInputView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { forgetDemoActor, pendingDemoActor } from "@/lib/demo-account-pending"
import { routes } from "@/lib/routes"

/* Les contenus FICTIFS que les gestes publient, marqués comme tels dans leur texte. */
const MENTOR_PROFILE = {
  domains: ["studies", "work"],
  presentation: "J'accompagne les étudiants et les jeunes actifs arrivés en France : inscriptions, logement, premiers pas (profil de démonstration).",
  languages: ["fr", "en"],
  city: "Paris",
  availability: "Le soir en semaine (démonstration)",
  maxActiveMentees: 3,
} as const satisfies Omit<MentorProfileInputView, "country">

const TALENT_PROFILE = {
  title: "Développeur web",
  skills: ["TypeScript", "React", "Convex"],
  availability: "immediate",
  languages: ["fr", "en"],
  visibility: "network",
} as const satisfies Omit<TalentProfileInputView, "country">

const SERVICE_OFFER = {
  title: "Repas d'accueil pour les nouveaux arrivants",
  description: "Un repas gabonais pour faire connaissance et trouver ses repères en arrivant (offre de démonstration).",
  category: "settling_in",
  delivery: "onsite",
  languages: ["fr"],
  durationMinutes: 120,
  pricing: { mode: "quote" },
} as const satisfies Omit<ServiceOfferInputView, "country" | "city">

const JOB_OFFER = {
  title: "Commis de cuisine",
  description: "Rejoindre notre équipe de cuisine pour le service du midi, débutants bienvenus (offre de démonstration).",
  contract: "cdd",
  workMode: "onsite",
  languages: ["fr"],
  payRange: null,
  closesAt: null,
} as const satisfies Omit<JobOfferInputView, "country" | "city">

const MISSION = {
  title: "Collecte solidaire pour les nouveaux arrivants",
  description: "Trier les dons et préparer des kits d'arrivée avec l'association (mission de démonstration).",
  area: "",
  endsAt: null,
  timeZone: "Europe/Paris",
  places: 10,
} as const satisfies Omit<AidMissionInputView, "country" | "city" | "startsAt">

/** Une mission commence dans une semaine : le début doit rester dans le futur. */
const MISSION_LEAD_DAYS = 7

interface GestureCapabilities {
  readonly mentoring: ReturnType<typeof useMentoring>
  readonly jobs: ReturnType<typeof useJobs>
  readonly services: ReturnType<typeof useServices>
  readonly mutualAid: ReturnType<typeof useMutualAid>
}

/**
 * Les VRAIS gestes de l'acteur, par les capacités du port : profil de mentor, de
 * talent, offre de service et offre d'emploi de la page d'entreprise, mission de
 * la page d'association. Rend `false` si l'un d'eux n'a pas abouti.
 */
async function playGestures(spec: DiasporaleDemoActorSpec, equipment: DemoEquipmentView, capabilities: GestureCapabilities): Promise<boolean> {
  const country = spec.country
  const city = spec.page?.city ?? MENTOR_PROFILE.city
  const pageId = equipment.pageCreated ? equipment.pageId : null
  let complete = true
  for (const gesture of spec.gestures) {
    let ok = true
    if (gesture === "mentor") ok = (await capabilities.mentoring?.becomeMentor({ ...MENTOR_PROFILE, country, consent: true }))?.ok ?? false
    else if (gesture === "talent") ok = (await capabilities.jobs?.saveTalentProfile({ ...TALENT_PROFILE, country, expectedVersion: null }))?.ok ?? false
    // Les gestes d'une page ne se jouent qu'à sa création : un second équipement ne double rien.
    else if (pageId === null) continue
    else if (gesture === "service") ok = (await capabilities.services?.createOffer({ ...SERVICE_OFFER, country, city, pageId, publish: true }))?.ok ?? false
    else if (gesture === "job") ok = (await capabilities.jobs?.createOffer({ ...JOB_OFFER, country, city, pageId, publish: true }))?.ok ?? false
    else ok = (await capabilities.mutualAid?.createMission({ ...MISSION, country, city, pageId, startsAt: Date.now() + MISSION_LEAD_DAYS * DAY_MS }))?.ok ?? false
    if (!ok) complete = false
  }
  return complete
}

/**
 * Développement local : après une connexion par le panneau des comptes de
 * démonstration (`DemoAccountsButton`), rejoue le VRAI accueil (`join` : profil
 * publié, consentements, adhésion), demande au moteur ce que le compte ne peut
 * pas se donner seul (`equip` : faits fictifs, statut dérivé, rôle, équipe, page),
 * puis joue les vrais gestes de l'acteur, une seule fois, à sa première entrée.
 * Sans acteur en attente dans cet onglet, il ne fait rien ; le moteur refuse
 * l'équipement hors des outils de développement locaux.
 */
export function DemoAccountBootstrap() {
  const demoAccounts = useDemoAccounts()
  if (demoAccounts === null) return null
  return <EngineDemoAccountBootstrap capability={demoAccounts} />
}

function EngineDemoAccountBootstrap(props: { capability: DemoAccountsCapability }) {
  const { capability } = props
  const { t } = useDiasporaleT()
  const session = useSession()
  const actions = useActions()
  const mentoring = useMentoring()
  const jobs = useJobs()
  const services = useServices()
  const mutualAid = useMutualAid()
  const router = useRouter()
  const running = useRef(false)
  const signedIn = session.status === "ready" && session.data.status === "signed_in"
  const membership = signedIn && session.data.status === "signed_in" ? session.data.membership : null
  const member = membership !== null && membership.status !== "partie"

  useEffect(() => {
    if (running.current || !signedIn) return
    const actor: DiasporaleDemoActor | null = pendingDemoActor()
    if (actor === null) return
    const spec = DIASPORALE_DEMO_ACTOR_SPECS[actor]
    const profile = spec.profile
    // Le nouvel arrivant remplit l'accueil lui-même.
    if (profile === null) {
      forgetDemoActor()
      return
    }
    running.current = true
    const name = diasporaleDemoDisplayName(actor) ?? profile.handle
    // Un seul avis, du début à la fin : la préparation prend quelques secondes.
    const notice = toast.loading(t("demoAccounts.preparing"))
    void (async () => {
      try {
        const firstEntry = !member
        if (firstEntry) {
          const joined = await actions.join({
            facet: { countryOfResidence: spec.country, city: spec.page?.city ?? null },
            handle: profile.handle,
            displayName: name,
            consents: { social_profile: true, directory: true, notifications: false },
            directoryVisibility: "network",
          })
          if (!joined.ok) throw new Error(joined.code)
        }
        const equipped = await capability.equip(actor)
        if (!equipped.ok) throw new Error(equipped.code)
        const complete = firstEntry ? await playGestures(spec, equipped.value, { mentoring, jobs, services, mutualAid }) : true
        if (complete) toast.success(t("demoAccounts.ready", { name }), { id: notice })
        else toast.error(t("demoAccounts.equipFailed", { name }), { id: notice })
        router.replace(routes.feed())
      } catch {
        toast.error(t("demoAccounts.equipFailed", { name }), { id: notice })
      } finally {
        forgetDemoActor()
      }
    })()
  }, [signedIn, member, actions, capability, mentoring, jobs, services, mutualAid, router, t])

  return null
}
