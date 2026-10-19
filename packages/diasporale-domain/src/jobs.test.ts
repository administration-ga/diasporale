import { describe, expect, it } from "bun:test"

import {
  availableJobApplicationActions,
  canTransitionJobOffer,
  checkJobDeadline,
  checkJobOfferVersion,
  checkTalentProfileVersion,
  clampJobPageSize,
  effectiveJobOfferStatus,
  initialJobOfferStatus,
  isJobApplicationStatus,
  isJobApplicationTerminal,
  isJobEmployerOwnerKind,
  isJobIdempotencyKey,
  isJobLanguageCode,
  isJobOfferContract,
  isJobOfferEditable,
  isJobOfferOpen,
  isJobOfferStatus,
  isJobPayPeriod,
  isJobWorkMode,
  isTalentAttachable,
  isTalentAvailability,
  isTalentListed,
  isTalentVisibility,
  JOB_APPLICATION_ACTIONS,
  JOB_APPLICATION_MESSAGE_MAX_LENGTH,
  JOB_APPLICATION_STATUSES,
  JOB_CITY_MAX_LENGTH,
  JOB_DEADLINE_HORIZON_DAYS,
  JOB_DECISION_REASON_MAX_LENGTH,
  JOB_DESCRIPTION_MAX_LENGTH,
  JOB_LANGUAGE_CODES,
  JOB_OFFER_CONTRACTS,
  JOB_OFFER_STATUSES,
  JOB_OFFER_STATUS_TARGETS,
  JOB_QUERY_MAX_LENGTH,
  JOB_REFUSALS,
  JOB_TITLE_MAX_LENGTH,
  jobApplicationFingerprint,
  jobOfferPublishedAt,
  jobSearchTextOf,
  jobTextHasContact,
  matchesJobFilters,
  matchesJobQuery,
  normalizeJobApplication,
  parseJobCity,
  parseJobCountry,
  parseJobDecisionReason,
  parseJobLanguages,
  parseJobOffer,
  parseJobPayRange,
  parseJobQuery,
  parseJobSearch,
  parseTalentProfile,
  parseTalentSearch,
  parseTalentSkills,
  TALENT_SKILL_MAX_LENGTH,
  TALENT_SKILLS_MAX,
  TALENT_TITLE_MAX_LENGTH,
  talentSearchTextOf,
  talentShortName,
  transitionJobApplication,
  transitionJobOffer,
  type JobOfferInput,
  type JobSearchFilters,
  type JobSearchInput,
  type TalentProfileInput,
} from "./jobs"
import { SERVICE_LANGUAGE_CODES } from "./services"
import { DAY_MS } from "./time"

/** Règles pures du chantier « talents et emploi » (DG-025) : chaque ligne est exercée. */
const NOW = Date.UTC(2026, 9, 18, 10)

/** Une offre fictive complète : chaque test n'en change qu'un trait. */
const OFFER: JobOfferInput = {
  title: "Cuisinier ou cuisinière en traiteur",
  description: "Préparer les plats du pays pour les commandes de la semaine, en équipe de trois.",
  contract: "cdi",
  country: "fr",
  city: " Saint-Étienne ",
  workMode: "onsite",
  languages: ["fr", " EN ", "fr"],
  payRange: { minMinor: 200000, maxMinor: 240000, currency: "eur", period: "month" },
  closesAt: NOW + 30 * DAY_MS,
}

const TALENT: TalentProfileInput = {
  title: "Comptable bilingue",
  skills: ["Comptabilité", " Paie ", "comptabilité", ""],
  availability: "one_month",
  languages: ["fr", "en"],
  country: "BE",
  visibility: "network",
}

const NO_FILTERS: JobSearchFilters = { query: null, country: null, cityKey: null, contract: null, workMode: null }

