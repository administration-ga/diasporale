/**
 * Fournisseur de DÉMONSTRATION — données fictives, persistées dans ce seul
 * navigateur, règles de `@diasporale/domain`. Remplacé par le moteur ANTIA au
 * câblage (PD2/PD4) ; l'interface `DiasporaleDataSource` ne change pas.
 */
export { DemoStore, DEMO_STORAGE_KEY, demoIdnSub, isValidDestination } from "./store"
export { createDemoDataSource } from "./source"
export { DEMO_IDN_IDENTITIES, createDemoSeed, type DemoState } from "./state"
export { fakeConsularAttestation, emailHash } from "./attestation-provider"
