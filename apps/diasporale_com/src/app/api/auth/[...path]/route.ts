/**
 * Proxy Better Auth → actions HTTP Convex du moteur ANTIA : diasporale.com parle à
 * l'authentification par sa propre origine. Le proxy est celui du moteur
 * (`@antia/api/auth-proxy`, commun à toutes ses applications) ; il lit
 * `CONVEX_SITE_URL` (`.env.local` du moteur en développement, environnement
 * d'exécution en production).
 */
export { DELETE, GET, PATCH, POST, PUT } from "@antia/api/auth-proxy"