describe("listes fermées et gardiens de type", () => {
  it("reconnaissent leurs membres et seulement eux", () => {
    expect(isJobOfferContract("cdi")).toBe(true)
    expect(isJobOfferContract("benevolat")).toBe(false)
    expect(isJobWorkMode("hybrid")).toBe(true)
    expect(isJobWorkMode("partout")).toBe(false)
    expect(isJobPayPeriod("month")).toBe(true)
    expect(isJobPayPeriod("week")).toBe(false)
    expect(isJobLanguageCode("ln")).toBe(true)
    expect(isJobLanguageCode("xx")).toBe(false)
    expect(isJobEmployerOwnerKind("association")).toBe(true)
    expect(isJobEmployerOwnerKind("institution")).toBe(false)
    expect(isJobOfferStatus("suspended")).toBe(true)
    expect(isJobOfferStatus("paused")).toBe(false)
    expect(isJobApplicationStatus("shortlisted")).toBe(true)
    expect(isJobApplicationStatus("hired")).toBe(false)
    expect(isTalentAvailability("immediate")).toBe(true)
    expect(isTalentAvailability("tomorrow")).toBe(false)
    expect(isTalentVisibility("unlisted")).toBe(true)
    expect(isTalentVisibility("public")).toBe(false)
  })

  it("gardent des listes stables : contrats des cartes, langues du catalogue, cibles d'état, codes bien formés", () => {
    expect(JOB_OFFER_CONTRACTS).toEqual(["cdi", "cdd", "internship", "part_time", "freelance"])
    expect(JOB_LANGUAGE_CODES).toBe(SERVICE_LANGUAGE_CODES)
    expect(JOB_OFFER_STATUS_TARGETS.every((status) => (JOB_OFFER_STATUSES as readonly string[]).includes(status))).toBe(true)
    expect(JOB_APPLICATION_STATUSES).toEqual(["sent", "seen", "shortlisted", "not_selected", "withdrawn"])
    for (const code of JOB_REFUSALS) expect(code).toMatch(/^[a-z][a-z0-9_]{1,63}$/)
    expect(new Set(JOB_REFUSALS).size).toBe(JOB_REFUSALS.length)
  })
})

describe("textes sans coordonnée", () => {
  it("repère téléphone, e-mail, lien et adresse exacte ; laisse passer une phrase ordinaire", () => {
    expect(jobTextHasContact("Appelez le 06 12 34 56 78")).toBe(true)
    expect(jobTextHasContact("Écrivez à recrutement@exemple.fr")).toBe(true)
    expect(jobTextHasContact("Voir www.exemple.com")).toBe(true)
    expect(jobTextHasContact("Rendez-vous au 12 rue de la Paix")).toBe(true)
    expect(jobTextHasContact("Poste en équipe, horaires de jour, deux ans d'expérience.")).toBe(false)
  })
})

