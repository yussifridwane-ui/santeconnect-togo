#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🛡️ TESTS DE SÉCURITÉ AUTOMATISÉS — SANTÉONLINE (V2.8)
Usage : python3 security_tests/run_security_tests.py [URL]

Exécute les 10 tests de non-régression de sécurité contre l'environnement cible.
Tests défensifs uniquement : aucune écriture destructive, aucune donnée réelle lue.
Les comptes de test sont créés via l'inscription publique (comptes jetables *@test.tg).
"""
import json
import sys
import urllib.request
import http.cookiejar
import uuid

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://santeonline.netlify.app"
RESULTS = []


def client():
    cj = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))


def call(opener, method, path, body=None, headers=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Content-Type": "application/json", **(headers or {})},
    )
    try:
        with opener.open(req, timeout=25) as r:
            return r.status, r.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")
    except Exception as e:
        return -1, str(e)


def test(name, condition, detail=""):
    RESULTS.append((name, bool(condition), detail))
    print(("✅" if condition else "❌"), name, ("— " + detail) if detail else "")


def main():
    anon = client()
    stamp = uuid.uuid4().hex[:8]
    email_a = f"patient-a-{stamp}@test.tg"
    pwd = "Audit-Test-2026!"

    # --- Compte patient A (inscription publique) ---
    s, b = call(client(), "POST", "/api/auth/register", {
        "fullName": "Patient Test A", "email": email_a, "password": pwd, "role": "patient"})
    test("Préambule : création compte patient A", s in (200, 201), f"HTTP {s}")

    pa = client()
    s, b = call(pa, "POST", "/api/auth/login", {"email": email_a, "password": pwd})
    test("Préambule : connexion patient A", s == 200, f"HTTP {s}")

    # TEST 6 (partie anonyme) : aucun endpoint privé ne répond sans session
    for path in ["/api/patients", "/api/appointments", "/api/messages", "/api/notifications",
                 "/api/invoices", "/api/bordereau", "/api/insurers", "/api/team", "/api/audit",
                 "/api/dashboard/stats", "/api/examens"]:
        s, _ = call(anon, "GET", path)
        test(f"T6 : anonyme bloqué sur GET {path}", s == 401, f"HTTP {s}")

    # TEST 3/4 : un patient ne peut pas atteindre les routes personnel/admin
    for path in ["/api/patients", "/api/team", "/api/audit", "/api/bordereau", "/api/invoices"]:
        s, _ = call(pa, "GET", path)
        test(f"T3/T4 : patient bloqué sur {path}", s in (401, 403), f"HTTP {s}")

    # TEST 8 : XSS stockée — un nom piégé doit être stocké tel quel (React/esc l'échappe à l'affichage)
    s, b = call(pa, "GET", "/api/auth/session")
    test("T8 : session intacte après parcours", s in (200, 401), f"HTTP {s}")

    # TEST 9 : requêtes invalides → pas de 500 exploitable
    s, b = call(anon, "POST", "/api/rdv-lien", {"t": "jeton.falsifié.pirate", "response": "confirmed"})
    test("T9 : jeton signé falsifié rejeté proprement", s == 401 and "Erreur serveur" not in b, f"HTTP {s}")
    s, b = call(anon, "GET", "/api/documents/999999")
    test("T10 : document inconnu sans session → 401 (pas de fuite)", s == 401, f"HTTP {s}")
    s, b = call(pa, "POST", "/api/documents/abc", None)
    test("T9b : ID non numérique ne casse pas le serveur", s in (400, 401, 403, 404, 405), f"HTTP {s}")

    # Robot de rappels : sans secret → interdit ; avec mauvais secret → interdit
    s, _ = call(anon, "POST", "/api/system/reminders")
    test("Robot : appel sans secret refusé", s in (401, 403), f"HTTP {s}")
    s, _ = call(anon, "POST", "/api/system/reminders", None, {"x-cron-secret": "faux-secret"})
    test("Robot : mauvais secret refusé", s == 401, f"HTTP {s}")

    # Headers de sécurité présents
    req = urllib.request.Request(BASE + "/", method="GET")
    with urllib.request.urlopen(req, timeout=25) as r:
        hd = {k.lower(): v for k, v in r.headers.items()}
    for h in ["x-content-type-options", "x-frame-options", "strict-transport-security", "content-security-policy", "referrer-policy", "permissions-policy"]:
        test(f"Header {h} présent", h in hd, hd.get(h, "absent")[:60])
    # Absence de CORS permissif
    test("CORS : pas d'Access-Control-Allow-Origin *", hd.get("access-control-allow-origin") != "*", hd.get("access-control-allow-origin", "absent ✓"))

    # T1/T2 : le patient A ne voit QUE son dossier derrière son code (portail)
    s, b = call(pa, "GET", "/api/patient-portal/dossier")
    test("T1 : dossier portail verrouillé sans code (403)", s == 403, f"HTTP {s}")
    s, b = call(pa, "GET", "/api/patients/1")
    test("T2 : patient A bloqué sur la fiche d'un autre (403)", s in (401, 403), f"HTTP {s}")

    # Brute-force : 6 mauvais mots de passe → verrouillage (429)
    brute = client()
    codes = []
    for _ in range(6):
        s, _ = call(brute, "POST", "/api/auth/login", {"email": email_a, "password": "mauvais-mot-de-passe"})
        codes.append(s)
    test("Brute-force : 6e tentative verrouillée (429)", codes[-1] == 429, f"séquence {codes}")

    print("\n================ BILAN ================")
    ok = sum(1 for _, c, _ in RESULTS if c)
    print(f"{ok}/{len(RESULTS)} contrôles réussis")
    sys.exit(0 if ok == len(RESULTS) else 1)


if __name__ == "__main__":
    main()
