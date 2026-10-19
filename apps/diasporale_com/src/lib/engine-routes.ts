/**
 * Les adresses de diasporale.com telles que les surfaces du MOTEUR les lisent
 * (`useRoutes()` sous `NetworkProvider`) : iCom, appels, statuts. Les paquets du
 * moteur n'écrivent aucune URL ; ils composent leurs sous-adresses depuis ces
 * bases. Toutes viennent de la table de l'application (`routes`).
 */
import type { EngineRoutes } from "@antsia/api/network"

import { routes } from "./routes"

export const engineRoutes: EngineRoutes = {
  home: () => routes.feed(),
  messages: routes.messages,
  stories: routes.stories,
  profile: routes.profile,
  page: routes.page,
  settings: routes.settings,
  conference: routes.conference,
  associationEvent: routes.associationEvent,
  agenda: routes.agenda,
}