describe("une offre d'emploi", () => {
  it("se normalise : pays, ville repliée, langues sans doublon, fourchette en unités mineures, texte indexé", () => {
    const parsed = parseJobOffer(OFFER, NOW)
    expect(parsed).toEqual({
      ok: true,
      value: {
        title: "Cuisinier ou cuisinière en traiteur",
        description: OFFER.description,
        contract: "cdi",
        country: "FR",
        city: "Saint-Étienne",
        cityKey: "saint etienne",
        workMode: "onsite",
        languages: ["fr", "en"],
        payRange: { minMinor: 200000, maxMinor: 240000, currency: "EUR", period: "month" },
        closesAt: NOW + 30 * DAY_MS,
        searchText: jobSearchTextOf({ title: OFFER.title, description: OFFER.description, city: "Saint-Étienne" }),
      },
    })
  })

  it("garde absents la ville, la fourchette et la date limite facultatives", () => {
    const parsed = parseJobOffer({ ...OFFER, city: undefined, payRange: undefined, closesAt: undefined }, NOW)
    expect(parsed.ok && parsed.value).toMatchObject({ city: null, cityKey: null, payRange: null, closesAt: null })
    expect(parseJobOffer({ ...OFFER, city: null, payRange: null, closesAt: null }, NOW).ok).toBe(true)
  })

  it.each([
    [{ title: "Ab" }, "job_title_too_short"],
    [{ title: "x".repeat(JOB_TITLE_MAX_LENGTH + 1) }, "job_title_too_long"],
    [{ description: "Trop court." }, "job_description_too_short"],
    [{ description: "x".repeat(JOB_DESCRIPTION_MAX_LENGTH + 1) }, "job_description_too_long"],
    [{ title: "Écrire à rh@exemple.fr" }, "job_contact_details_forbidden"],
    [{ description: "Envoyez votre candidature au 06 12 34 56 78, dès aujourd'hui." }, "job_contact_details_forbidden"],
    [{ contract: "benevolat" }, "job_contract_invalid"],
    [{ country: "GA" }, "job_country_is_home"],
    [{ city: "x".repeat(JOB_CITY_MAX_LENGTH + 1) }, "job_city_too_long"],
    [{ workMode: "partout" }, "job_work_mode_invalid"],
    [{ languages: [] }, "job_languages_required"],
    [{ payRange: { minMinor: 1, maxMinor: 2, currency: "EUR", period: "week" } }, "job_pay_period_invalid"],
    [{ payRange: { minMinor: 1, maxMinor: 2, currency: "BTC", period: "month" } }, "currency_invalid"],
    [{ closesAt: NOW - 1 }, "job_deadline_invalid"],
  ] as const)("refuse %o avec son code fermé", (change, code) => {
    expect(parseJobOffer({ ...OFFER, ...(change as Partial<JobOfferInput>) }, NOW)).toEqual({ ok: false, code })
  })

  it("juge le pays : requis, connu, jamais le Gabon", () => {
    expect(parseJobCountry(undefined)).toEqual({ ok: false, code: "job_country_required" })
    expect(parseJobCountry("  ")).toEqual({ ok: false, code: "job_country_required" })
    expect(parseJobCountry("ZZ")).toEqual({ ok: false, code: "job_country_unknown" })
    expect(parseJobCountry("ga")).toEqual({ ok: false, code: "job_country_is_home" })
    expect(parseJobCountry(" be ")).toEqual({ ok: true, value: "BE" })
  })

  it("juge la ville : facultative, bornée, sans coordonnée, une saisie sans lettre vaut absence", () => {
    expect(parseJobCity(null)).toEqual({ ok: true, value: { city: null, cityKey: null } })
    expect(parseJobCity(" - ")).toEqual({ ok: true, value: { city: null, cityKey: null } })
    expect(parseJobCity("x".repeat(JOB_CITY_MAX_LENGTH + 1))).toEqual({ ok: false, code: "job_city_too_long" })
    expect(parseJobCity("12 rue Haute")).toEqual({ ok: false, code: "job_contact_details_forbidden" })
    expect(parseJobCity("  L'Haÿ-les-Roses ")).toEqual({ ok: true, value: { city: "L'Haÿ-les-Roses", cityKey: "l hay les roses" } })
  })

  it("juge les langues : au moins une, connues, sans doublon, cinq au plus", () => {
    expect(parseJobLanguages(["fr", "FR", " en "])).toEqual({ ok: true, value: ["fr", "en"] })
    expect(parseJobLanguages(["fr", "klingon"])).toEqual({ ok: false, code: "job_language_invalid" })
    expect(parseJobLanguages([])).toEqual({ ok: false, code: "job_languages_required" })
    expect(parseJobLanguages(["fr", "en", "es", "pt", "de", "it"])).toEqual({ ok: false, code: "job_languages_too_many" })
  })

  it("juge la fourchette : facultative, même devise, maximum non nul et au moins égal au minimum", () => {
    expect(parseJobPayRange(null)).toEqual({ ok: true, value: null })
    expect(parseJobPayRange(undefined)).toEqual({ ok: true, value: null })
    expect(parseJobPayRange({ minMinor: 0, maxMinor: 150000, currency: "xaf", period: "month" })).toEqual({
      ok: true,
      value: { minMinor: 0, maxMinor: 150000, currency: "XAF", period: "month" },
    })
    expect(parseJobPayRange({ minMinor: 1500, maxMinor: 1500, currency: "EUR", period: "hour" })).toMatchObject({ ok: true })
    expect(parseJobPayRange({ minMinor: 1, maxMinor: 2, currency: "EUR", period: "week" })).toEqual({ ok: false, code: "job_pay_period_invalid" })
    expect(parseJobPayRange({ minMinor: -1, maxMinor: 2, currency: "EUR", period: "day" })).toEqual({ ok: false, code: "amount_invalid" })
    expect(parseJobPayRange({ minMinor: 1, maxMinor: 2.5, currency: "EUR", period: "day" })).toEqual({ ok: false, code: "amount_invalid" })
    expect(parseJobPayRange({ minMinor: 0, maxMinor: 0, currency: "EUR", period: "year" })).toEqual({ ok: false, code: "job_pay_range_invalid" })
    expect(parseJobPayRange({ minMinor: 3000, maxMinor: 2000, currency: "EUR", period: "year" })).toEqual({ ok: false, code: "job_pay_range_invalid" })
  })

  it("juge la date limite : facultative, entière, à venir et dans l'horizon", () => {
    expect(checkJobDeadline(null, NOW)).toEqual({ ok: true, value: null })
    expect(checkJobDeadline(undefined, NOW)).toEqual({ ok: true, value: null })
    expect(checkJobDeadline(NOW + 0.5, NOW)).toEqual({ ok: false, code: "job_deadline_invalid" })
    expect(checkJobDeadline(NOW, NOW)).toEqual({ ok: false, code: "job_deadline_invalid" })
    expect(checkJobDeadline(NOW + JOB_DEADLINE_HORIZON_DAYS * DAY_MS + 1, NOW)).toEqual({ ok: false, code: "job_deadline_invalid" })
    expect(checkJobDeadline(NOW + JOB_DEADLINE_HORIZON_DAYS * DAY_MS, NOW)).toEqual({ ok: true, value: NOW + JOB_DEADLINE_HORIZON_DAYS * DAY_MS })
  })

  it("indexe titre, description et ville en mots repliés", () => {
    expect(jobSearchTextOf({ title: "Développeuse", description: "Équipe d'évènements", city: null })).toBe("developpeuse equipe d evenements")
    expect(jobSearchTextOf({ title: "Chauffeur", description: "Livraisons", city: "Lyon" })).toBe("chauffeur livraisons lyon")
  })
})

