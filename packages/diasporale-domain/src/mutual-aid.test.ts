import { describe, expect, test } from "bun:test"

import {
  AID_ANSWER_GESTURES,
  AID_ANSWER_MAX_LENGTH,
  AID_ANSWER_STATUSES,
  AID_ANSWERS_PER_QUESTION_MAX,
  AID_CITY_MAX_LENGTH,
  AID_DETAIL_MAX_LENGTH,
  AID_MISSION_AREA_MAX_LENGTH,
  AID_MISSION_DESCRIPTION_MAX_LENGTH,
  AID_MISSION_GESTURES,
  AID_MISSION_HORIZON_DAYS,
  AID_MISSION_PERIOD_MAX_DAYS,
  AID_MISSION_PLACES_MAX,
  AID_MISSION_STATUSES,
  AID_PAGE_MAX,
  AID_QUESTION_GESTURES,
  AID_QUESTION_LIST_STATUSES,
  AID_QUESTION_STATUSES,
  AID_QUESTION_TRANSITIONS,
  AID_REASON_MAX_LENGTH,
  AID_SIGNUP_STATUSES,
  AID_THEMES,
  AID_TITLE_MAX_LENGTH,
  MUTUAL_AID_REFUSALS,
  aidMissionStatusFor,
  aidSignupBlocker,
  aidStatusWithoutAcceptedAnswer,
  aidTextRefusal,
  checkAidAcceptedAnswer,
  checkAidAnswerGesture,
  checkAidAnswering,
  checkAidMissionGesture,
  checkAidMissionPlacesChange,
  checkAidMissionTiming,
  checkAidQuestionGesture,
  checkAidSignup,
  checkAidSignupWithdrawal,
  isAidMissionLive,
  isAidMissionPast,
  isAidQuestionListStatus,
  isAidTheme,
  parseAidAnswer,
  parseAidCity,
  parseAidCountry,
  parseAidMission,
  parseAidMissionArea,
  parseAidMissionPlaces,
  parseAidMissionSchedule,
  parseAidOptionalCity,
  parseAidPlaceFilter,
  parseAidQuestion,
  parseAidReason,
  parseAidTitle,
  type AidAnswerGestureInput,
  type AidMissionInput,
  type AidQuestionInput,
  type AidSignupFacts,
} from "./mutual-aid"
import { DAY_MS, HOUR_MS } from "./time"

const NOW = Date.UTC(2026, 9, 18, 12, 0, 0)

/** Une question fictive complète : chaque test n'en change qu'un trait. */
const QUESTION: AidQuestionInput = {
  title: "Trouver une colocation à Lyon avant janvier",
  detail: "J'arrive en janvier pour mes études.\n\nQuels quartiers conseillez-vous ?",
  theme: "housing",
  country: "fr",
  city: " Lyon ",
}

/** Une mission fictive complète. */
const MISSION: AidMissionInput = {
  title: "Accueillir les nouveaux arrivants à la gare",
  description: "Orienter les étudiants qui arrivent le samedi matin, avec un plan du quartier.",
  country: "FR",
  city: "Lyon",
  area: "Près de la gare Part-Dieu",
  startsAt: NOW + 7 * DAY_MS,
  endsAt: NOW + 7 * DAY_MS + 3 * HOUR_MS,
  timeZone: "Europe/Paris",
  places: 6,
}

const FACTS: AidSignupFacts = { status: "open", startsAt: NOW + DAY_MS, places: 2, signupCount: 0, signedUp: false }

