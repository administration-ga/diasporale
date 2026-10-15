/**
 * @diasporale/features — surfaces propres à DIASPORALE.
 *
 * Les surfaces du réseau social (fil complet, profil, relations, groupes,
 * messagerie, appels…) viendront de `@antia/social-features` (PA6) ; ce paquet
 * porte ce que la diaspora AJOUTE : l'étiquette pays, le sélecteur de pays,
 * les badges de confiance, les cartes C1–C17, les cartes flottantes (statut,
 * modération, démonstration), le composeur à portée.
 */
export { cn } from "./lib/cn"
export { countryName, residenceCountryOptions, filterCountryOptions, searchKey } from "./lib/countries"
export { formatDate, formatNumber, formatRelative, calendarParts } from "./lib/format"
export { avatarTone, initials } from "./lib/avatar"
export { handleRefusal, normalizeHandle, suggestHandles, HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH } from "./lib/handle"

export { Button, buttonVariants, type ButtonProps } from "./primitives/button"
export { Field, Input, Label, Textarea } from "./primitives/field"
export { Checkbox } from "./primitives/checkbox"
export { RadioCard, RadioGroup } from "./primitives/radio-group"
export { Switch } from "./primitives/switch"
export { Sheet, SheetClose, SheetContent, SheetTrigger, useSheetOpen } from "./primitives/sheet"
export {
  FolderTabs,
  FolderTabsContent,
  FolderTabsList,
  FolderTabsNav,
  FolderTabsTrigger,
  type FolderNavItem,
} from "./primitives/folder-tabs"
export { Avatar, Card, Separator, Skeleton } from "./primitives/surface"
export { FloatingNotice, type NoticeTone } from "./primitives/floating-notice"

export { ContentScopeTag, CountryMonument, CountryTag, ScopeTag } from "./components/country-tag"
export { SponsoredBadge, TrustBadge, TrustBadges } from "./components/trust-badge"
export { StatCounter } from "./components/stat-counter"
export { EmptyState } from "./components/empty-state"
export { ModerationBanner } from "./components/moderation-banner"
export { DemoBanner, DemoChip } from "./components/demo-banner"
export { MembershipStatusBanner, type StatusBannerActions } from "./components/membership-status-banner"
export { CountrySwitch } from "./components/country-switch"
export { BELL_ACTOR_LED_KINDS, BELL_SYSTEM_KINDS, NotificationBell } from "./components/notification-bell"
export { MemberSuggestions } from "./components/suggestions"
export { PostCard } from "./components/cards/post-card"
export { EventCard } from "./components/cards/event-card"
export { AssociationCard, CompanyCard, OfficialPageCard } from "./components/cards/page-cards"
export { ClassifiedCard, GroupCard, JobCard, MentorCard, TalentCard } from "./components/cards/community-cards"
export {
  COMMUNITY_TABS,
  CommunityTabSwitcher,
  ContactButton,
  FilterBar,
  SponsoredSlot,
  type CommunityTab,
} from "./components/community-controls"
export { PostComposerSheet, POST_BODY_MAX } from "./components/composer"
export { isShareable, PostShareProvider, SharedPostEmbed, usePostShare } from "./components/post-share"
export { RoutingProvider, useRouting, type FeatureRoutes, type LinkComponent } from "./routing"