describe("les états d'une offre", () => {
  it("brouillon → ouverte ↔ suspendue → close ; close est terminale", () => {
    expect(canTransitionJobOffer("draft", "open")).toBe(true)
    expect(canTransitionJobOffer("draft", "suspended")).toBe(false)
    expect(canTransitionJobOffer("closed", "open")).toBe(false)
    expect(transitionJobOffer("open", "open")).toEqual({ ok: true, value: { status: "open", changed: false } })
    expect(transitionJobOffer("open", "suspended")).toEqual({ ok: true, value: { status: "suspended", changed: true } })
    expect(transitionJobOffer("suspended", "open")).toEqual({ ok: true, value: { status: "open", changed: true } })
    expect(transitionJobOffer("draft", "suspended")).toEqual({ ok: false, code: "job_offer_transition_invalid" })
    expect(transitionJobOffer("closed", "open")).toEqual({ ok: false, code: "job_offer_closed" })
    expect(transitionJobOffer("closed", "closed")).toEqual({ ok: true, value: { status: "closed", changed: false } })
  })

  it("une date limite atteinte vaut clôture, pour une offre ouverte ou suspendue seulement", () => {
    expect(effectiveJobOfferStatus({ status: "open", closesAt: NOW }, NOW)).toBe("closed")
    expect(effectiveJobOfferStatus({ status: "suspended", closesAt: NOW - 1 }, NOW)).toBe("closed")
    expect(effectiveJobOfferStatus({ status: "open", closesAt: NOW + 1 }, NOW)).toBe("open")
    expect(effectiveJobOfferStatus({ status: "open", closesAt: null }, NOW)).toBe("open")
    expect(effectiveJobOfferStatus({ status: "draft", closesAt: NOW - 1 }, NOW)).toBe("draft")
    expect(isJobOfferOpen({ status: "open", closesAt: null }, NOW)).toBe(true)
    expect(isJobOfferOpen({ status: "open", closesAt: NOW - 1 }, NOW)).toBe(false)
    expect(isJobOfferOpen({ status: "suspended", closesAt: null }, NOW)).toBe(false)
  })

  it("se modifie tant qu'elle n'est pas close ; naît brouillon ou ouverte ; cite sa version", () => {
    expect(isJobOfferEditable("suspended")).toBe(true)
    expect(isJobOfferEditable("closed")).toBe(false)
    expect(initialJobOfferStatus(true)).toBe("open")
    expect(initialJobOfferStatus(false)).toBe("draft")
    expect(checkJobOfferVersion(3, 3)).toEqual({ ok: true, value: 4 })
    expect(checkJobOfferVersion(3, 2)).toEqual({ ok: false, code: "job_offer_version_conflict" })
  })

  it("date la publication à la première ouverture d'un brouillon, jamais à une reprise", () => {
    expect(jobOfferPublishedAt("draft", "open", 10, NOW)).toBe(NOW)
    expect(jobOfferPublishedAt("suspended", "open", 10, NOW)).toBe(10)
    expect(jobOfferPublishedAt("open", "closed", 10, NOW)).toBe(10)
  })
})