describe("entraide — listes fermées et bornes", () => {
  test("les thèmes servent les nouveaux arrivants ; les états suivent les deux machines", () => {
    expect(AID_THEMES).toEqual(["housing", "procedures", "health", "employment", "schooling", "transport", "daily_life"])
    expect(AID_QUESTION_STATUSES).toEqual(["open", "resolved", "closed", "withdrawn"])
    expect(AID_QUESTION_LIST_STATUSES).toEqual(["open", "resolved", "closed"])
    expect(AID_ANSWER_STATUSES).toEqual(["published", "withdrawn"])
    expect(AID_MISSION_STATUSES).toEqual(["open", "full", "closed", "cancelled"])
    expect(AID_SIGNUP_STATUSES).toEqual(["confirmed", "withdrawn"])
    expect(AID_QUESTION_GESTURES).toEqual(["edit", "accept", "unaccept", "close", "withdraw"])
    expect(AID_ANSWER_GESTURES).toEqual(["edit", "withdraw"])
    expect(AID_MISSION_GESTURES).toEqual(["edit", "close", "cancel"])
    // Une liste ne montre jamais une question retirée.
    expect((AID_QUESTION_LIST_STATUSES as readonly string[]).includes("withdrawn")).toBe(false)
  })

  test("les refus sont des codes fermés, uniques, préfixés", () => {
    expect(new Set(MUTUAL_AID_REFUSALS).size).toBe(MUTUAL_AID_REFUSALS.length)
    for (const code of MUTUAL_AID_REFUSALS) expect(code).toMatch(/^aid_[a-z_]+$/)
  })

  test("les bornes annoncées", () => {
    expect(AID_TITLE_MAX_LENGTH).toBe(140)
    expect(AID_DETAIL_MAX_LENGTH).toBe(2000)
    expect(AID_ANSWER_MAX_LENGTH).toBe(2000)
    expect(AID_CITY_MAX_LENGTH).toBe(80)
    expect(AID_MISSION_PLACES_MAX).toBe(500)
    expect(AID_MISSION_HORIZON_DAYS).toBe(365)
    expect(AID_MISSION_PERIOD_MAX_DAYS).toBe(92)
    expect(AID_REASON_MAX_LENGTH).toBe(500)
    expect(AID_ANSWERS_PER_QUESTION_MAX).toBe(300)
    expect(AID_PAGE_MAX).toBe(50)
  })

  test("les gardes de type", () => {
    expect(isAidTheme("health")).toBe(true)
    expect(isAidTheme("finance")).toBe(false)
    expect(isAidQuestionListStatus("resolved")).toBe(true)
    expect(isAidQuestionListStatus("withdrawn")).toBe(false)
  })
})

describe("entraide — textes et coordonnées", () => {
  test("téléphone, e-mail, lien ou domaine : une coordonnée ; numéro et voie : une adresse exacte", () => {
    expect(aidTextRefusal("Appelez le 06 12 34 56 78 après 18 h")).toBe("aid_contact_forbidden")
    expect(aidTextRefusal("Écrivez à quelqu'un@exemple.fr")).toBe("aid_contact_forbidden")
    expect(aidTextRefusal("Tout est sur www.exemple.org")).toBe("aid_contact_forbidden")
    expect(aidTextRefusal("Voir le site mon-asso.fr")).toBe("aid_contact_forbidden")
    expect(aidTextRefusal("Rendez-vous au 12 rue des Lilas")).toBe("aid_address_forbidden")
    expect(aidTextRefusal("Le marché du samedi, près de la gare")).toBeNull()
    // Une année ou une date ne sont pas un numéro de téléphone.
    expect(aidTextRefusal("Rentrée 2026-2027")).toBeNull()
  })

  test("le titre : une ligne bornée, sans coordonnée", () => {
    expect(parseAidTitle("  Trouver   un\nmédecin  ")).toEqual({ ok: true, value: "Trouver un médecin" })
    expect(parseAidTitle("Aide")).toEqual({ ok: false, code: "aid_title_too_short" })
    expect(parseAidTitle("x".repeat(AID_TITLE_MAX_LENGTH + 1))).toEqual({ ok: false, code: "aid_title_too_long" })
    expect(parseAidTitle("Appelez le 0612345678")).toEqual({ ok: false, code: "aid_contact_forbidden" })
  })
})

