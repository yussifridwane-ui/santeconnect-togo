import Link from "next/link";

const FEATURES = [
  { e: "📦", t: "Gestion de stock", d: "Ajoutez vos produits, suivez les quantités, alertes de réapprovisionnement automatiques." },
  { e: "🛒", t: "Caisse rapide (POS)", d: "Encaissez en 10 secondes : panier, total, stock décrémenté automatiquement." },
  { e: "💬", t: "Reçus WhatsApp", d: "Envoyez le reçu détaillé au client sur WhatsApp en un tap." },
  { e: "🤖", t: "Assistant IA", d: "Chiffre d'affaires, meilleures ventes, projections et conseils chaque jour." },
  { e: "📱", t: "Paiement Mixx by Yas", d: "Encaissez par Mobile Money avec instructions guidées *145#." },
  { e: "🔁", t: "Abonnement flexible", d: "Essai gratuit 14 jours, puis 10 000 F/mois. Sans engagement." },
];

const PLANS = [
  { n: "Découverte", p: "0 F", d: "30 produits · 1 utilisateur · pour tester", hl: false },
  { n: "Pro", p: "10 000 F/mois", d: "Produits illimités · reçus WhatsApp · IA · Mixx by Yas", hl: true },
  { n: "Business", p: "25 000 F/mois", d: "Tout Pro · multi-boutiques · support prioritaire", hl: false },
];

export default function SikaLanding() {
  return (
    <div className="min-h-screen bg-amber-50/40">
      <header className="bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 text-white">
        <div className="max-w-5xl mx-auto px-5 py-14 text-center">
          <span className="inline-block bg-white/20 px-4 py-1 rounded-full text-sm font-semibold mb-5">🇹🇬 Conçu pour les commerçants du Togo</span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">🛒 SikaStock</h1>
          <p className="mt-4 text-lg text-amber-50 max-w-2xl mx-auto">
            Le SaaS tout-en-un pour gérer votre boutique : stock, caisse, clients, reçus WhatsApp et conseils IA.
            Essayez gratuitement pendant 14 jours.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link href="/login" className="px-7 py-3.5 bg-white text-orange-600 rounded-xl font-bold shadow-lg hover:bg-amber-50">
              Commencer gratuitement
            </Link>
            <Link href="#tarifs" className="px-7 py-3.5 bg-orange-700/40 border border-white/40 rounded-xl font-bold hover:bg-orange-700/60">
              Voir les tarifs
            </Link>
          </div>
          <p className="mt-4 text-sm text-amber-100">Essayez gratuitement pendant 14 jours — sans carte bancaire.</p>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-5 py-12">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Tout ce qu'il faut pour vendre plus</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100">
              <div className="text-3xl">{f.e}</div>
              <h3 className="font-bold text-gray-900 mt-2">{f.t}</h3>
              <p className="text-sm text-gray-500 mt-1">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="tarifs" className="max-w-5xl mx-auto px-5 pb-16">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Tarifs simples en FCFA</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map((p, i) => (
            <div key={i} className={`rounded-2xl p-6 border-2 bg-white ${p.hl ? "border-orange-500 shadow-lg relative" : "border-amber-100"}`}>
              {p.hl && <span className="absolute -top-3 left-5 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">POPULAIRE</span>}
              <h3 className="font-bold text-gray-900">{p.n}</h3>
              <p className="text-2xl font-extrabold text-orange-600 mt-2">{p.p}</p>
              <p className="text-sm text-gray-500 mt-2">{p.d}</p>
              <Link href="/login" className={`block text-center mt-5 py-2.5 rounded-xl font-bold ${p.hl ? "bg-orange-500 text-white" : "bg-amber-100 text-orange-700"}`}>
                Choisir
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 text-center text-sm py-8 px-5">
        <p><b className="text-white">SikaStock</b> — la gestion de commerce au Togo · Paiements Mixx by Yas · par Ridwane Issifou</p>
      </footer>
    </div>
  );
}