describe("la recherche des offres", () => {
  it("replie la requête, l'ignore sous deux caractères, la refuse trop longue", () => {
    expect(parseJobQuery(undefined)).toEqual({ ok: true, value: null })
    expect(parseJobQuery(" z ")).toEqual({ ok: true, value: null })
    expect(parseJobQuery("Comptable À Lyon")).toEqual({ ok: true, value: "comptable a lyon" })
    expect(parseJobQuery("x".repeat(JOB_QUERY_MAX_LENGTH + 1))).toEqual({ ok: false, code: "job_query_too_long" })
  })

  it("normalise chaque filtre ; une valeur vide vaut « sans ce filtre »", () => {
    expect(parseJobSearch({})).toEqual({ ok: true, value: NO_FILTERS })
    expect(parseJobSearch({ query: "", country: " ", city: " ", contract: "", workMode: "" })).toEqual({ ok: true, value: NO_FILTERS })
    expect(parseJobSearch({ query: "Cuisine", country: "fr", city: "Saint Étienne", contract: "cdd", workMode: "remote" })).toEqual({
      ok: true,
      value: { query: "cuisine", country: "FR", cityKey: "saint etienne", contract: "cdd", workMode: "remote" },
    })
  })

  it.each([
    [{ query: "x".repeat(JOB_QUERY_MAX_LENGTH + 1) }, "job_query_too_long"],
    [{ country: "GA" }, "job_country_is_home"],
    [{ city: "x".repeat(JOB_CITY_MAX_LENGTH + 1) }, "job_city_too_long"],
    [{ contract: "benevolat" }, "job_contract_invalid"],
    [{ workMode: "partout" }, "job_work_mode_invalid"],
  ] as const)("refuse le filtre %o", (input, code) => {
    expect(parseJobSearch(input as JobSearchInput)).toEqual({ ok: false, code })
  })

  it("chaque filtre restreint ; sans filtre, toute offre répond", () => {
    const offer = { country: "FR", cityKey: "lyon", contract: "cdi", workMode: "hybrid" }
    expect(matchesJobFilters(offer, NO_FILTERS)).toBe(true)
    expect(matchesJobFilters(offer, { ...NO_FILTERS, country: "BE" })).toBe(false)
    expect(matchesJobFilters(offer, { ...NO_FILTERS, cityKey: "paris" })).toBe(false)
    expect(matchesJobFilters(offer, { ...NO_FILTERS, contract: "cdd" })).toBe(false)
    expect(matchesJobFilters(offer, { ...NO_FILTERS, workMode: "remote" })).toBe(false)
    expect(matchesJobFilters(offer, { query: "x", country: "FR", cityKey: "lyon", contract: "cdi", workMode: "hybrid" })).toBe(true)
  })

  it("chaque mot cherché commence un mot du texte indexé", () => {
    expect(matchesJobQuery("cuisinier traiteur paris", null)).toBe(true)
    expect(matchesJobQuery("cuisinier traiteur paris", "cuisin par")).toBe(true)
    expect(matchesJobQuery("cuisinier traiteur paris", "lyon")).toBe(false)
  })

  it("borne la taille d'une page", () => {
    expect(clampJobPageSize(Number.NaN, 20)).toBe(20)
    expect(clampJobPageSize(Number.POSITIVE_INFINITY, 12)).toBe(12)
    expect(clampJobPageSize(0, 20)).toBe(1)
    expect(clampJobPageSize(7.9, 20)).toBe(7)
    expect(clampJobPageSize(500, 20)).toBe(20)
  })
})