describe("entraide — le lieu", () => {
  test("le pays : un pays de résidence, jamais le Gabon", () => {
    expect(parseAidCountry(" fr ")).toEqual({ ok: true, value: "FR" })
    expect(parseAidCountry("")).toEqual({ ok: false, code: "aid_country_required" })
    expect(parseAidCountry(undefined)).toEqual({ ok: false, code: "aid_country_required" })
    expect(parseAidCountry(null)).toEqual({ ok: false, code: "aid_country_required" })
    expect(parseAidCountry("ZZ")).toEqual({ ok: false, code: "aid_country_unknown" })
    expect(parseAidCountry("ga")).toEqual({ ok: false, code: "aid_country_is_home" })
  })

  test("la ville saisie se replie ; vide, trop longue, sans lettre ou portant une coordonnée : refusée", () => {
    expect(parseAidCity("  Saint-Étienne ")).toEqual({ ok: true, value: { city: "Saint-Étienne", cityKey: "saint etienne" } })
    expect(parseAidCity(" ")).toEqual({ ok: false, code: "aid_city_required" })
    expect(parseAidCity(undefined)).toEqual({ ok: false, code: "aid_city_required" })
    expect(parseAidCity("x".repeat(AID_CITY_MAX_LENGTH + 1))).toEqual({ ok: false, code: "aid_city_too_long" })
    expect(parseAidCity("-")).toEqual({ ok: false, code: "aid_city_invalid" })
    expect(parseAidCity("Lyon 06 12 34 56 78")).toEqual({ ok: false, code: "aid_contact_forbidden" })
  })

  test("une ville facultative : vide, aucune ; sinon la même règle", () => {
    expect(parseAidOptionalCity("   ")).toEqual({ ok: true, value: null })
    expect(parseAidOptionalCity(null)).toEqual({ ok: true, value: null })
    expect(parseAidOptionalCity("Bruxelles")).toEqual({ ok: true, value: { city: "Bruxelles", cityKey: "bruxelles" } })
    expect(parseAidOptionalCity("'")).toEqual({ ok: false, code: "aid_city_invalid" })
  })

  test("le filtre d'une liste : un pays obligatoire, une ville facultative repliée", () => {
    expect(parseAidPlaceFilter({ country: "be" })).toEqual({ ok: true, value: { country: "BE", cityKey: null } })
    expect(parseAidPlaceFilter({ country: "FR", city: " LYON " })).toEqual({ ok: true, value: { country: "FR", cityKey: "lyon" } })
    expect(parseAidPlaceFilter({ country: "GA", city: "Lyon" })).toEqual({ ok: false, code: "aid_country_is_home" })
    expect(parseAidPlaceFilter({ country: "FR", city: "x".repeat(81) })).toEqual({ ok: false, code: "aid_city_too_long" })
  })
})

describe("entraide — une question", () => {
  test("une question complète est normalisée : titre, détail en paragraphes, pays, ville repliée", () => {
    expect(parseAidQuestion(QUESTION)).toEqual({
      ok: true,
      value: {
        title: "Trouver une colocation à Lyon avant janvier",
        detail: "J'arrive en janvier pour mes études.\n\nQuels quartiers conseillez-vous ?",
        theme: "housing",
        country: "FR",
        city: "Lyon",
        cityKey: "lyon",
      },
    })
  })

  test("le détail et la ville sont facultatifs", () => {
    const parsed = parseAidQuestion({ ...QUESTION, detail: "   ", city: undefined })
    expect(parsed).toEqual({ ok: true, value: expect.objectContaining({ detail: "", city: null, cityKey: null }) })
  })

  test.each([
    [{ title: "Bof" }, "aid_title_too_short"],
    [{ detail: "x".repeat(AID_DETAIL_MAX_LENGTH + 1) }, "aid_detail_too_long"],
    [{ detail: "Mon numéro : 07 11 22 33 44" }, "aid_contact_forbidden"],
    [{ detail: "J'habite au 3 bis, avenue Jean Jaurès" }, "aid_address_forbidden"],
    [{ theme: "finance" }, "aid_theme_invalid"],
    [{ country: "GA" }, "aid_country_is_home"],
    [{ city: "x".repeat(AID_CITY_MAX_LENGTH + 1) }, "aid_city_too_long"],
  ] as const)("refuse %o avec %s", (change, code) => {
    expect(parseAidQuestion({ ...QUESTION, ...change })).toEqual({ ok: false, code })
  })

  test("une réponse : bornée, sans coordonnée ni adresse exacte", () => {
    expect(parseAidAnswer("  La TCL vend un abonnement étudiant.  ")).toEqual({ ok: true, value: "La TCL vend un abonnement étudiant." })
    expect(parseAidAnswer(" a ")).toEqual({ ok: false, code: "aid_answer_too_short" })
    expect(parseAidAnswer("x".repeat(AID_ANSWER_MAX_LENGTH + 1))).toEqual({ ok: false, code: "aid_answer_too_long" })
    expect(parseAidAnswer("Écris-moi : moi@exemple.fr")).toEqual({ ok: false, code: "aid_contact_forbidden" })
    expect(parseAidAnswer("C'est au 10 Oak Lane")).toEqual({ ok: false, code: "aid_address_forbidden" })
  })

  test("le motif facultatif d'un geste", () => {
    expect(parseAidReason(undefined)).toEqual({ ok: true, value: null })
    expect(parseAidReason("  ")).toEqual({ ok: true, value: null })
    expect(parseAidReason(" Salle indisponible ")).toEqual({ ok: true, value: "Salle indisponible" })
    expect(parseAidReason("x".repeat(AID_REASON_MAX_LENGTH + 1))).toEqual({ ok: false, code: "aid_reason_too_long" })
    expect(parseAidReason("Appelez le 06 12 34 56 78")).toEqual({ ok: false, code: "aid_contact_forbidden" })
  })
})

