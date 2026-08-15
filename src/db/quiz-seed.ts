import type { ExamCategory } from "@/db/exam-seed";

/**
 * Quiz (QCM) et cas cliniques pédagogiques — module « Examens paracliniques ».
 * Contenu d'APPRENTISSAGE uniquement : un QCM ne remplace jamais un avis médical.
 * Règle absolue rappelée dans les explications : les valeurs de référence
 * varient selon le laboratoire — toujours lire celles du compte rendu.
 */
export interface QuizSeed {
  category: ExamCategory;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  examSlug?: string;
}

export interface CaseSeed {
  slug: string;
  title: string;
  category: ExamCategory;
  vignette: string;
  question: string;
  options: string[];
  correctIndex: number;
  analysis: string;
  examSlug?: string;
}

/* ============================ QUIZ / QCM ============================ */
export const QUIZ_SEED: QuizSeed[] = [
  /* ---------- Biologie ---------- */
  {
    category: "biologie",
    question: "Dans une NFS, quel paramètre permet avant tout de dépister une anémie ?",
    options: ["Les leucocytes (GB)", "L'hémoglobine (Hb)", "Les plaquettes", "Le VGM"],
    correctIndex: 1,
    explanation:
      "L'anémie se définit par une diminution de l'hémoglobine : repères OMS < 13 g/dL chez l'homme, < 12 g/dL chez la femme, < 11 g/dL chez la femme enceinte. Le VGM oriente ensuite la cause (microcytose, macrocytose).",
    examSlug: "nfs",
  },
  {
    category: "biologie",
    question: "À partir de quel seuil une glycémie à jeun fait-elle évoquer un diabète ?",
    options: ["≥ 0,70 g/L", "≥ 1,00 g/L", "≥ 1,26 g/L vérifiée à 2 reprises", "≥ 2,00 g/L en une seule mesure sans symptôme"],
    correctIndex: 2,
    explanation:
      "Le seuil diagnostique du diabète est une glycémie à jeun ≥ 1,26 g/L (7 mmol/L) confirmée à 2 reprises, ou ≥ 2 g/L à n'importe quel moment avec des symptômes. Un taux entre 1,10 et 1,25 g/L est une hyperglycémie modérée à jeun.",
    examSlug: "glycemie",
  },
  {
    category: "biologie",
    question: "L'HbA1c (hémoglobine glyquée) reflète la glycémie moyenne sur environ :",
    options: ["24 heures", "1 semaine", "2 à 3 mois", "1 an"],
    correctIndex: 2,
    explanation:
      "L'HbA1c reflète la glycation de l'hémoglobine sur la durée de vie des globules rouges (≈ 120 jours), soit l'équilibre glycémique des 2 à 3 derniers mois. Chez le diabétique traité, l'objectif est le plus souvent < 7 %.",
    examSlug: "hba1c",
  },
  {
    category: "biologie",
    question: "Une CRP très élevée accompagnée de fièvre oriente en priorité vers :",
    options: ["Une carence en fer", "Un syndrome inflammatoire, souvent infectieux", "Une insuffisance rénale", "Un diabète déséquilibré"],
    correctIndex: 1,
    explanation:
      "La CRP est un marqueur précoce d'inflammation ; elle augmente fortement dans les infections bactériennes. Une CRP modérée est plus discrète dans les infections virales. Elle ne précise ni la cause ni le siège : toujours corréler à la clinique.",
    examSlug: "crp",
  },
  {
    category: "biologie",
    question: "La créatininémie sert principalement à évaluer :",
    options: ["La fonction hépatique", "La fonction rénale (débit de filtration glomérulaire)", "L'équilibre glycémique", "L'activité cardiaque"],
    correctIndex: 1,
    explanation:
      "La créatinine est éliminée par le rein : son augmentation traduit une baisse de la filtration glomérulaire. On en déduit la clairance estimée (formules CKD-EPI ou MDRD). Attention : elle augmente aussi avec la masse musculaire.",
    examSlug: "creatinine",
  },
  {
    category: "biologie",
    question: "Concernant le potassium (kaliémie), quelle est la zone de référence usuelle et le principal danger d'une hyperkaliémie ?",
    options: ["2,5 à 3,0 mmol/L — risque hémorragique", "3,5 à 5,0 mmol/L — troubles du rythme cardiaque graves", "5,5 à 7,0 mmol/L — risque allergique", "135 à 145 mmol/L — risque de coma hypoglycémique"],
    correctIndex: 1,
    explanation:
      "La kaliémie normale se situe autour de 3,5–5,0 mmol/L. Une hyperkaliémie > 6 mmol/L expose à des troubles du rythme cardiaque pouvant être fatals : urgence thérapeutique + ECG. (135–145 mmol/L correspond au sodium.)",
    examSlug: "ionogramme",
  },
  {
    category: "biologie",
    question: "Avant de traiter une infection urinaire suspectée, l'examen de référence à réaliser est :",
    options: ["Le bilan hépatique", "L'ECBU (examen cytobactériologique des urines)", "La coproculture", "L'ionogramme"],
    correctIndex: 1,
    explanation:
      "L'ECBU identifie la bactérie responsable et teste sa sensibilité aux antibiotiques (antibiogramme). Idéalement prélevé AVANT toute antibiothérapie, sur un jet moyen, après toilette, dans un flacon stérile.",
    examSlug: "ecbu",
  },
  {
    category: "biologie",
    question: "Pour une hémoculture de bonne qualité, le prélèvement se fait idéalement :",
    options: ["Pendant ou juste avant le pic fébrile, asepsie soigneuse, si possible avant les antibiotiques", "N'importe quand, même sans fièvre et sans asepsie", "Uniquement après 3 jours d'antibiotiques", "Dans le même tube que la NFS"],
    correctIndex: 0,
    explanation:
      "La bactériémie est maximale au pic fébrile. Une asepsie rigoureuse évite les contaminations cutanées, et les antibiotiques administrés avant le prélèvement peuvent fausser le résultat (faux négatif).",
    examSlug: "hemoculture",
  },

  /* ---------- Imagerie ---------- */
  {
    category: "imagerie",
    question: "Quel examen d'imagerie n'utilise AUCUN rayonnement ionisant et est donc privilégié pendant la grossesse ?",
    options: ["La radiographie standard", "Le scanner (TDM)", "L'échographie", "La mammographie"],
    correctIndex: 2,
    explanation:
      "L'échographie fonctionne avec des ultrasons, sans rayonnement X : c'est l'examen de première intention du suivi de grossesse et de l'abdomen. Le scanner et la radiographie exposent eux à des rayons ionisants.",
    examSlug: "echographie",
  },
  {
    category: "imagerie",
    question: "Avant un scanner avec injection de produit de contraste iodé, il faut impérativement vérifier :",
    options: ["La tension artérielle et l'ECG", "La créatininémie (fonction rénale) et les antécédents d'allergie à l'iode/produits de contraste", "La glycémie et l'HbA1c", "Le bilan thyroïdien et la ferritine"],
    correctIndex: 1,
    explanation:
      "Le produit de contraste iodé est éliminé par le rein et peut déclencher des réactions d'hypersensibilité : on vérifie donc la créatinine et les antécédents d'allergie. Une hydratation est prévue si la fonction rénale est limite.",
    examSlug: "scanner",
  },
  {
    category: "imagerie",
    question: "Laquelle de ces situations est une contre-indication majeure à l'IRM ?",
    options: ["Être à jeun depuis 6 heures", "Porter un stimulateur cardiaque non compatible ou un corps étranger ferromagnétique", "Avoir fait une échographie la veille", "Être âgé de plus de 70 ans"],
    correctIndex: 1,
    explanation:
      "L'IRM fonctionne avec un puissant champ MAGNÉTIQUE (et non des rayons X) : tout objet ferromagnétique peut se déplacer ou chauffer. Un questionnaire de sécurité est obligatoire avant l'examen (pacemaker, clips, prothèses, éclats métalliques).",
    examSlug: "irm",
  },
  {
    category: "imagerie",
    question: "Devant un traumatisme récent d'un membre avec douleur et impotence, l'examen d'imagerie de première intention est :",
    options: ["L'IRM", "La scintigraphie", "La radiographie standard (2 incidences)", "L'échographie cardiaque"],
    correctIndex: 2,
    explanation:
      "La radiographie simple, rapide et peu irradiante, reste l'examen de première intention devant toute suspicion de fracture ou de luxation. Le scanner et l'IRM viennent en deuxième intention selon le contexte.",
    examSlug: "radiographie",
  },
  {
    category: "imagerie",
    question: "L'écho-doppler permet avant tout d'étudier :",
    options: ["La densité osseuse", "Les vaisseaux sanguins et les flux (thromboses, sténoses, reflux)", "La fonction pulmonaire", "L'activité électrique du cerveau"],
    correctIndex: 1,
    explanation:
      "Le doppler analyse la circulation : thrombose veineuse profonde des membres inférieurs, sténoses artérielles, reflux veineux, flux du col de l'utérus en obstétrique, etc.",
    examSlug: "doppler",
  },

  /* ---------- Cardiologie ---------- */
  {
    category: "cardiologie",
    question: "Devant une douleur thoracique constrictive, quel examen doit être réalisé en URGENCE, idéalement en moins de 10 minutes ?",
    options: ["Le scanner abdominal", "L'ECG à 12 dérivations (recherche d'infarctus)", "La spirométrie", "Le bilan lipidique"],
    correctIndex: 1,
    explanation:
      "L'ECG trace l'activité électrique du cœur et dépiste en quelques minutes un infarctus (sus-décalage du segment ST) ou un trouble du rythme. Il est indolore, rapide et réalisable au lit du malade.",
    examSlug: "ecg",
  },
  {
    category: "cardiologie",
    question: "Votre patient décrit des palpitations irrégulières, absentes lors de sa consultation. L'examen le plus adapté est :",
    options: ["L'ECG repos, répété chaque heure", "Le holter ECG (enregistrement continu de 24 à 72 h) chez lui", "La mammographie", "Le gaz du sang"],
    correctIndex: 1,
    explanation:
      "Le holter ECG enregistre en continu le rythme cardiaque pendant la vie quotidienne : c'est l'examen de choix des symptômes INTERMITTENTS (palpitations, malaises inexpliqués) qu'un ECG de repos risque de manquer.",
    examSlug: "holter-ecg",
  },
  {
    category: "cardiologie",
    question: "L'échocardiographie (échographie cardiaque, ETT) permet notamment de mesurer :",
    options: ["La fraction d'éjection du ventricule gauche (FEVG)", "La glycémie capillaire", "Le débit de filtration glomérulaire", "La saturation en oxygène"],
    correctIndex: 0,
    explanation:
      "La FEVG (valeur usuelle ≥ 50–55 %) quantifie la fonction de pompe du cœur : sa baisse évoque une insuffisance cardiaque. L'échocardiographie analyse aussi les valves, les cavités cardiaques et les pressions artérielles pulmonaires.",
    examSlug: "echocardiographie",
  },
  {
    category: "cardiologie",
    question: "L'épreuve d'effort (test sur tapis ou vélo) recherche en priorité :",
    options: ["Un asthme d'effort uniquement", "Une ischémie myocardique fonctionnelle (coronaropathie) déclenchée par l'effort", "Une fracture de fatigue", "Une infection urinaire"],
    correctIndex: 1,
    explanation:
      "En faisant travailler le cœur, l'épreuve d'effort démasque une ischémie invisible au repos (sus-décalage ST à l'effort, douleur typique, troubles du rythme, chute de tension). Elle est surveillée par ECG + tension continues.",
    examSlug: "epreuve-effort",
  },

  /* ---------- Explorations fonctionnelles ---------- */
  {
    category: "explorations",
    question: "Dans la BPCO, la spirométrie montre typiquement :",
    options: ["Un VEMS/CVF rapport < 70 % persistant après bronchodilatateur", "Une PaCO₂ toujours élevée au repos", "Une goutte épaisse positive", "Une hypothyroïdie franche"],
    correctIndex: 0,
    explanation:
      "Le rapport VEMS/CVF < 70 % post-bronchodilatateur définit l'obstruction bronchique NON réversible de la BPCO. La spirométrie mesure les volumes et débits : elle distingue syndrome obstructif (BPCO, asthme) et restrictif.",
    examSlug: "spirometrie",
  },
  {
    category: "explorations",
    question: "Le gaz du sang (gazométrie artérielle) se prélève :",
    options: ["Au pli du coude, comme une prise de sang classique", "À l'artère radiale (poignet), mesure pH, PaO₂, PaCO₂, HCO₃⁻", "Par ponction lombaire", "Par prélèvement capillaire au doigt après jeûne"],
    correctIndex: 1,
    explanation:
      "La gazométrie artérielle évalue l'oxygénation et l'équilibre acido-basique (pH, PaO₂, PaCO₂, bicarbonates). Elle est indispensable en détresse respiratoire, choc, intoxication au CO. Précaution : compression du point de ponction.",
    examSlug: "gaz-sang",
  },

  /* ---------- Endoscopie ---------- */
  {
    category: "endoscopie",
    question: "La coloscopie totale permet avant tout de :",
    options: ["Explorer les bronches", "Dépister le cancer colorectal et retirer les polypes", "Mesurer la pression artérielle sur 24 h", "Étudier la motricité du côlon"],
    correctIndex: 1,
    explanation:
      "La coloscopie visualise tout le côlon et le rectum : dépistage des polypes (précurseurs du cancer) avec possibilité de polypectomie dans le même temps. Elle se fait sous anesthésie après une préparation colique minutieuse à jeun.",
    examSlug: "coloscopie",
  },
  {
    category: "endoscopie",
    question: "La fibroscopie œso-gastro-duodénale (FOGD) explore et permet :",
    options: ["L'œsophage, l'estomac et le duodénum — avec biopsies si besoin", "Les voies urinaires basses", "La peau et les tissus mous", "Le système nerveux central"],
    correctIndex: 0,
    explanation:
      "La FOGD visualise le tube digestif haut : ulcère, œsophagite, varices, gastrite, cancer débutant. Biopsies possibles (recherche d'Helicobacter pylori). À jeun de 6 heures, anesthésie locale ou générale.",
    examSlug: "fibroscopie",
  },

  /* ---------- Anatomie et cytologie pathologiques ---------- */
  {
    category: "anapath",
    question: "Le diagnostic de CERTITUDE d'un cancer repose toujours sur :",
    options: ["Le scanner ou l'IRM seuls", "L'examen anatomopathologique (biopsie) qui analyse le tissu au microscope", "Un bilan sanguin de routine", "L'ECG et la tension"],
    correctIndex: 1,
    explanation:
      "Aucun examen d'imagerie ou de biologie ne dit « c'est un cancer » avec certitude : seule l'analyse microscopique d'un prélèvement (biopsie) confirme la nature cancéreuse et précise le type histologique, clé du traitement.",
    examSlug: "biopsie",
  },
  {
    category: "anapath",
    question: "Le frottis cervico-utérin (frottis cervical) est un examen :",
    options: ["De cytologie : il recherche des cellules anormales du col de l'utérus", "D'imagerie : il visualise le col par ultrasons", "D'endoscopie : il introduit une caméra dans l'utérus", "De cardiologie"],
    correctIndex: 0,
    explanation:
      "Le frottis prélève des cellules du col utérin pour dépister les lésions précancéreuses et le cancer du col (lié le plus souvent au HPV). C'est un examen de cytologie, réalisé en consultation sans anesthésie.",
    examSlug: "cytologie",
  },

  /* ---------- Transversal (règle d'or du module) ---------- */
  {
    category: "biologie",
    question: "Concernant les « valeurs normales » d'un examen biologique, quelle affirmation est JUSTE ?",
    options: ["Elles sont identiques partout dans le monde et pour tous les patients", "Elles varient selon le laboratoire, la méthode, l'âge, le sexe et le contexte : il faut toujours se fier aux valeurs de référence imprimées sur le compte rendu", "Elles suffisent à poser seules un diagnostic définitif", "Elles ne concernent que les enfants"],
    correctIndex: 1,
    explanation:
      "Chaque laboratoire définit ses propres intervalles selon ses techniques. Une valeur « hors norme » encourage l'investigation mais ne constitue JAMAIS à elle seule un diagnostic : c'est la clinique + l'ensemble du dossier qui guident.",
    examSlug: "nfs",
  },
];