describe("une candidature", () => {
  const INPUT = { message: "Bonjour,\r\n\r\n\r\nJ'ai cinq ans d'expérience en cuisine collective.  ", shareName: true, shareTalentProfile: false }

  it("normalise le message et exige le consentement à transmettre son nom", () => {
    expect(normalizeJobApplication(INPUT)).toEqual({
      ok: true,
      value: { message: "Bonjour,\n\nJ'ai cinq ans d'expérience en cuisine collective.", shareName: true, shareTalentProfile: false },
    })
    expect(normalizeJobApplication({ ...INPUT, shareTalentProfile: true })).toMatchObject({ ok: true, value: { shareTalentProfile: true } })
    expect(normalizeJobApplication({ ...INPUT, message: "Trop court." })).toEqual({ ok: false, code: "job_application_message_too_short" })
    expect(normalizeJobApplication({ ...INPUT, message: "x".repeat(JOB_APPLICATION_MESSAGE_MAX_LENGTH + 1) })).toEqual({ ok: false, code: "job_application_message_too_long" })
    expect(normalizeJobApplication({ ...INPUT, message: "Joignable au 06 12 34 56 78 toute la journée." })).toEqual({ ok: false, code: "job_contact_details_forbidden" })
    expect(normalizeJobApplication({ ...INPUT, shareName: false })).toEqual({ ok: false, code: "job_application_consent_required" })
  })

  it("reconnaît une clé d'envoi et une empreinte stable du corps", () => {
    expect(isJobIdempotencyKey("candidature-0123456789")).toBe(true)
    expect(isJobIdempotencyKey("court")).toBe(false)
    expect(isJobIdempotencyKey("espace interdite dans la clé")).toBe(false)
    const body = { jobId: "job-1", offerVersion: 2, message: "Motivation fictive.", shareTalentProfile: false }
    const print = jobApplicationFingerprint(body)
    expect(print).toMatch(/^v1:[0-9a-f]{16}$/)
    expect(jobApplicationFingerprint({ ...body })).toBe(print)
    expect(jobApplicationFingerprint({ ...body, shareTalentProfile: true })).not.toBe(print)
    expect(jobApplicationFingerprint({ ...body, offerVersion: 3 })).not.toBe(print)
  })

  it("envoyée → vue → présélectionnée | non retenue ; retirée par la personne ; un geste acquis ne change rien", () => {
    expect(transitionJobApplication({ actor: "page", action: "mark_seen", status: "sent" })).toEqual({ ok: true, value: { status: "seen", changed: true } })
    expect(transitionJobApplication({ actor: "page", action: "mark_seen", status: "shortlisted" })).toEqual({ ok: true, value: { status: "shortlisted", changed: false } })
    expect(transitionJobApplication({ actor: "page", action: "shortlist", status: "seen" })).toEqual({ ok: true, value: { status: "shortlisted", changed: true } })
    expect(transitionJobApplication({ actor: "page", action: "not_select", status: "shortlisted" })).toEqual({ ok: true, value: { status: "not_selected", changed: true } })
    expect(transitionJobApplication({ actor: "candidate", action: "withdraw", status: "seen" })).toEqual({ ok: true, value: { status: "withdrawn", changed: true } })
    expect(transitionJobApplication({ actor: "candidate", action: "withdraw", status: "withdrawn" })).toEqual({ ok: true, value: { status: "withdrawn", changed: false } })
    // Le mauvais acteur, un état d'où le geste ne mène nulle part : refusés.
    expect(transitionJobApplication({ actor: "candidate", action: "shortlist", status: "sent" })).toEqual({ ok: false, code: "job_application_transition_invalid" })
    expect(transitionJobApplication({ actor: "page", action: "withdraw", status: "sent" })).toEqual({ ok: false, code: "job_application_transition_invalid" })
    expect(transitionJobApplication({ actor: "page", action: "shortlist", status: "not_selected" })).toEqual({ ok: false, code: "job_application_transition_invalid" })
    expect(transitionJobApplication({ actor: "page", action: "mark_seen", status: "withdrawn" })).toEqual({ ok: false, code: "job_application_transition_invalid" })
    expect(transitionJobApplication({ actor: "candidate", action: "withdraw", status: "not_selected" })).toEqual({ ok: false, code: "job_application_transition_invalid" })
  })

  it("dit les gestes ouverts à chaque acteur, et les états terminaux", () => {
    expect(availableJobApplicationActions("page", "sent")).toEqual(["mark_seen", "shortlist", "not_select"])
    expect(availableJobApplicationActions("page", "shortlisted")).toEqual(["not_select"])
    expect(availableJobApplicationActions("page", "withdrawn")).toEqual([])
    expect(availableJobApplicationActions("candidate", "seen")).toEqual(["withdraw"])
    expect(availableJobApplicationActions("candidate", "not_selected")).toEqual([])
    expect(JOB_APPLICATION_ACTIONS).toHaveLength(4)
    expect(isJobApplicationTerminal("not_selected")).toBe(true)
    expect(isJobApplicationTerminal("withdrawn")).toBe(true)
    expect(isJobApplicationTerminal("seen")).toBe(false)
  })

  it("juge le motif de non-sélection : facultatif, borné, sans coordonnée", () => {
    expect(parseJobDecisionReason(undefined)).toEqual({ ok: true, value: null })
    expect(parseJobDecisionReason("   ")).toEqual({ ok: true, value: null })
    expect(parseJobDecisionReason(" Profil plus junior que le poste. ")).toEqual({ ok: true, value: "Profil plus junior que le poste." })
    expect(parseJobDecisionReason("x".repeat(JOB_DECISION_REASON_MAX_LENGTH + 1))).toEqual({ ok: false, code: "job_decision_reason_too_long" })
    expect(parseJobDecisionReason("Rappeler au 06 12 34 56 78")).toEqual({ ok: false, code: "job_contact_details_forbidden" })
  })
})