describe("entraide — gestes de l'auteur d'une question", () => {
  const gesture = (change: Partial<Parameters<typeof checkAidQuestionGesture>[0]> = {}) => checkAidQuestionGesture({
    gesture: "accept", isAuthor: true, status: "open", expectedVersion: 3, version: 3, ...change,
  })

  test("la table des transitions", () => {
    expect(AID_QUESTION_TRANSITIONS.accept).toEqual({ from: ["open", "resolved"], to: "resolved" })
    expect(AID_QUESTION_TRANSITIONS.withdraw.from).toEqual(["open", "resolved", "closed"])
  })

  test("seul l'auteur agit, à la version lue", () => {
    expect(gesture({ isAuthor: false })).toEqual({ ok: false, code: "aid_not_author" })
    expect(gesture({ expectedVersion: 2 })).toEqual({ ok: false, code: "aid_version_conflict" })
    // L'auteur passe avant la version : un tiers ne sait même pas si la ligne a changé.
    expect(gesture({ isAuthor: false, expectedVersion: 2 })).toEqual({ ok: false, code: "aid_not_author" })
  })

  test("retenir, changer de réponse retenue, ne plus retenir", () => {
    expect(gesture()).toEqual({ ok: true, value: "resolved" })
    expect(gesture({ status: "resolved" })).toEqual({ ok: true, value: "resolved" })
    expect(gesture({ gesture: "unaccept", status: "resolved" })).toEqual({ ok: true, value: "open" })
    expect(gesture({ gesture: "unaccept", status: "open" })).toEqual({ ok: false, code: "aid_question_not_resolved" })
  })

  test("modifier garde l'état ; clore ferme ; retirer est terminal", () => {
    expect(gesture({ gesture: "edit", status: "resolved" })).toEqual({ ok: true, value: "resolved" })
    expect(gesture({ gesture: "close", status: "resolved" })).toEqual({ ok: true, value: "closed" })
    expect(gesture({ gesture: "withdraw", status: "closed" })).toEqual({ ok: true, value: "withdrawn" })
    for (const name of ["edit", "accept", "unaccept", "close"] as const) {
      expect(gesture({ gesture: name, status: "closed" })).toEqual({ ok: false, code: "aid_question_closed" })
    }
    for (const name of AID_QUESTION_GESTURES) {
      expect(gesture({ gesture: name, status: "withdrawn" })).toEqual({ ok: false, code: "aid_question_withdrawn" })
    }
  })

  test("répondre : ni close, ni retirée, sous le plafond", () => {
    expect(checkAidAnswering({ questionStatus: "open", answerCount: 0 })).toEqual({ ok: true, value: true })
    expect(checkAidAnswering({ questionStatus: "resolved", answerCount: 4 })).toEqual({ ok: true, value: true })
    expect(checkAidAnswering({ questionStatus: "closed", answerCount: 0 })).toEqual({ ok: false, code: "aid_question_closed" })
    expect(checkAidAnswering({ questionStatus: "withdrawn", answerCount: 0 })).toEqual({ ok: false, code: "aid_question_withdrawn" })
    expect(checkAidAnswering({ questionStatus: "open", answerCount: AID_ANSWERS_PER_QUESTION_MAX })).toEqual({ ok: false, code: "aid_answers_limit_reached" })
  })

  test("la réponse retenue : une réponse publiée de CETTE question", () => {
    expect(checkAidAcceptedAnswer({ questionId: "q-1", status: "published" }, "q-1")).toEqual({ ok: true, value: true })
    expect(checkAidAcceptedAnswer({ questionId: "q-2", status: "published" }, "q-1")).toEqual({ ok: false, code: "aid_answer_unavailable" })
    expect(checkAidAcceptedAnswer({ questionId: "q-1", status: "withdrawn" }, "q-1")).toEqual({ ok: false, code: "aid_answer_unavailable" })
    expect(checkAidAcceptedAnswer(null, "q-1")).toEqual({ ok: false, code: "aid_answer_unavailable" })
  })

  test("sans sa réponse retenue, une question résolue redevient ouverte ; close ou ouverte, elle le reste", () => {
    expect(aidStatusWithoutAcceptedAnswer("resolved")).toBe("open")
    expect(aidStatusWithoutAcceptedAnswer("closed")).toBe("closed")
    expect(aidStatusWithoutAcceptedAnswer("open")).toBe("open")
  })
})

