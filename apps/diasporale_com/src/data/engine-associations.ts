"use client"

/**
 * Adaptateur moteur de la capacité « associations » (DG-010) : les fonctions de
 * la tranche `convex/modules/diaspora/associations.ts` du moteur, bornées par
 * le réseau `diasporale`.
 *
 * - Lectures RÉACTIVES (abonnements Convex) : un rôle de responsable retiré
 *   referme la liste aussitôt (R-G11) ; un refus du serveur devient un code
 *   fermé, jamais un écran blanc. Aucune lecture avant que l'adhésion du
 *   lecteur au réseau ne soit connue.
 * - Écritures : un résultat à code fermé (`errors.<code>`), jamais une exception.
 */
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  ASSOCIATION_LIST_PAGE_SIZE,
  type AssociationListPage,
  type AssociationMemberView,
  type AssociationsCapability,
  type Loadable,
  type ManagedAssociationView,
  type MyAssociationItemView,
  type MyAssociationMembershipView,
} from "@diasporale/features/data"
import type { FunctionReturnType } from "convex/server"
import { useMemo } from "react"

import {
  attemptAction,
  type EngineMember,
  type EngineSourceDeps,
  failed,
  LOADING,
  type Loaded,
  memberReadError,
  ready,
  resolveDiasporaleNetworkId,
  useEngineMember,
  useLoaded,
} from "./engine-kit"

const ASSOCIATIONS = api.modules.diaspora.associations

type MembershipDto = FunctionReturnType<typeof ASSOCIATIONS.myAssociationMembership>
type MyAssociationsDto = FunctionReturnType<typeof ASSOCIATIONS.myAssociations>
type MembersDto = FunctionReturnType<typeof ASSOCIATIONS.associationMembers>
type ManagedDto = FunctionReturnType<typeof ASSOCIATIONS.managedAssociation>

export function toMyMembershipView(dto: MembershipDto): MyAssociationMembershipView {
  return {
    pageId: dto.pageId,
    membership: dto.membership ? { ...dto.membership } : null,
    request: { ...dto.request },
    responsibleRole: dto.responsibleRole,
  }
}

export function toMyAssociationsPage(dto: MyAssociationsDto): AssociationListPage<MyAssociationItemView> {
  return {
    items: dto.page.map((row) => ({
      membershipId: row.membershipId,
      status: row.status,
      role: row.role,
      decisionReason: row.decisionReason,
      statusChangedAt: row.statusChangedAt,
      page: { id: row.page.pageId, handle: row.page.handle, name: row.page.name },
    })),
    continueCursor: dto.isDone ? null : dto.continueCursor,
    isDone: dto.isDone,
  }
}

export function toMembersPage(dto: MembersDto): AssociationListPage<AssociationMemberView> {
  return {
    items: dto.page.map((row) => ({ ...row, person: { ...row.person } })),
    continueCursor: dto.isDone ? null : dto.continueCursor,
    isDone: dto.isDone,
  }
}

export function toManagedView(dto: ManagedDto): ManagedAssociationView {
  return { pageId: dto.pageId, handle: dto.handle, name: dto.name, role: dto.role }
}

/** Le réseau du lecteur quand rien n'empêche la lecture (session, réseau, adhésion lisible), sinon `null`. */
function readableNetwork(member: EngineMember): Id<"networks"> | null {
  if (memberReadError(member) !== null || member.membership.state !== "ready" || member.networkId.state !== "ready") return null
  return member.networkId.value
}

/** Une lecture du moteur, vue par l'écran : le refus du lecteur d'abord, puis celui du serveur. */
function settle<Dto, View>(member: EngineMember, loaded: Loaded<Dto>, view: View | null): Loadable<View> {
  const blocked = memberReadError(member)
  if (blocked) return failed(blocked)
  if (loaded.state === "error") return failed(loaded.code)
  return view === null ? LOADING : ready(view)
}

