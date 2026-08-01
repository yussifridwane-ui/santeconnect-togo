import { db } from "@/db";
import {
  users,
  facilities,
  patients,
  appointments,
  messages,
  departments,
  medicalRecords,
  subscriptions,
  payments,
  shops,
  sikaProducts,
  sikaCustomers,
  sikaSales,
  sikaSaleItems,
  sikaSubscriptions,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding database...");

  // Check if already seeded
  const existingFacilities = await db.select().from(facilities);
  if (existingFacilities.length > 0) {
    console.log("✅ Database already seeded.");
    return;
  }

  // Hash passwords
  const adminHash = await hashPassword("admin123");
  const doctorHash = await hashPassword("doctor123");
  const nurseHash = await hashPassword("nurse123");
  const patientHash = await hashPassword("patient123");
  const secretaryHash = await hashPassword("secretary123");

  // Insert Facilities
  const facilityResult = await db
    .insert(facilities)
    .values([
      {
        name: "Clinique de la Paix",
        type: "clinic",
        description:
          "Clinique privée spécialisée en médecine générale et soins de santé primaires située au cœur de Lomé.",
        address: "Boulevard du 13 Janvier, Lomé",
        city: "Lomé",
        phone: "+228 22 21 45 67",
        email: "contact@cliniquepaix.tg",
        capacity: 50,
        operatingHours: "Lun-Ven: 7h-20h, Sam: 8h-14h",
      },
      {
        name: "Laboratoire Biomédical du Togo",
        type: "laboratory",
        description:
          "Laboratoire d'analyses médicales équipé de technologies modernes pour des diagnostics fiables.",
        address: "Rue des PTT, Quartier Admin, Lomé",
        city: "Lomé",
        phone: "+228 22 22 34 89",
        email: "lab@biomedical.tg",
        capacity: 30,
        operatingHours: "Lun-Ven: 6h30-18h, Sam: 7h-12h",
      },
      {
        name: "Hôpital Sylvanus Olympio",
        type: "hospital",
        description:
          "Principal hôpital public du Togo offrant des services médicaux complets et spécialisés.",
        address: "Avenue de l'Hôpital, Lomé",
        city: "Lomé",
        phone: "+228 22 21 06 50",
        email: "contact@sylvanus-olympio.tg",
        capacity: 500,
        operatingHours: "24h/24, 7j/7",
      },
      {
        name: "Centre Médical de Kara",
        type: "clinic",
        description:
          "Centre médical régional offrant des consultations générales et spécialisées.",
        address: "Avenue de la Réunification, Kara",
        city: "Kara",
        phone: "+228 26 25 12 34",
        email: "info@cmkara.tg",
        capacity: 80,
        operatingHours: "Lun-Ven: 7h-19h, Sam: 8h-13h",
      },
      {
        name: "Laboratoire Central de Sokodé",
        type: "laboratory",
        description:
          "Laboratoire d'analyses au service de la population de la région centrale.",
        address: "Rue du Commerce, Sokodé",
        city: "Sokodé",
        phone: "+228 25 26 78 90",
        email: "lab@sokode.tg",
        capacity: 20,
        operatingHours: "Lun-Ven: 7h-17h",
      },
      {
        name: "Hôpital Régional de Tsévié",
        type: "hospital",
        description:
          "Hôpital régional couvrant la préfecture de Zio avec des services d'urgence et de maternité.",
        address: "Route Nationale, Tsévié",
        city: "Tsévié",
        phone: "+228 23 24 56 78",
        email: "hopital@tsevie.tg",
        capacity: 200,
        operatingHours: "24h/24, 7j/7",
      },
    ])
    .returning();

  console.log(`✅ Created ${facilityResult.length} facilities`);

  // Insert Users
  const userResult = await db
    .insert(users)
    .values([
      {
        fullName: "Ridwane Issifou",
        email: "admin@cliniquepaix.tg",
        password: adminHash,
        phone: "+228 90 11 22 33",
        role: "admin",
        facilityId: facilityResult[0].id,
      },
      {
        fullName: "Dr. Ama Agbemadon",
        email: "ama@cliniquepaix.tg",
        password: doctorHash,
        phone: "+228 91 22 33 44",
        role: "doctor",
        facilityId: facilityResult[0].id,
      },
      {
        fullName: "Dr. Yao Dossou",
        email: "yao@cliniquepaix.tg",
        password: doctorHash,
        phone: "+228 92 33 44 55",
        role: "doctor",
        facilityId: facilityResult[0].id,
      },
      {
        fullName: "Infirmière Essohana K.",
        email: "esso@cliniquepaix.tg",
        password: nurseHash,
        phone: "+228 93 44 55 66",
        role: "nurse",
        facilityId: facilityResult[0].id,
      },
      {
        fullName: "M. Komlan Akakpo",
        email: "komlan@patient.tg",
        password: patientHash,
        phone: "+228 94 55 66 77",
        role: "patient",
      },
      {
        fullName: "Mme. Adjoa Mensah",
        email: "adjoa@patient.tg",
        password: patientHash,
        phone: "+228 95 66 77 88",
        role: "patient",
      },
      {
        fullName: "M. Edem Foli",
        email: "edem@patient.tg",
        password: patientHash,
        phone: "+228 96 77 88 99",
        role: "patient",
      },
      {
        fullName: "Mme. Kossiwa Tete",
        email: "kossiwa@patient.tg",
        password: patientHash,
        phone: "+228 97 88 99 00",
        role: "patient",
      },
      {
        fullName: "M. Ayité Gbeku",
        email: "ayite@patient.tg",
        password: patientHash,
        phone: "+228 98 99 00 11",
        role: "patient",
      },
      {
        fullName: "Dr. Fatou Saka",
        email: "fatou@biomedical.tg",
        password: doctorHash,
        phone: "+228 91 11 22 33",
        role: "doctor",
        facilityId: facilityResult[1].id,
      },
      {
        fullName: "Dr. Kodjo Abla",
        email: "kodjo@sylvanus.tg",
        password: doctorHash,
        phone: "+228 92 22 33 44",
        role: "doctor",
        facilityId: facilityResult[2].id,
      },
      {
        fullName: "Mme. Akoussivi D.",
        email: "akoussivi@cliniquepaix.tg",
        password: secretaryHash,
        phone: "+228 93 33 44 55",
        role: "secretary",
        facilityId: facilityResult[0].id,
      },
    ])
    .returning();

  console.log(`✅ Created ${userResult.length} users`);

  // Insert Patients
  const patientResult = await db
    .insert(patients)
    .values([
      {
        userId: userResult[4].id,
        facilityId: facilityResult[0].id,
        dateOfBirth: new Date("1985-03-15"),
        gender: "male",
        bloodType: "O+",
        address: "Quartier Bè, Lomé",
        emergencyContact: "Mme. Akossiwa (épouse)",
        emergencyPhone: "+228 94 11 22 33",
        insuranceNumber: "INAM-2024-001",
        medicalNotes: "Hypertension légère, allergie à la pénicilline",
      },
      {
        userId: userResult[5].id,
        facilityId: facilityResult[0].id,
        dateOfBirth: new Date("1990-07-22"),
        gender: "female",
        bloodType: "A+",
        address: "Agoè-Nyivé, Lomé",
        emergencyContact: "M. Yao (frère)",
        emergencyPhone: "+228 95 11 22 33",
        insuranceNumber: "INAM-2024-002",
        medicalNotes: "Suivi prénatal en cours",
      },
      {
        userId: userResult[6].id,
        facilityId: facilityResult[1].id,
        dateOfBirth: new Date("1978-11-08"),
        gender: "male",
        bloodType: "B+",
        address: "Tokoin, Lomé",
        emergencyContact: "Mme. Afua (épouse)",
        emergencyPhone: "+228 96 11 22 33",
        insuranceNumber: "INAM-2024-003",
        medicalNotes: "Diabète type 2, contrôle trimestriel",
      },
      {
        userId: userResult[7].id,
        facilityId: facilityResult[0].id,
        dateOfBirth: new Date("1995-01-30"),
        gender: "female",
        bloodType: "AB+",
        address: "Kégué, Lomé",
        emergencyContact: "M. Komi (père)",
        emergencyPhone: "+228 97 11 22 33",
        insuranceNumber: "INAM-2024-004",
        medicalNotes: "Aucune allergie connue",
      },
      {
        userId: userResult[8].id,
        facilityId: facilityResult[2].id,
        dateOfBirth: new Date("1960-06-12"),
        gender: "male",
        bloodType: "O-",
        address: "Ziévi, Tsévié",
        emergencyContact: "Mme. Adjovi (épouse)",
        emergencyPhone: "+228 98 11 22 33",
        insuranceNumber: "INAM-2024-005",
        medicalNotes: "Problèmes cardiaques, suivi mensuel requis",
      },
    ])
    .returning();

  console.log(`✅ Created ${patientResult.length} patients`);

  // Insert Departments
  const deptResult = await db
    .insert(departments)
    .values([
      {
        facilityId: facilityResult[0].id,
        name: "Médecine Générale",
        description: "Consultations générales et suivi médical",
        headDoctorId: userResult[1].id,
      },
      {
        facilityId: facilityResult[0].id,
        name: "Pédiatrie",
        description: "Soins médicaux pour enfants et nourrissons",
        headDoctorId: userResult[2].id,
      },
      {
        facilityId: facilityResult[2].id,
        name: "Urgences",
        description: "Service d'urgence 24h/24",
        headDoctorId: userResult[10].id,
      },
      {
        facilityId: facilityResult[2].id,
        name: "Maternité",
        description: "Service de gynécologie-obstétrique",
      },
      {
        facilityId: facilityResult[1].id,
        name: "Hématologie",
        description: "Analyses sanguines et hématologiques",
        headDoctorId: userResult[9].id,
      },
    ])
    .returning();

  console.log(`✅ Created ${deptResult.length} departments`);

  // Insert Appointments
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const appointmentResult = await db
    .insert(appointments)
    .values([
      {
        patientId: patientResult[0].id,
        facilityId: facilityResult[0].id,
        doctorId: userResult[1].id,
        title: "Consultation - Contrôle tension",
        type: "follow_up",
        status: "confirmed",
        scheduledDate: new Date(tomorrow.toDateString() + " 09:00:00"),
        endDate: new Date(tomorrow.toDateString() + " 09:30:00"),
        notes: "Contrôle mensuel de la tension artérielle",
        isAutoScheduled: true,
      },
      {
        patientId: patientResult[1].id,
        facilityId: facilityResult[0].id,
        doctorId: userResult[1].id,
        title: "Suivi prénatal - 6ème mois",
        type: "consultation",
        status: "confirmed",
        scheduledDate: new Date(tomorrow.toDateString() + " 10:00:00"),
        endDate: new Date(tomorrow.toDateString() + " 10:45:00"),
        notes: "Échographie et bilan sanguin",
      },
      {
        patientId: patientResult[2].id,
        facilityId: facilityResult[1].id,
        title: "Bilan sanguin complet",
        type: "lab_test",
        status: "pending",
        scheduledDate: new Date(dayAfter.toDateString() + " 07:00:00"),
        endDate: new Date(dayAfter.toDateString() + " 07:30:00"),
        notes: "NFS, glycémie à jeun, cholestérol total",
        isAutoScheduled: true,
      },
      {
        patientId: patientResult[3].id,
        facilityId: facilityResult[0].id,
        doctorId: userResult[2].id,
        title: "Consultation pédiatrique",
        type: "consultation",
        status: "pending",
        scheduledDate: new Date(nextWeek.toDateString() + " 14:00:00"),
        endDate: new Date(nextWeek.toDateString() + " 14:30:00"),
        notes: "Vaccination et check-up annuel",
      },
      {
        patientId: patientResult[4].id,
        facilityId: facilityResult[2].id,
        doctorId: userResult[10].id,
        title: "Suivi cardiologique",
        type: "specialist",
        status: "confirmed",
        scheduledDate: new Date(dayAfter.toDateString() + " 11:00:00"),
        endDate: new Date(dayAfter.toDateString() + " 11:45:00"),
        notes: "ECG de contrôle et ajustement traitement",
        isAutoScheduled: true,
      },
      {
        patientId: patientResult[0].id,
        facilityId: facilityResult[2].id,
        doctorId: userResult[10].id,
        title: "Consultation d'urgence - Douleurs thoraciques",
        type: "emergency",
        status: "completed",
        scheduledDate: new Date(yesterday.toDateString() + " 15:00:00"),
        endDate: new Date(yesterday.toDateString() + " 16:30:00"),
        notes: "Douleurs thoraciques, ECG réalisé, mise sous observation",
      },
    ])
    .returning();

  console.log(`✅ Created ${appointmentResult.length} appointments`);

  // Insert Messages
  const messageResult = await db
    .insert(messages)
    .values([
      {
        senderId: userResult[0].id,
        receiverId: userResult[4].id,
        facilityId: facilityResult[0].id,
        subject: "Confirmation de votre rendez-vous",
        content:
          "Bonjour M. Komlan,\n\nVotre rendez-vous pour le contrôle de tension avec Dr. Ama Agbemadon est confirmé pour demain à 09h00 à la Clinique de la Paix.\n\nCordialement,\nL'équipe de la Clinique de la Paix",
        status: "unread",
        isSystemMessage: true,
      },
      {
        senderId: userResult[1].id,
        receiverId: userResult[4].id,
        facilityId: facilityResult[0].id,
        subject: "Résultats de vos analyses",
        content:
          "Bonjour M. Komlan,\n\nVos derniers résultats d'analyses sont disponibles. Votre tension est stable. Continuez le traitement actuel.\n\nCordialement,\nDr. Ama Agbemadon",
        status: "read",
      },
      {
        senderId: userResult[4].id,
        receiverId: userResult[1].id,
        facilityId: facilityResult[0].id,
        subject: "Question sur mon traitement",
        content:
          "Bonjour Dr. Agbemadon,\n\nJe ressens des vertiges depuis 2 jours après la prise de mon nouveau médicament. Est-ce normal ? Dois-je continuer ?\n\nMerci,\nM. Komlan Akakpo",
        status: "unread",
      },
      {
        senderId: userResult[0].id,
        receiverId: userResult[5].id,
        facilityId: facilityResult[0].id,
        subject: "Rappel: Suivi prénatal demain",
        content:
          "Bonjour Mme. Adjoa,\n\nNous vous rappelons que votre suivi prénatal est prévu demain à 10h00.\n\nN'oubliez pas d'apporter:\n- Votre carnet de grossesse\n- Vos dernières analyses\n\nCordialement,\nClinique de la Paix",
        status: "unread",
        isSystemMessage: true,
      },
      {
        senderId: userResult[9].id,
        receiverId: userResult[6].id,
        facilityId: facilityResult[1].id,
        subject: "Résultats de vos analyses sanguines",
        content:
          "Bonjour M. Edem,\n\nVos résultats d'analyses sont disponibles:\n- Glycémie à jeun: 1.45 g/L (légèrement élevée)\n- Cholestérol total: 2.8 g/L (normal)\n- NFS: Normal\n\nNous vous recommandons de consulter votre médecin traitant pour ajuster votre traitement.\n\nCordialement,\nDr. Fatou Saka",
        status: "read",
      },
      {
        senderId: userResult[11].id,
        receiverId: userResult[8].id,
        facilityId: facilityResult[0].id,
        subject: "Rendez-vous automatique programmé",
        content:
          "Bonjour M. Ayité,\n\nUn rendez-vous de suivi cardiologique a été automatiquement programmé pour vous à l'Hôpital Sylvanus Olympio avec Dr. Kodjo Abla.\n\nDate: Après-demain à 11h00\n\nCordialement,\nSystème de gestion des rendez-vous",
        status: "unread",
        isSystemMessage: true,
      },
      {
        senderId: userResult[0].id,
        receiverId: userResult[1].id,
        facilityId: facilityResult[0].id,
        subject: "Planning de la semaine prochaine",
        content:
          "Bonjour Dr. Ama,\n\nVoici votre planning de la semaine prochaine:\n- Lundi: 8 consultations\n- Mardi: Formation continue (matin)\n- Mercredi: 6 consultations + 2 suivis\n- Jeudi: 10 consultations\n- Vendredi: 7 consultations\n\nCordialement,\nDr. Koffi Mensah",
        status: "read",
      },
    ])
    .returning();

  console.log(`✅ Created ${messageResult.length} messages`);

  // Insert Medical Records
  const recordResult = await db
    .insert(medicalRecords)
    .values([
      {
        patientId: patientResult[0].id,
        doctorId: userResult[1].id,
        facilityId: facilityResult[0].id,
        title: "Consultation - Hypertension",
        diagnosis: "Hypertension artérielle légère (145/95)",
        prescription:
          "Amlodipine 5mg - 1 comprimé par jour pendant 30 jours",
        notes:
          "Patient conscient de sa condition. Recommandations diététiques données.",
        recordType: "consultation",
      },
      {
        patientId: patientResult[2].id,
        doctorId: userResult[1].id,
        facilityId: facilityResult[0].id,
        title: "Bilan diabétique trimestriel",
        diagnosis: "Diabète type 2 équilibré (HbA1c: 7.2%)",
        prescription:
          "Metformine 1000mg - 2 comprimés par jour. Continuer régime alimentaire.",
        notes: "Prochain contrôle dans 3 mois.",
        recordType: "bilan",
      },
      {
        patientId: patientResult[4].id,
        doctorId: userResult[10].id,
        facilityId: facilityResult[2].id,
        title: "Consultation cardiologique",
        diagnosis: "Insuffisance cardiaque légère, arythmie",
        prescription:
          "Bisoprolol 2.5mg matin, Furosémide 40mg matin, Aspirine 100mg soir",
        notes:
          "ECG réalisé: rythme sinusal, extrasystoles ventriculaires rares. Échocardiogramme programmé.",
        recordType: "consultation_specialiste",
      },
    ])
    .returning();

  console.log(`✅ Created ${recordResult.length} medical records`);

  // Subscriptions SaaS (essai 14 j / actif / expiré pour la démo)
  const nowS = new Date();
  const dayS = 86400000;
  await db.insert(subscriptions).values([
    {
      facilityId: facilityResult[0].id,
      planId: "pro",
      billingCycle: "monthly",
      status: "active",
      currentPeriodStart: new Date(nowS.getTime() - 5 * dayS),
      currentPeriodEnd: new Date(nowS.getTime() + 25 * dayS),
    },
    {
      facilityId: facilityResult[1].id,
      planId: "pro",
      billingCycle: "monthly",
      status: "trialing",
      trialEndsAt: new Date(nowS.getTime() + 9 * dayS),
    },
    {
      facilityId: facilityResult[2].id,
      planId: "pro",
      billingCycle: "monthly",
      status: "trialing",
      trialEndsAt: new Date(nowS.getTime() - 3 * dayS), // essai expiré => bloqué (démo)
    },
    {
      facilityId: facilityResult[3].id,
      planId: "pro",
      billingCycle: "monthly",
      status: "trialing",
      trialEndsAt: new Date(nowS.getTime() + 14 * dayS),
    },
    {
      facilityId: facilityResult[4].id,
      planId: "pro",
      billingCycle: "monthly",
      status: "trialing",
      trialEndsAt: new Date(nowS.getTime() + 14 * dayS),
    },
    {
      facilityId: facilityResult[5].id,
      planId: "pro",
      billingCycle: "monthly",
      status: "trialing",
      trialEndsAt: new Date(nowS.getTime() + 14 * dayS),
    },
  ]);

  await db.insert(payments).values([
    {
      facilityId: facilityResult[0].id,
      planId: "pro",
      billingCycle: "monthly",
      amountFcfa: 30000,
      method: "flooz",
      status: "succeeded",
      description: "Abonnement Pro — mois précédent",
      createdAt: new Date(nowS.getTime() - 35 * dayS),
      paidAt: new Date(nowS.getTime() - 35 * dayS),
    },
    {
      facilityId: facilityResult[0].id,
      planId: "pro",
      billingCycle: "monthly",
      amountFcfa: 30000,
      method: "tmoney",
      status: "succeeded",
      description: "Abonnement Pro — mois en cours",
      createdAt: new Date(nowS.getTime() - 5 * dayS),
      paidAt: new Date(nowS.getTime() - 5 * dayS),
    },
  ]);

  console.log("✅ Created subscriptions & payment history");

  // ---- SikaStock : boutique de démonstration ----
  const [demoShop] = await db
    .insert(shops)
    .values({ ownerId: userResult[0].id, name: "Boutique Espoir (Démo)", phone: "+228 71 69 24 01", city: "Lomé", address: "Marché d'Assigamé" })
    .returning();
  await db.insert(sikaSubscriptions).values({ shopId: demoShop.id, plan: "pro", status: "trialing", trialEndsAt: new Date(Date.now() + 14 * 86400000) });
  const sp = await db
    .insert(sikaProducts)
    .values([
      { shopId: demoShop.id, name: "Riz parfumé 5kg", category: "Alimentation", priceFcfa: 6500, costFcfa: 5200, stock: 24, lowStock: 6 },
      { shopId: demoShop.id, name: "Huile végétale 1L", category: "Alimentation", priceFcfa: 1800, costFcfa: 1400, stock: 40, lowStock: 10 },
      { shopId: demoShop.id, name: "Savon Aziza", category: "Hygiène", priceFcfa: 500, costFcfa: 350, stock: 4, lowStock: 12 },
      { shopId: demoShop.id, name: "Lait Peak 400g", category: "Alimentation", priceFcfa: 3200, costFcfa: 2600, stock: 18, lowStock: 6 },
      { shopId: demoShop.id, name: "Recharge Moov 1000F", category: "Crédit", priceFcfa: 1000, costFcfa: 950, stock: 50, lowStock: 10 },
      { shopId: demoShop.id, name: "Cahier 100 pages", category: "Papeterie", priceFcfa: 700, costFcfa: 450, stock: 30, lowStock: 8 },
    ])
    .returning();
  const sc = await db
    .insert(sikaCustomers)
    .values([
      { shopId: demoShop.id, name: "Mme Afi K.", phone: "+228 90 12 34 56" },
      { shopId: demoShop.id, name: "Koffi A.", phone: "+228 91 23 45 67" },
    ])
    .returning();
  const sale1 = await db.insert(sikaSales).values({ shopId: demoShop.id, customerId: sc[0].id, totalFcfa: 8300, method: "mixx" }).returning();
  await db.insert(sikaSaleItems).values([
    { saleId: sale1[0].id, productId: sp[0].id, name: sp[0].name, qty: 1, unitPriceFcfa: 6500 },
    { saleId: sale1[0].id, productId: sp[1].id, name: sp[1].name, qty: 1, unitPriceFcfa: 1800 },
  ]);
  const sale2 = await db.insert(sikaSales).values({ shopId: demoShop.id, totalFcfa: 3200, method: "cash" }).returning();
  await db.insert(sikaSaleItems).values([{ saleId: sale2[0].id, productId: sp[3].id, name: sp[3].name, qty: 1, unitPriceFcfa: 3200 }]);
  console.log("✅ Created SikaStock demo shop, products & sales");

  console.log("🎉 Database seeded successfully!");
}

seed().catch((err) => {
  console.error("❌ Error seeding database:", err);
  process.exit(1);
});
