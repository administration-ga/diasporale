import { ERROR_CODES } from "@diasporale/features/data"
import { describe, expect, it } from "vitest"

import { idnReturnRefusal } from "./idn-return"

describe("retour d'un échec d'IDN à la porte (EA-02)", () => {
  it("un refus ou un abandon chez IDN se dit tel quel", () => {
    for (const code of ["access_denied", "login_required", "consent_required", "interaction_required"]) {
      expect(idnReturnRefusal(code)).toBe("idn_refused")
    }
  })

  it("IDN indisponible, compte déjà ouvert à la même adresse, puis tout le reste en échec générique", () => {
    expect(idnReturnRefusal("idnUnavailable")).toBe("idn_unavailable")
    expect(idnReturnRefusal("temporarily_unavailable")).toBe("idn_unavailable")
    expect(idnReturnRefusal("account_not_linked")).toBe("idn_account_exists")
    expect(idnReturnRefusal("oauth_code_verification_failed")).toBe("idn_failed")
    expect(idnReturnRefusal("email_doesn't_match")).toBe("idn_failed")
    expect(idnReturnRefusal("<script>alert(1)</script>")).toBe("idn_failed")
  })

  it("sans erreur lisible, rien n'est dit : absente, vide, répétée ou démesurée", () => {
    expect(idnReturnRefusal(undefined)).toBeNull()
    expect(idnReturnRefusal("")).toBeNull()
    expect(idnReturnRefusal("   ")).toBeNull()
    expect(idnReturnRefusal(["access_denied", "access_denied"])).toBeNull()
    expect(idnReturnRefusal("x".repeat(121))).toBeNull()
  })

  it("chaque refus rendu est un code fermé que l'écran sait traduire", () => {
    for (const raw of ["access_denied", "idnUnavailable", "account_not_linked", "autre"]) {
      const code = idnReturnRefusal(raw)
      expect(code !== null && ERROR_CODES.has(code)).toBe(true)
    }
  })
})