/* ============================ CAS CLINIQUES ============================ */
export const CASE_SEED: CaseSeed[] = [
  {
    slug: "cas-fievre-paleur-togo",
    title: "Fièvre et pâleur chez un jeune à Lomé",
    category: "biologie",
    vignette:
      "M. Kossi, 24 ans, consulte pour fièvre oscillante à 39,5 °C depuis 3 jours, frissons transitoires, céphalées et grande fatigue. À l'examen : pâleur conjonctivale franche, pas de syndrome méningé. Au Togo, le paludisme est suspecté.",
    question: "Quel examen de la bibliothèque faut-il demander EN PREMIER pour évaluer la gravité de cette suspicion de paludisme ?",
    options: [
      "La NFS — recherche d'une anémie (Hb basse) et d'une thrombopénie fréquentes dans le paludisme",
      "Le bilan thyroïdien complet",
      "La coloscopie de dépistage",
      "Le gaz du sang artériel systématique",
    ],
    correctIndex: 0,
    analysis:
      "Dans le paludisme, la NFS documente rapidement l'anémie hémolytique (Hb basse) et la thrombopénie quasi constante. L'examen de RÉFÉRENCE diagnostique reste la goutte épaisse / frottis sanguin (recherche de Plasmodium) ou un TDR paludisme. La clairance créatinine guidera les médicaments." +
      " ⚠️ Règle d'or : un taux d'hémoglobine bas ne dit JAMAIS à lui seul « paludisme » — c'est le tableau complet (fièvre + contexte + goutte épaisse positive) qui pose le diagnostic.",
    examSlug: "nfs",
  },
  {
    slug: "cas-polyurie-polydipsie",
    title: "Soif intense, urines abondantes et amaigrissement",
    category: "biologie",
    vignette:
      "Mme Afi, 47 ans, commerçante, consulte pour une soif permanente, des urines très fréquentes nocturnes et jour/nuit et une perte de 5 kg en 2 mois sans régime. Glycémie à jeun retrouvée à 1,58 g/L il y a 2 jours, confirmée aujourd'hui à 1,47 g/L.",
    question: "Quel examen complémentaire confirme le diabète et évalue EN MÊME TEMPS l'équilibre glycémique des derniers mois ?",
    options: [
      "L'HbA1c — reflète le taux de glucose accumulé sur ~3 mois, seuil diagnostique ≥ 6,5 %",
      "La VS — vitesse de sédimentation",
      "L'ECBU — infection urinaire associée",
      "Le bilan lipidique seul",
    ],
    correctIndex: 0,
    analysis:
      "Deux glycémies à jeun ≥ 1,26 g/L = diabète. L'HbA1c confirme et quantifie le déséquilibre chronique (seuil ≥ 6,5 %, objectif habituel < 7 %). Par prudence on complètera : glycémie de contrôle, créatininémie (le diabète touche le rein), bilan lipidique et ECBU (les infections urinaires sont plus fréquentes chez la diabétique)." +
      " ⚠️ Un seul dosage d'HbA1c ne suffit pas non plus seul en urgence : le diagnostic du diabète repose sur la glycémie à jeun ou l'HbA1c.",
    examSlug: "hba1c",
  },
  {
    slug: "cas-brulures-mictionnelles",
    title: "Brûlures mictionnelles chez une jeune femme",
    category: "biologie",
    vignette:
      "Mme Akou, 29 ans, se plaint de brûlures vives en urinant depuis 48 h, d'une envie fréquente d'uriner et d'une urine trouble, sans fièvre. Elle n'est pas enceinte. Pas de douleur lombaire.",
    question: "Avant de lui donner un antibiotique, quel examen faut-il réaliser en priorité ?",
    options: [
      "L'ECBU — identifie la bactérie et teste l'antibiogramme, prélevé idéalement AVANT tout antibiotique",
      "La mammographie de dépistage",
      "Le holter ECG",
      "La bronchoscopie",
    ],
    correctIndex: 0,
    analysis:
      "Une cystite aiguë simple chez la femme jeune non enceinte est une infection urinaire très fréquente, souvent causée par Escherichia coli. L'ECBU confirme la bactérie (≥ 10⁵ UFC/mL) et oriente le traitement via l'antibiogramme." +
      " Bonnes pratiques : prélever le jet moyen, après toilette, dans un flacon stérile. En cas de fièvre, grossesse, homme ou récidive → suspicion de complication, on explore plus largement (échographie rénale et urinaire).",
    examSlug: "ecbu",
  },
  {
    slug: "cas-douleur-thoracique",
    title: "Douleur thoracique constrictive aux urgences",
    category: "cardiologie",
    vignette:
      "M. Mensah, 58 ans, chauffeur, hypertonique et fumeur, arrive aux urgences pour une douleur thoracique constrictive irradiant dans le bras gauche, apparue au repos il y a 2 h, associée à sueurs et nausées. TA 150/95, pouls rapide.",
    question: "Quel examen doit être fait IMMÉDIATEMENT à son arrivée, au lit du malade ?",
    options: [
      "L'épreuve d'effort — on le fera marcher sur le tapis",
      "L'ECG à 12 dérivations — recherche d'un infarctus ; résultat en quelques minutes",
      "La coloscopie",
      "La spirométrie",
    ],
    correctIndex: 1,
    analysis:
      "Toute douleur thoracique constrictive = suspicion d'INFARCTUS jusqu'à preuve du contraire. L'ECG est l'examen de première URGENCE (objectif < 10 min après l'arrivée) : il recherche le sus-décalage du segment ST qui commande la revascularisation immédiate. On y ajoutera les troponines et l'unité de soins intensifs cardiologiques." +
      " L'épreuve d'effort est CONTRE-INDIQUÉE dans cette phase aiguë. L'infarctus est une urgence vitale : chaque minute compte.",
    examSlug: "ecg",
  },
  {
    slug: "cas-nodule-sein",
    title: "Nodule du sein chez une femme de 46 ans",
    category: "anapath",
    vignette:
      "Mme Yawa, 46 ans, découvre elle-même un nodule dur, irrégulier et indolore du sein gauche, mobile à la palpation. Sa mère a eu un cancer du sein à 52 ans. La mammographie et l'échographie mammaire montrent une masse de contours irréguliers classée ACR 5 (hautement suspect).",
    question: "Quel examen permet le diagnostic de certitude et détermine le type exact de la lésion ?",
    options: [
      "Le scanner thoracique seul",
      "La biopsie mammaire — analyse microscopique du tissu prélevé sous échographie",
      "Le bilan thyroïdien",
      "L'EEG (électroencéphalogramme)",
    ],
    correctIndex: 1,
    analysis:
      "Ni la mammographie, ni l'échographie, ni le scanner ne « prouvent » un cancer : ils le SUSPECTENT. Seule la biopsie (prélèvement de tissu sous guidage échographique) analysée en anatomopathologie affirme la nature cancéreuse et précise le type histologique (carcinome canalaire, lobulaire...) et les récepteurs hormonaux qui guident le traitement." +
      " La mammographie de dépistage est recommandée à partir de 40–50 ans selon les pays ; en cas d'antécédent familial au 1er degré, le dépistage est anticipé.",
    examSlug: "biopsie",
  },
  {
    slug: "cas-tabagie-essoufflement",
    title: "Essoufflement progressif chez un grand fumeur",
    category: "explorations",
    vignette:
      "M. Koffi, 62 ans, maçon, a fumé un paquet/jour pendant 35 ans. Il est de plus en plus essoufflé à l'effort, tousse chroniquement le matin avec expectoration, et ses infections hivernales durent des semaines. Auscultation peu productive, sifflante à l'expiration.",
    question: "Quel examen le médecin demande-t-il en PREMIER pour confirmer le diagnostic de BPCO ?",
    options: [
      "La radiographie thoracique seule",
      "La spirométrie (EFR) avec test bronchodilatateur — rapport VEMS/CVF < 70 % post-broncho dilatateur",
      "Le scanner cérébral",
      "La coproculture",
    ],
    correctIndex: 1,
    analysis:
      "La BPCO (tabac = cause n° 1) se définit par une obstruction bronchique NON réversible : VEMS/CVF < 70 % persistant après inhalation de bronchodilatateur à la spirométrie — c'est cet examen qui fait le diagnostic." +
      " La radiographie thoracique (hyperclarté, thorax en tonneau) la SUGGÈRE mais ne la prouve pas. Le gaz du sang quantifie la gravité aux stades avancés (hypoxémie, hypercapnie). Arrêt du tabac = meilleure mesure thérapeutique.",
    examSlug: "spirometrie",
  },
  {
    slug: "cas-suspicion-cancer-colon",
    title: "Anémie inexpliquée chez un homme de 55 ans",
    category: "endoscopie",
    vignette:
      "M. Edem, 55 ans, consulte pour une asthénie croissante. La NFS montre une anémie microcytaire avec Hb à 8,9 g/dL. Il a perdu 4 kg sans régime, notice épisodiquement des selles noires/rouges depuis 6 mois et son père a eu un cancer du côlon à 70 ans.",
    question: "Quel examen endoscopique est LE PLUS IMPORTANT à programmer ?",
    options: [
      "La cystoscopie — voies urinaires",
      "La coloscopie totale — visualise tout le côlon, biopsie et polypectomie si besoin",
      "La fibroscopie gastrique seule",
      "La bronchoscopie",
    ],
    correctIndex: 1,
    analysis:
      "Une anémie MICROCYTAIRE chez un homme > 50 ans + perte de poids + rectorragies = suspicion de cancer colorectal jusqu'à preuve du contraire. La coloscopie totale est l'examen de RÉFÉRENCE : elle visualise directement la tumeur, permet la biopsie (indispensable) et la polypectomie préventive. Le dosage de la ferritine confirmera la carence martiale." +
      " Bonnes pratiques : préparation colique minutieuse à jeun, anesthésie, veine périphérique.",
    examSlug: "coloscopie",
  },
];