describe("entraide — gestes de l'auteur d'une réponse", () => {
  const answer = (change: Partial<AidAnswerGestureInput> = {}) => checkAidAnswerGesture({
    gesture: "edit", isAuthor: true, status: "published", isAccepted: false, questionStatus: "open", expectedVersion: 1, version: 1, ...change,
  })

  test("modifier sa réponse publiée sur une question ouverte ou résolue", () => {
    expect(answer()).toEqual({ ok: true, value: "published" })
    expect(answer({ questionStatus: "resolved" })).toEqual({ ok: true, value: "published" })
  })

  test("refus : un tiers, une version périmée, une réponse retirée, une question retirée ou close, la réponse retenue", () => {
    expect(answer({ isAuthor: false })).toEqual({ ok: false, code: "aid_not_author" })
    expect(answer({ expectedVersion: 0 })).toEqual({ ok: false, code: "aid_version_conflict" })
    expect(answer({ status: "withdrawn" })).toEqual({ ok: false, code: "aid_answer_withdrawn" })
    expect(answer({ questionStatus: "withdrawn" })).toEqual({ ok: false, code: "aid_question_withdrawn" })
    expect(answer({ questionStatus: "closed" })).toEqual({ ok: false, code: "aid_question_closed" })
    expect(answer({ isAccepted: true })).toEqual({ ok: false, code: "aid_answer_locked" })
  })

  test("retirer sa réponse reste possible, même retenue ou sur une question close", () => {
    expect(answer({ gesture: "withdraw", isAccepted: true, questionStatus: "closed" })).toEqual({ ok: true, value: "withdrawn" })
    expect(answer({ gesture: "withdraw", status: "withdrawn" })).toEqual({ ok: false, code: "aid_answer_withdrawn" })
  })
})