export function createEngineAssociations(deps: EngineSourceDeps): AssociationsCapability {
  const write = (work: (networkId: Id<"networks">) => Promise<unknown>) => attemptAction(async () => {
    await work(await resolveDiasporaleNetworkId(deps.convex))
    return null
  })

  return {
    useMyMembership(pageId) {
      const member = useEngineMember()
      const networkId = readableNetwork(member)
      const loaded = useLoaded(ASSOCIATIONS.myAssociationMembership, networkId && pageId ? { networkId, pageId: pageId as Id<"pages"> } : "skip")
      const value = loaded.state === "ready" ? loaded.value : null
      const view = useMemo(() => (value ? toMyMembershipView(value) : null), [value])
      return settle(member, loaded, view)
    },

    useMyAssociations({ cursor }) {
      const member = useEngineMember()
      const networkId = readableNetwork(member)
      const loaded = useLoaded(ASSOCIATIONS.myAssociations, networkId ? { networkId, paginationOpts: { cursor, numItems: ASSOCIATION_LIST_PAGE_SIZE } } : "skip")
      const value = loaded.state === "ready" ? loaded.value : null
      const view = useMemo(() => (value ? toMyAssociationsPage(value) : null), [value])
      return settle(member, loaded, view)
    },

    useManagedAssociation(handle) {
      const member = useEngineMember()
      const networkId = readableNetwork(member)
      const loaded = useLoaded(ASSOCIATIONS.managedAssociation, networkId && handle ? { networkId, handle } : "skip")
      const value = loaded.state === "ready" ? loaded.value : null
      const view = useMemo(() => (value ? toManagedView(value) : null), [value])
      return settle(member, loaded, view)
    },

    useMembers({ pageId, status, cursor }) {
      const member = useEngineMember()
      const networkId = readableNetwork(member)
      const loaded = useLoaded(
        ASSOCIATIONS.associationMembers,
        networkId && pageId ? { networkId, pageId: pageId as Id<"pages">, status, paginationOpts: { cursor, numItems: ASSOCIATION_LIST_PAGE_SIZE } } : "skip",
      )
      const value = loaded.state === "ready" ? loaded.value : null
      const view = useMemo(() => (value ? toMembersPage(value) : null), [value])
      return settle(member, loaded, view)
    },

    request: ({ pageId, message }) => write((networkId) => deps.convex.mutation(ASSOCIATIONS.requestAssociationMembership, {
      networkId,
      pageId: pageId as Id<"pages">,
      ...(message.trim() ? { message } : {}),
    })),

    cancelRequest: (pageId) => write((networkId) => deps.convex.mutation(ASSOCIATIONS.cancelAssociationMembershipRequest, { networkId, pageId: pageId as Id<"pages"> })),

    leave: (pageId) => write((networkId) => deps.convex.mutation(ASSOCIATIONS.leaveAssociation, { networkId, pageId: pageId as Id<"pages"> })),

    decide: ({ membershipId, decision, expectedVersion, reason }) => write((networkId) => deps.convex.mutation(ASSOCIATIONS.decideAssociationMembership, {
      networkId,
      membershipId: membershipId as Id<"associationMemberships">,
      decision,
      expectedVersion,
      ...(decision === "reject" && reason.trim() ? { reason } : {}),
    })),

    remove: ({ membershipId, expectedVersion, reason }) => write((networkId) => deps.convex.mutation(ASSOCIATIONS.removeAssociationMember, {
      networkId,
      membershipId: membershipId as Id<"associationMemberships">,
      expectedVersion,
      reason,
    })),

    setRole: ({ membershipId, expectedVersion, role }) => write((networkId) => deps.convex.mutation(ASSOCIATIONS.setAssociationMemberRole, {
      networkId,
      membershipId: membershipId as Id<"associationMemberships">,
      expectedVersion,
      role,
    })),

    allowReadmission: ({ membershipId, expectedVersion }) => write((networkId) => deps.convex.mutation(ASSOCIATIONS.allowAssociationReadmission, {
      networkId,
      membershipId: membershipId as Id<"associationMemberships">,
      expectedVersion,
    })),
  }
}