describe("un profil de talent", () => {
  it("se normalise : compétences sans doublon replié ni ligne vide, texte indexé, pays", () => {
    expect(parseTalentProfile(TALENT)).toEqual({
      ok: true,
      value: {
        title: "Comptable bilingue",
        skills: ["Comptabilité", "Paie"],
        searchText: talentSearchTextOf("Comptable bilingue", ["Comptabilité", "Paie"]),
        availability: "one_month",
        languages: ["fr", "en"],
        country: "BE",
        visibility: "network",
      },
    })
    expect(talentSearchTextOf("Juriste", ["Droit des contrats", "Recherche"])).toBe("juriste droit des contrats recherche")
  })

  it.each([
    [{ title: "Ab" }, "talent_title_too_short"],
    [{ title: "x".repeat(TALENT_TITLE_MAX_LENGTH + 1) }, "talent_title_too_long"],
    [{ title: "Comptable, voir www.exemple.com" }, "job_contact_details_forbidden"],
    [{ skills: [] }, "talent_skills_required"],
    [{ availability: "tomorrow" }, "talent_availability_invalid"],
    [{ languages: ["klingon"] }, "job_language_invalid"],
    [{ country: "" }, "job_country_required"],
    [{ visibility: "public" }, "talent_visibility_invalid"],
  ] as const)("refuse %o avec son code fermé", (change, code) => {
    expect(parseTalentProfile({ ...TALENT, ...(change as Partial<TalentProfileInput>) })).toEqual({ ok: false, code })
  })

  it("juge les compétences : de une à quinze, chacune bornée et sans coordonnée", () => {
    expect(parseTalentSkills([" ", ""])).toEqual({ ok: false, code: "talent_skills_required" })
    expect(parseTalentSkills(["A"])).toEqual({ ok: false, code: "talent_skill_invalid" })
    expect(parseTalentSkills(["x".repeat(TALENT_SKILL_MAX_LENGTH + 1)])).toEqual({ ok: false, code: "talent_skill_invalid" })
    expect(parseTalentSkills(["contact@exemple.fr"])).toEqual({ ok: false, code: "job_contact_details_forbidden" })
    const many = Array.from({ length: TALENT_SKILLS_MAX + 1 }, (_, index) => `Compétence ${index}`)
    expect(parseTalentSkills(many)).toEqual({ ok: false, code: "talent_skills_too_many" })
    expect(parseTalentSkills(["Paie", "PAIE", " paie "])).toEqual({ ok: true, value: ["Paie"] })
  })

  it("se cherche par pays OBLIGATOIRE et compétence facultative", () => {
    expect(parseTalentSearch({ country: "fr" })).toEqual({ ok: true, value: { country: "FR", skill: null } })
    expect(parseTalentSearch({ country: "FR", skill: "Comptabilité" })).toEqual({ ok: true, value: { country: "FR", skill: "comptabilite" } })
    expect(parseTalentSearch({ country: "" })).toEqual({ ok: false, code: "job_country_required" })
    expect(parseTalentSearch({ country: "FR", skill: "x".repeat(JOB_QUERY_MAX_LENGTH + 1) })).toEqual({ ok: false, code: "job_query_too_long" })
  })

  it("n'est visible que s'il est actif ET visible du réseau ; joignable dès qu'il est actif", () => {
    expect(isTalentListed({ status: "active", visibility: "network" })).toBe(true)
    expect(isTalentListed({ status: "active", visibility: "unlisted" })).toBe(false)
    expect(isTalentListed({ status: "hidden", visibility: "network" })).toBe(false)
    expect(isTalentAttachable({ status: "active" })).toBe(true)
    expect(isTalentAttachable({ status: "hidden" })).toBe(false)
  })

  it("cite sa version : `null` pour une création, la version lue pour une modification", () => {
    expect(checkTalentProfileVersion(null, null)).toEqual({ ok: true, value: 1 })
    expect(checkTalentProfileVersion(2, 2)).toEqual({ ok: true, value: 3 })
    expect(checkTalentProfileVersion(2, null)).toEqual({ ok: false, code: "talent_profile_version_conflict" })
    expect(checkTalentProfileVersion(null, 1)).toEqual({ ok: false, code: "talent_profile_version_conflict" })
  })

  it("se nomme en liste par le prénom et l'initiale du nom de famille, jamais le nom complet", () => {
    expect(talentShortName(undefined)).toBeNull()
    expect(talentShortName("   ")).toBeNull()
    expect(talentShortName("Awa")).toBe("Awa")
    expect(talentShortName("Mireille Ivindo")).toBe("Mireille I.")
    expect(talentShortName("NDONG MBA Jean-Rémy")).toBe("Jean-Rémy N.")
    expect(talentShortName("Jean-Rémy Éloïse NDONG")).toBe("Jean-Rémy N.")
    expect(talentShortName("NDONG")).toBe("NDONG")
    expect(talentShortName("Awa 2")).toBe("Awa 2.")
    expect(talentShortName("Prisca éla")).toBe("Prisca É.")
  })
})