describe("entraide — une mission bénévole", () => {
  test("une mission complète est normalisée", () => {
    expect(parseAidMission(MISSION)).toEqual({
      ok: true,
      value: {
        title: MISSION.title,
        description: MISSION.description,
        country: "FR",
        city: "Lyon",
        cityKey: "lyon",
        area: "Près de la gare Part-Dieu",
        startsAt: MISSION.startsAt,
        endsAt: MISSION.endsAt ?? null,
        timeZone: "Europe/Paris",
        places: 6,
      },
    })
  })

  test("le lieu approximatif et la fin sont facultatifs ; le fuseau devient canonique", () => {
    const parsed = parseAidMission({ ...MISSION, area: "  ", endsAt: undefined, timeZone: " Europe/Paris " })
    expect(parsed).toEqual({ ok: true, value: expect.objectContaining({ area: null, endsAt: null, timeZone: "Europe/Paris" }) })
  })

  test.each([
    [{ title: "Aide" }, "aid_title_too_short"],
    [{ description: "Trop bref" }, "aid_mission_description_too_short"],
    [{ description: "x".repeat(AID_MISSION_DESCRIPTION_MAX_LENGTH + 1) }, "aid_mission_description_too_long"],
    [{ description: "Contactez le responsable au 06 12 34 56 78." }, "aid_contact_forbidden"],
    [{ country: "GA" }, "aid_country_is_home"],
    [{ city: "" }, "aid_city_required"],
    [{ area: "x".repeat(AID_MISSION_AREA_MAX_LENGTH + 1) }, "aid_mission_area_too_long"],
    [{ area: "Au 5 rue de la République" }, "aid_address_forbidden"],
    [{ timeZone: "+02:00" }, "aid_time_zone_invalid"],
    [{ startsAt: Number.NaN }, "aid_mission_schedule_invalid"],
    [{ endsAt: MISSION.startsAt }, "aid_mission_schedule_invalid"],
    [{ endsAt: MISSION.startsAt + (AID_MISSION_PERIOD_MAX_DAYS + 1) * DAY_MS }, "aid_mission_schedule_invalid"],
    [{ endsAt: Number.POSITIVE_INFINITY }, "aid_mission_schedule_invalid"],
    [{ places: 0 }, "aid_mission_places_invalid"],
    [{ places: 2.5 }, "aid_mission_places_invalid"],
    [{ places: AID_MISSION_PLACES_MAX + 1 }, "aid_mission_places_invalid"],
  ] as const)("refuse %o avec %s", (change, code) => {
    expect(parseAidMission({ ...MISSION, ...change })).toEqual({ ok: false, code })
  })

  test("le lieu, l'horaire et les places, règle par règle", () => {
    expect(parseAidMissionArea(undefined)).toEqual({ ok: true, value: null })
    expect(parseAidMissionArea(" Quartier  de la Guillotière ")).toEqual({ ok: true, value: "Quartier de la Guillotière" })
    expect(parseAidMissionSchedule({ startsAt: NOW, endsAt: null, timeZone: "Europe/Paris" })).toEqual({ ok: true, value: { startsAt: NOW, endsAt: null, timeZone: "Europe/Paris" } })
    expect(parseAidMissionSchedule({ startsAt: -1, endsAt: null, timeZone: "UTC" })).toEqual({ ok: false, code: "aid_mission_schedule_invalid" })
    expect(parseAidMissionPlaces(1)).toEqual({ ok: true, value: 1 })
    expect(parseAidMissionPlaces(AID_MISSION_PLACES_MAX)).toEqual({ ok: true, value: AID_MISSION_PLACES_MAX })
  })

  test("l'heure : dans le futur, à un an au plus", () => {
    expect(checkAidMissionTiming(NOW + 1, NOW)).toEqual({ ok: true, value: true })
    expect(checkAidMissionTiming(NOW, NOW)).toEqual({ ok: false, code: "aid_mission_start_past" })
    expect(checkAidMissionTiming(NOW + AID_MISSION_HORIZON_DAYS * DAY_MS, NOW)).toEqual({ ok: true, value: true })
    expect(checkAidMissionTiming(NOW + AID_MISSION_HORIZON_DAYS * DAY_MS + 1, NOW)).toEqual({ ok: false, code: "aid_mission_too_far" })
  })

  test("l'état suit les places ; une mission vivante est ouverte ou complète ; une mission passée", () => {
    expect(aidMissionStatusFor(3, 2)).toBe("open")
    expect(aidMissionStatusFor(3, 3)).toBe("full")
    expect(isAidMissionLive("open")).toBe(true)
    expect(isAidMissionLive("full")).toBe(true)
    expect(isAidMissionLive("closed")).toBe(false)
    expect(isAidMissionLive("cancelled")).toBe(false)
    expect(isAidMissionPast({ startsAt: NOW - 1, endsAt: null }, NOW)).toBe(true)
    expect(isAidMissionPast({ startsAt: NOW - 1, endsAt: NOW + 1 }, NOW)).toBe(false)
    expect(isAidMissionPast({ startsAt: NOW + 1, endsAt: null }, NOW)).toBe(false)
  })
})

