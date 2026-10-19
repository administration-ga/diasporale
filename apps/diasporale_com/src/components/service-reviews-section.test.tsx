// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type {
  ActionResult,
  Loadable,
  MembershipView,
  MyServiceReviewView,
  ServiceReviewReplyView,
  ServiceReviewView,
  ServiceReviewsCapability,
  ServiceReviewsPageView,
  SessionView,
} from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, getDefaultNormalizer, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ServiceOfferReviews, ServiceRequestReview, ServiceReviewCard } from "./service-reviews-section"

const mocks = vi.hoisted(() => ({
  capability: null as ServiceReviewsCapability | null,
  session: { status: "loading" } as Loadable<SessionView>,
  mine: { status: "loading" } as Loadable<MyServiceReviewView | null>,
  page: { status: "loading" } as Loadable<ServiceReviewsPageView>,
  readMine: vi.fn<ServiceReviewsCapability["useMyReview"]>(),
  readOffer: vi.fn<ServiceReviewsCapability["useOfferReviews"]>(),
  publish: vi.fn<ServiceReviewsCapability["publish"]>(),
  update: vi.fn<ServiceReviewsCapability["update"]>(),
  withdraw: vi.fn<ServiceReviewsCapability["withdraw"]>(),
  reply: vi.fn<ServiceReviewsCapability["reply"]>(),
  withdrawReply: vi.fn<ServiceReviewsCapability["withdrawReply"]>(),
  report: vi.fn<ServiceReviewsCapability["report"]>(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock("@diasporale/features/data", async (original) => ({
  ...await original<typeof import("@diasporale/features/data")>(),
  useServiceReviews: () => mocks.capability,
  useSession: () => mocks.session,
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

const t = getFixedT("fr")
const normalize = getDefaultNormalizer()
/** Le texte tel que l'écran le lit (espaces insécables ramenées à l'espace simple). */
const text = (key: string) => normalize(String(t(key)))
const NOW = Date.UTC(2026, 9, 18, 12)
const MEMBER: MembershipView = {
  personId: "person-awa", handle: "awa", displayName: "Awa OGOOUÉ", status: "declaree", badges: ["verified"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: null, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: true, rateTier: "standard", directoryVisibility: "hidden",
}
const REVIEW: ServiceReviewView = {
  reviewId: "review-1", pageId: "page-1", offerId: "offer-1", rating: 4,
  body: "Prestation soignée et ponctuelle.", proof: "booking_confirmed", version: 3,
  status: "active", moderation: "published", author: { displayName: MEMBER.displayName },
  isMine: true, canReply: false, reply: null, createdAt: NOW, updatedAt: NOW,
}
const REPLY: ServiceReviewReplyView = {
  replyId: "reply-1", body: "Merci pour votre retour.", version: 2, status: "active",
  moderation: "published", canManage: true, createdAt: NOW, updatedAt: NOW,
}
const CAPABILITY: ServiceReviewsCapability = {
  useMyReview: mocks.readMine,
  useOfferReviews: mocks.readOffer,
  publish: mocks.publish,
  update: mocks.update,
  withdraw: mocks.withdraw,
  reply: mocks.reply,
  withdrawReply: mocks.withdrawReply,
  report: mocks.report,
}

function signedIn(membership: MembershipView | null = MEMBER): Loadable<SessionView> {
  return {
    status: "ready",
    data: { status: "signed_in", account: { id: "account-1", idn: null, local: null, nameHints: {} }, membership },
  }
}

function personalReview(review: ServiceReviewView | null = null): Loadable<MyServiceReviewView | null> {
  return { status: "ready", data: { canCreate: review === null, refusal: null, proof: "booking_confirmed", review } }
}

function requestTree() {
  return <I18nProvider locale="fr"><ServiceRequestReview requestId="request-1" /></I18nProvider>
}

function offerTree() {
  return <I18nProvider locale="fr"><ServiceOfferReviews offerId="offer-1" /></I18nProvider>
}

function cardTree(review: ServiceReviewView) {
  return <I18nProvider locale="fr"><ServiceReviewCard review={review} capability={CAPABILITY} /></I18nProvider>
}

function protectedTree() {
  return (
    <I18nProvider locale="fr">
      <ServiceOfferReviews offerId="offer-1" />
      <ServiceRequestReview requestId="request-1" />
    </I18nProvider>
  )
}

function openReview() {
  fireEvent.click(screen.getByRole("button", { name: t("serviceReviews.mine.write") }))
  return screen.getByRole("dialog", { name: t("serviceReviews.form.title") })
}

function fillReview(body = "Une expérience attentive et ponctuelle.") {
  fireEvent.change(screen.getByLabelText(t("serviceReviews.form.rating")), { target: { value: "5" } })
  fireEvent.change(screen.getByLabelText(t("serviceReviews.form.body")), { target: { value: body } })
}

async function submit(label: string) {
  const form = screen.getByRole("button", { name: label }).closest("form")
  if (!form) throw new Error("formulaire de fixture absent")
  await act(async () => { fireEvent.submit(form) })
}

function pendingPublish() {
  let finish: (result: ActionResult<{ readonly reviewId: string; readonly created: boolean }>) => void = () => {}
  const promise = new Promise<ActionResult<{ readonly reviewId: string; readonly created: boolean }>>((resolve) => { finish = resolve })
  return { promise, finish }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.capability = CAPABILITY
  mocks.session = signedIn()
  mocks.mine = personalReview()
  mocks.page = { status: "ready", data: { items: [], isDone: true, continueCursor: null } }
  mocks.readMine.mockReset().mockImplementation(() => mocks.mine)
  // Référence stable entre deux lectures : le vrai pager est conservé dans ces tests.
  mocks.readOffer.mockReset().mockImplementation(() => mocks.page)
  mocks.publish.mockReset().mockResolvedValue({ ok: true, value: { reviewId: "review-created", created: true } })
  mocks.update.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.withdraw.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.reply.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.withdrawReply.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.report.mockReset().mockResolvedValue({ ok: true, value: null })
})

afterEach(() => {
  cleanup()
})

describe("avis de service — preuve, publication et gestes", () => {
  it("nomme chaque preuve et précise l'absence d'attestation ou de vérification indépendante", () => {
    mocks.page = {
      status: "ready",
      data: {
        items: [
          { ...REVIEW, isMine: false },
          { ...REVIEW, reviewId: "review-2", body: "Une autre expérience du service.", isMine: false, proof: "completion_declared" },
        ],
        isDone: true, continueCursor: null,
      },
    }
    render(offerTree())

    expect(screen.getByRole("heading", { name: t("serviceReviews.list.title") })).toBeVisible()
    expect(screen.getByText(text("serviceReviews.proof.bookingConfirmed"))).toHaveTextContent("la réalisation n’est pas attestée")
    expect(screen.getByText(text("serviceReviews.proof.completionDeclared"))).toHaveTextContent("sans vérification indépendante")
    expect(mocks.readOffer).toHaveBeenCalledWith({ offerId: "offer-1", cursor: null })
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("part sans consentement et ne publie qu'après un accord explicite", async () => {
    render(requestTree())
    openReview()
    const consent = screen.getByRole("checkbox", { name: t("serviceReviews.form.consent") })
    expect(consent).not.toBeChecked()
    fillReview()
    await submit(t("serviceReviews.form.publish"))

    expect(screen.getByRole("alert")).toHaveTextContent(t("errors.review_consent_required"))
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(screen.getByLabelText(t("serviceReviews.form.body"))).toHaveValue("Une expérience attentive et ponctuelle.")

    fireEvent.click(consent)
    await submit(t("serviceReviews.form.publish"))
    expect(mocks.publish).toHaveBeenCalledExactlyOnceWith({
      requestId: "request-1", rating: 5, body: "Une expérience attentive et ponctuelle.", consentToPublish: true,
    })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith(t("serviceReviews.form.saved"))
  })

  it.each(["review_version_changed", "rate_limited"] as const)("conserve le brouillon sur %s et cite la version figée à l'ouverture", async (code) => {
    mocks.mine = personalReview(REVIEW)
    mocks.update.mockResolvedValueOnce({ ok: false, code })
    const view = render(requestTree())
    fireEvent.click(screen.getByRole("button", { name: t("serviceReviews.mine.edit") }))
    fillReview("Mon commentaire corrigé reste dans ce formulaire.")

    mocks.mine = personalReview({ ...REVIEW, version: 4, rating: 1, body: "Texte modifié depuis une autre fenêtre." })
    view.rerender(requestTree())
    await submit(t("serviceReviews.form.save"))

    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
      reviewId: "review-1", expectedVersion: 3, rating: 5, body: "Mon commentaire corrigé reste dans ce formulaire.",
    })
    expect(screen.getByRole("alert")).toHaveTextContent(text(`errors.${code}`))
    expect(screen.getByRole("dialog", { name: t("serviceReviews.form.editTitle") })).toBeVisible()
    expect(screen.getByLabelText(t("serviceReviews.form.body"))).toHaveValue("Mon commentaire corrigé reste dans ce formulaire.")
    expect(screen.getByLabelText(t("serviceReviews.form.rating"))).toHaveValue("5")
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it("confirme le retrait avec la version de l'avis au moment de l'ouverture", async () => {
    mocks.mine = personalReview(REVIEW)
    const view = render(requestTree())
    fireEvent.click(screen.getByRole("button", { name: t("serviceReviews.withdraw.cta") }))
    expect(mocks.withdraw).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog", { name: t("serviceReviews.withdraw.title") })).toHaveTextContent(t("serviceReviews.withdraw.description"))

    mocks.mine = personalReview({ ...REVIEW, version: 4 })
    view.rerender(requestTree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("serviceReviews.withdraw.confirm") })) })

    expect(mocks.withdraw).toHaveBeenCalledExactlyOnceWith({ reviewId: "review-1", expectedVersion: 3 })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(mocks.withdrawReply).not.toHaveBeenCalled()
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it("la page crée puis modifie sa réponse avec sa propre version et peut la retirer séparément", async () => {
    const review: ServiceReviewView = { ...REVIEW, isMine: false, canReply: true }
    const view = render(cardTree(review))
    fireEvent.click(screen.getByRole("button", { name: t("serviceReviews.reply.cta") }))
    fireEvent.change(screen.getByLabelText(t("serviceReviews.reply.body")), { target: { value: "Merci pour cette expérience partagée." } })
    await submit(t("serviceReviews.reply.save"))
    expect(mocks.reply).toHaveBeenNthCalledWith(1, { reviewId: "review-1", expectedVersion: null, body: "Merci pour cette expérience partagée." })

    view.rerender(cardTree({ ...review, reply: REPLY }))
    fireEvent.click(screen.getByRole("button", { name: t("serviceReviews.reply.edit") }))
    fireEvent.change(screen.getByLabelText(t("serviceReviews.reply.body")), { target: { value: "Notre réponse corrigée reste distincte de votre avis." } })
    view.rerender(cardTree({ ...review, reply: { ...REPLY, version: 3 } }))
    await submit(t("serviceReviews.reply.save"))
    expect(mocks.reply).toHaveBeenNthCalledWith(2, { reviewId: "review-1", expectedVersion: 2, body: "Notre réponse corrigée reste distincte de votre avis." })

    fireEvent.click(screen.getByRole("button", { name: t("serviceReviews.reply.withdraw") }))
    expect(mocks.withdrawReply).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("serviceReviews.withdraw.confirm") })) })
    expect(mocks.withdrawReply).toHaveBeenCalledExactlyOnceWith({ reviewId: "review-1", expectedVersion: 3 })
    expect(mocks.withdraw).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it("signale l'avis et la réponse par leurs cibles indépendantes, sans les retirer automatiquement", async () => {
    render(cardTree({ ...REVIEW, isMine: false, reply: { ...REPLY, canManage: false } }))
    fireEvent.click(screen.getByRole("button", { name: t("serviceReviews.report.cta") }))
    fireEvent.change(screen.getByLabelText(t("serviceReviews.report.reason")), { target: { value: "fraud" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("serviceReviews.report.send") })) })

    expect(mocks.report).toHaveBeenNthCalledWith(1, { target: { kind: "review", id: "review-1" }, reason: "fraud" })
    fireEvent.click(screen.getByRole("button", { name: t("serviceReviews.report.reply") }))
    fireEvent.change(screen.getByLabelText(t("serviceReviews.report.reason")), { target: { value: "harassment" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("serviceReviews.report.send") })) })

    expect(mocks.report).toHaveBeenNthCalledWith(2, { target: { kind: "reply", id: "reply-1" }, reason: "harassment" })
    expect(mocks.report).toHaveBeenCalledTimes(2)
    expect(screen.getByText(REVIEW.body)).toBeVisible()
    expect(screen.getByText(REPLY.body)).toBeVisible()
    expect(mocks.withdraw).not.toHaveBeenCalled()
    expect(mocks.withdrawReply).not.toHaveBeenCalled()
  })

  it("un avis retiré ne propose aucune republication ; l'avis en attente se présente comme non publié", () => {
    mocks.mine = personalReview({ ...REVIEW, status: "withdrawn", author: { displayName: null } })
    const view = render(requestTree())
    expect(screen.getByText(t("serviceReviews.withdrawn"))).toBeVisible()
    expect(screen.queryByText(REVIEW.body)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("serviceReviews.mine.write") })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("serviceReviews.mine.edit") })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("serviceReviews.withdraw.cta") })).not.toBeInTheDocument()

    mocks.mine = personalReview({ ...REVIEW, moderation: "pending_review" })
    view.rerender(requestTree())
    expect(screen.getByRole("status")).toHaveTextContent(t("serviceReviews.moderation.pending"))
    expect(screen.queryByText(t("serviceReviews.moderation.published"))).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("serviceReviews.mine.write") })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("serviceReviews.mine.edit") })).toBeEnabled()
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("ignore une publication tardive de l'ancienne personne et conserve la nouvelle feuille sans toast", async () => {
    const pending = pendingPublish()
    mocks.publish.mockReturnValueOnce(pending.promise)
    const view = render(requestTree())
    openReview()
    fillReview("Le commentaire de la première personne.")
    fireEvent.click(screen.getByRole("checkbox"))
    await submit(t("serviceReviews.form.publish"))
    expect(mocks.publish).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: t("serviceReviews.working") })).toBeDisabled()

    mocks.session = signedIn({ ...MEMBER, personId: "person-autre", handle: "autre", displayName: "Éloïse NDONG MBA" })
    mocks.mine = personalReview()
    view.rerender(requestTree())
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    openReview()
    fillReview("Le brouillon de la nouvelle personne reste ouvert.")
    expect(screen.getByRole("checkbox")).not.toBeChecked()

    await act(async () => {
      pending.finish({ ok: true, value: { reviewId: "review-ancienne-personne", created: true } })
      await pending.promise
    })

    expect(screen.getByRole("dialog", { name: t("serviceReviews.form.title") })).toBeVisible()
    expect(screen.getByLabelText(t("serviceReviews.form.body"))).toHaveValue("Le brouillon de la nouvelle personne reste ouvert.")
    expect(screen.getByRole("button", { name: t("serviceReviews.form.publish") })).toBeEnabled()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(mocks.publish).toHaveBeenCalledTimes(1)
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it("ne lit aucune donnée sans capacité ou session membre, et attend les lectures en chargement", () => {
    mocks.capability = null
    const view = render(protectedTree())
    expect(view.container).toBeEmptyDOMElement()
    expect(mocks.readMine).not.toHaveBeenCalled()
    expect(mocks.readOffer).not.toHaveBeenCalled()

    mocks.capability = CAPABILITY
    mocks.session = { status: "loading" }
    view.rerender(protectedTree())
    expect(screen.queryByRole("heading")).not.toBeInTheDocument()
    expect(mocks.readMine).not.toHaveBeenCalled()
    expect(mocks.readOffer).not.toHaveBeenCalled()

    mocks.session = { status: "ready", data: { status: "anonymous" } }
    view.rerender(protectedTree())
    expect(view.container).toBeEmptyDOMElement()
    mocks.session = signedIn(null)
    view.rerender(protectedTree())
    expect(view.container).toBeEmptyDOMElement()
    expect(mocks.readMine).not.toHaveBeenCalled()
    expect(mocks.readOffer).not.toHaveBeenCalled()

    mocks.session = signedIn()
    mocks.mine = { status: "loading" }
    mocks.page = { status: "loading" }
    view.rerender(protectedTree())
    expect(mocks.readMine).toHaveBeenCalledWith({ requestId: "request-1" })
    expect(mocks.readOffer).toHaveBeenCalledWith({ offerId: "offer-1", cursor: null })
    expect(screen.queryByRole("button", { name: t("serviceReviews.mine.write") })).not.toBeInTheDocument()
    expect(screen.queryByText(t("serviceReviews.list.empty"))).not.toBeInTheDocument()
    expect(mocks.publish).not.toHaveBeenCalled()
  })
})