describe("entraide — gestes de l'équipe sur une mission", () => {
  const team = (change: Partial<Parameters<typeof checkAidMissionGesture>[0]> = {}) => checkAidMissionGesture({
    gesture: "edit", status: "open", expectedVersion: 2, version: 2, ...change,
  })

  test("modifier garde l'état, clore ferme les inscriptions, annuler est terminal", () => {
    expect(team()).toEqual({ ok: true, value: "open" })
    expect(team({ status: "full" })).toEqual({ ok: true, value: "full" })
    expect(team({ gesture: "close", status: "full" })).toEqual({ ok: true, value: "closed" })
    expect(team({ gesture: "cancel", status: "closed" })).toEqual({ ok: true, value: "cancelled" })
  })

  test("refus : version périmée, mission annulée, mission close modifiée ou reclose", () => {
    expect(team({ expectedVersion: 1 })).toEqual({ ok: false, code: "aid_version_conflict" })
    for (const gesture of AID_MISSION_GESTURES) expect(team({ gesture, status: "cancelled" })).toEqual({ ok: false, code: "aid_mission_cancelled" })
    expect(team({ status: "closed" })).toEqual({ ok: false, code: "aid_mission_closed" })
    expect(team({ gesture: "close", status: "closed" })).toEqual({ ok: false, code: "aid_mission_closed" })
  })

  test("les places ne descendent jamais sous les inscrits ; l'état les suit", () => {
    expect(checkAidMissionPlacesChange(4, 4)).toEqual({ ok: true, value: "full" })
    expect(checkAidMissionPlacesChange(10, 4)).toEqual({ ok: true, value: "open" })
    expect(checkAidMissionPlacesChange(3, 4)).toEqual({ ok: false, code: "aid_mission_places_below_signups" })
  })
})

describe("entraide — inscriptions bénévoles", () => {
  test("le consentement explicite d'abord, puis les places relues ; la dernière place rend la mission complète", () => {
    expect(checkAidSignup(FACTS, false, NOW)).toEqual({ ok: false, code: "aid_signup_consent_required" })
    expect(checkAidSignup(FACTS, true, NOW)).toEqual({ ok: true, value: { status: "open", signupCount: 1 } })
    expect(checkAidSignup({ ...FACTS, signupCount: 1 }, true, NOW)).toEqual({ ok: true, value: { status: "full", signupCount: 2 } })
  })

  test("ce qui empêche une inscription, dans l'ordre", () => {
    expect(aidSignupBlocker(FACTS, NOW)).toBeNull()
    expect(aidSignupBlocker({ ...FACTS, signedUp: true, status: "cancelled" }, NOW)).toBe("aid_signup_exists")
    expect(aidSignupBlocker({ ...FACTS, status: "cancelled" }, NOW)).toBe("aid_mission_cancelled")
    expect(aidSignupBlocker({ ...FACTS, status: "closed" }, NOW)).toBe("aid_mission_closed")
    expect(aidSignupBlocker(FACTS, FACTS.startsAt)).toBe("aid_mission_started")
    expect(aidSignupBlocker({ ...FACTS, status: "full", signupCount: 2 }, NOW)).toBe("aid_mission_full")
    // Défense : un compte arrivé aux places vaut complète, même si l'état n'a pas encore suivi.
    expect(aidSignupBlocker({ ...FACTS, signupCount: 2 }, NOW)).toBe("aid_mission_full")
    expect(checkAidSignup({ ...FACTS, signupCount: 2 }, true, NOW)).toEqual({ ok: false, code: "aid_mission_full" })
  })

  test("se retirer avant le début libère une place et rouvre une mission complète", () => {
    const full: AidSignupFacts = { ...FACTS, status: "full", signupCount: 2, signedUp: true }
    expect(checkAidSignupWithdrawal(full, NOW)).toEqual({ ok: true, value: { status: "open", signupCount: 1 } })
    expect(checkAidSignupWithdrawal({ ...full, status: "closed" }, NOW)).toEqual({ ok: true, value: { status: "closed", signupCount: 1 } })
    expect(checkAidSignupWithdrawal({ ...full, status: "open", signupCount: 0 }, NOW)).toEqual({ ok: true, value: { status: "open", signupCount: 0 } })
    expect(checkAidSignupWithdrawal({ ...full, signedUp: false }, NOW)).toEqual({ ok: false, code: "aid_signup_missing" })
    expect(checkAidSignupWithdrawal(full, full.startsAt)).toEqual({ ok: false, code: "aid_mission_started" })
  })
})
