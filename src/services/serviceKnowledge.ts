// ============================================================================
// Dental Service Knowledge Module
// Comprehensive profiles for all supported dental services with intelligent
// message matching for speed-to-lead routing.
// ============================================================================

export type ServiceCategory =
  | 'preventive'
  | 'restorative'
  | 'cosmetic'
  | 'surgical'
  | 'emergency'
  | 'orthodontic';

export interface DentalServiceProfile {
  id: string;
  name: string;
  category: ServiceCategory;
  aliases: string[];
  keywords: string[];
  priceRange: { low: number; high: number; unit: string };
  averageRevenue: number;
  insuranceNote: string;
  typicalDuration: string;
  recallCycleDays: number;
  recallWindow: { earliest: number; latest: number };
  requiresConsult: boolean;
  urgencyLevel: 'routine' | 'moderate' | 'urgent' | 'emergency';
  decisionTimeline: string;
  leadTemperature: string;
  topQuestions: { question: string; shortAnswer: string }[];
  prepInstructions: string[];
  whatToExpect: string[];
  messaging: {
    instantResponse: string;
    followUp2hr: string;
    followUp24hr: string;
  };
  toneNotes: string;
}

// ============================================================================
// Service Profiles
// ============================================================================

const DENTAL_SERVICES: DentalServiceProfile[] = [
  // --------------------------------------------------------------------------
  // 1. Hygiene / Cleaning (Preventive)
  // --------------------------------------------------------------------------
  {
    id: 'hygiene_cleaning',
    name: 'Dental Cleaning & Hygiene',
    category: 'preventive',
    aliases: [
      'cleaning',
      'teeth cleaning',
      'hygiene',
      'prophy',
      '6 month checkup',
      'dental cleaning',
      'routine cleaning',
      'prophylaxis',
      'six month checkup',
      'hygiene appointment',
    ],
    keywords: [
      'cleaning',
      'clean',
      'hygiene',
      'prophy',
      'prophylaxis',
      'polish',
      'tartar',
      'plaque',
      'routine',
      '6 month',
      'six month',
      'checkup',
      'check up',
      'teeth cleaned',
    ],
    priceRange: { low: 100, high: 250, unit: 'per visit' },
    averageRevenue: 175,
    insuranceNote:
      'Typically covered at 80-100% by most PPO plans. Most plans allow 2 cleanings per year.',
    typicalDuration: '45-60 minutes',
    recallCycleDays: 180,
    recallWindow: { earliest: 150, latest: 210 },
    requiresConsult: false,
    urgencyLevel: 'routine',
    decisionTimeline: 'Same week to 2 weeks',
    leadTemperature: 'warm',
    topQuestions: [
      {
        question: 'What happens during a dental cleaning?',
        shortAnswer:
          'Your hygienist removes plaque & tartar, polishes your teeth, and checks your gum health. Quick and comfortable!',
      },
      {
        question: 'How long does a cleaning take?',
        shortAnswer:
          'Most cleanings take about 45-60 minutes. You\'ll be in and out in about an hour.',
      },
      {
        question: 'Does a cleaning hurt?',
        shortAnswer:
          'Most patients feel little to no discomfort. If you have sensitive teeth, let us know and we can adjust.',
      },
      {
        question: 'Does insurance cover my cleaning?',
        shortAnswer:
          'Most PPO plans cover cleanings at 80-100%. We verify your benefits before your visit so there are no surprises.',
      },
      {
        question: 'How often should I get my teeth cleaned?',
        shortAnswer:
          'Every 6 months is recommended for most patients. Some patients with gum issues may need visits every 3-4 months.',
      },
      {
        question: 'Can I eat after my cleaning?',
        shortAnswer:
          'Yes! If you get a fluoride treatment, we recommend waiting 30 minutes before eating or drinking.',
      },
      {
        question: 'Do I need X-rays at my cleaning?',
        shortAnswer:
          'We typically take X-rays once a year to catch issues early. Your insurance usually covers these.',
      },
    ],
    prepInstructions: [
      'Brush and floss before your appointment as you normally would.',
      'Bring your insurance card and a photo ID.',
      'Let us know about any medications you are taking.',
      'Arrive 10 minutes early if you have paperwork to complete.',
    ],
    whatToExpect: [
      'Your hygienist will examine your gums and measure pocket depths.',
      'Plaque and tartar are removed with specialized instruments.',
      'Your teeth will be polished and flossed.',
      'The dentist will do a quick exam and review any findings with you.',
    ],
    messaging: {
      instantResponse:
        'Hi {{firstName}}! Thanks for reaching out about a dental cleaning. We\'d love to get you scheduled. We have openings this week -- would a morning or afternoon work better for you?',
      followUp2hr:
        'Hi {{firstName}}, just following up! We have a few great time slots available for your cleaning this week. Want me to grab one for you before they fill up?',
      followUp24hr:
        'Hey {{firstName}}, still want to get that cleaning on the calendar? We have availability this week and next. Reply with a day that works and I\'ll get you booked!',
    },
    toneNotes:
      'Keep it light and friendly. Cleanings are routine -- no need to be clinical. Emphasize convenience and how easy it is. Many patients just need a nudge to book.',
  },

  // --------------------------------------------------------------------------
  // 2. Comprehensive Exam (Preventive)
  // --------------------------------------------------------------------------
  {
    id: 'comprehensive_exam',
    name: 'Comprehensive Exam & X-Rays',
    category: 'preventive',
    aliases: [
      'new patient exam',
      'full exam',
      'comprehensive exam',
      'first visit',
      'initial exam',
      'dental exam',
      'new patient',
      'new patient appointment',
      'full mouth exam',
    ],
    keywords: [
      'new patient',
      'first visit',
      'first time',
      'comprehensive',
      'full exam',
      'initial',
      'exam',
      'x-ray',
      'xray',
      'x-rays',
      'haven\'t been',
      'havent been',
      'long time',
      'new dentist',
      'looking for a dentist',
      'find a dentist',
      'switch dentist',
      'appointment',
      'checkup',
    ],
    priceRange: { low: 150, high: 350, unit: 'per visit' },
    averageRevenue: 250,
    insuranceNote:
      'Usually covered at 80-100% by PPO plans. Most plans cover one comprehensive exam per year.',
    typicalDuration: '60-90 minutes',
    recallCycleDays: 365,
    recallWindow: { earliest: 330, latest: 395 },
    requiresConsult: false,
    urgencyLevel: 'routine',
    decisionTimeline: 'Same week to 1 month',
    leadTemperature: 'warm',
    topQuestions: [
      {
        question: 'What does the first visit include?',
        shortAnswer:
          'A full exam, necessary X-rays, gum health check, oral cancer screening, and a treatment plan review. We cover everything!',
      },
      {
        question: 'How long is the first appointment?',
        shortAnswer:
          'Plan for about 60-90 minutes so we can do a thorough exam and answer all your questions.',
      },
      {
        question: 'What should I bring to my first visit?',
        shortAnswer:
          'Photo ID, insurance card, and a list of medications. We\'ll send you forms to fill out ahead of time.',
      },
      {
        question: 'Do you take my insurance?',
        shortAnswer:
          'We work with most major PPO plans. Share your insurance info and we\'ll verify your coverage before you come in.',
      },
      {
        question: 'I haven\'t been to a dentist in years. Is that okay?',
        shortAnswer:
          'Absolutely! No judgment here. We see patients in all situations and we\'ll create a comfortable plan for you.',
      },
      {
        question: 'Will I get a cleaning at my first visit?',
        shortAnswer:
          'It depends on your gum health. Sometimes we do the cleaning same day, sometimes we schedule it separately.',
      },
      {
        question: 'Are you accepting new patients?',
        shortAnswer:
          'Yes! We\'re welcoming new patients and have availability this week. Let\'s find a time that works for you.',
      },
    ],
    prepInstructions: [
      'Complete new patient forms online before your visit (we\'ll send a link).',
      'Bring your insurance card, photo ID, and a list of current medications.',
      'If you have recent dental X-rays, we can request them from your previous dentist.',
      'Write down any questions or concerns you want to discuss with the doctor.',
    ],
    whatToExpect: [
      'We\'ll take a full set of X-rays to get a complete picture of your oral health.',
      'The dentist will do a thorough exam of your teeth, gums, bite, and jaw.',
      'An oral cancer screening is included as part of the exam.',
      'You\'ll get a clear treatment plan with options and costs before any work begins.',
    ],
    messaging: {
      instantResponse:
        'Hi {{firstName}}! Welcome -- we\'re excited you\'re considering us for your dental care. We\'re accepting new patients and have openings this week. Would you like to schedule your first visit?',
      followUp2hr:
        'Hi {{firstName}}, just checking in! We\'d love to get you in for your first visit. Our new patient appointments are thorough and comfortable. Any questions I can answer?',
      followUp24hr:
        'Hey {{firstName}}, still thinking about scheduling your visit? No rush at all. When you\'re ready, reply here or call us and we\'ll find a convenient time for you.',
    },
    toneNotes:
      'Welcoming and warm. This is their first impression of the practice. Emphasize no-judgment, thoroughness, and that they\'re in good hands. If they mention it\'s been a while, be extra reassuring.',
  },

  // --------------------------------------------------------------------------
  // 3. Periodontal Maintenance (Preventive)
  // --------------------------------------------------------------------------
  {
    id: 'perio_maintenance',
    name: 'Periodontal Maintenance',
    category: 'preventive',
    aliases: [
      'perio maintenance',
      'deep cleaning follow-up',
      'gum treatment',
      'periodontal cleaning',
      'perio',
      'gum disease treatment',
      'periodontal',
      'scaling',
    ],
    keywords: [
      'perio',
      'periodontal',
      'gum disease',
      'gum treatment',
      'deep cleaning',
      'scaling',
      'root planing',
      'gum',
      'gums',
      'bleeding gums',
      'gum health',
      'pocket',
      'bone loss',
      'perio maintenance',
    ],
    priceRange: { low: 175, high: 300, unit: 'per visit' },
    averageRevenue: 225,
    insuranceNote:
      'Covered by most PPO plans after an initial deep cleaning. Some plans limit to 2-4 perio maintenance visits per year.',
    typicalDuration: '45-60 minutes',
    recallCycleDays: 90,
    recallWindow: { earliest: 75, latest: 105 },
    requiresConsult: false,
    urgencyLevel: 'moderate',
    decisionTimeline: 'Within 1-2 weeks (maintenance is time-sensitive)',
    leadTemperature: 'warm-hot',
    topQuestions: [
      {
        question: 'Why do I need perio maintenance instead of a regular cleaning?',
        shortAnswer:
          'After a deep cleaning, you need specialized maintenance every 3 months to keep gum disease from coming back.',
      },
      {
        question: 'How is perio maintenance different from a regular cleaning?',
        shortAnswer:
          'We clean deeper below the gumline and monitor your pocket depths. It\'s more thorough than a standard cleaning.',
      },
      {
        question: 'Does perio maintenance hurt?',
        shortAnswer:
          'Most patients are comfortable. We can use numbing if needed. It\'s much easier than the initial deep cleaning.',
      },
      {
        question: 'How often do I need perio maintenance?',
        shortAnswer:
          'Every 3 months is standard. Skipping visits can let gum disease progress, so staying on schedule is important.',
      },
      {
        question: 'Will my insurance cover perio maintenance?',
        shortAnswer:
          'Most PPO plans cover perio maintenance. We\'ll verify your benefits and let you know your estimated cost.',
      },
      {
        question: 'Can I switch back to regular cleanings?',
        shortAnswer:
          'In some cases, yes! If your gum health improves significantly, your dentist may transition you back.',
      },
    ],
    prepInstructions: [
      'Brush and floss before your appointment.',
      'Continue any prescribed mouth rinse up to your visit.',
      'Let us know if you\'ve had any changes in medications.',
    ],
    whatToExpect: [
      'Your hygienist will measure gum pocket depths and compare to previous readings.',
      'Specialized instruments clean below the gumline in all areas.',
      'The dentist reviews your periodontal health and adjusts your care plan as needed.',
      'We\'ll schedule your next maintenance visit before you leave.',
    ],
    messaging: {
      instantResponse:
        'Hi {{firstName}}! It\'s time for your periodontal maintenance visit. Staying on your 3-month schedule is key to keeping your gums healthy. We have openings this week -- what day works for you?',
      followUp2hr:
        'Hi {{firstName}}, just a reminder that your perio maintenance is due. These visits are important for keeping your gum health on track. Can we get you scheduled?',
      followUp24hr:
        'Hey {{firstName}}, we want to make sure you stay on top of your gum health. Your perio maintenance is due -- reply with a good day/time and we\'ll get you booked!',
    },
    toneNotes:
      'Supportive and educational. Patients with perio often feel some anxiety or guilt. Be encouraging about their progress and emphasize the importance of consistency without being preachy.',
  },

  // --------------------------------------------------------------------------
  // 4. Filling (Restorative)
  // --------------------------------------------------------------------------
  {
    id: 'filling',
    name: 'Dental Filling',
    category: 'restorative',
    aliases: [
      'filling',
      'cavity',
      'cavities',
      'tooth filling',
      'composite filling',
      'tooth-colored filling',
      'dental filling',
      'cavity filling',
    ],
    keywords: [
      'filling',
      'cavity',
      'cavities',
      'composite',
      'decay',
      'decayed',
      'hole in tooth',
      'hole in my tooth',
      'tooth colored',
      'tooth-colored',
      'white filling',
      'small cavity',
    ],
    priceRange: { low: 150, high: 400, unit: 'per tooth' },
    averageRevenue: 275,
    insuranceNote:
      'Most PPO plans cover fillings at 50-80%. Composite (tooth-colored) fillings may have a downgrade clause to amalgam pricing.',
    typicalDuration: '30-60 minutes',
    recallCycleDays: 0,
    recallWindow: { earliest: 0, latest: 0 },
    requiresConsult: false,
    urgencyLevel: 'moderate',
    decisionTimeline: '1-2 weeks (before the cavity gets worse)',
    leadTemperature: 'hot',
    topQuestions: [
      {
        question: 'Does getting a filling hurt?',
        shortAnswer:
          'We numb the area first so you won\'t feel pain. Most patients say it\'s much easier than they expected!',
      },
      {
        question: 'How long does a filling take?',
        shortAnswer:
          'Usually 30-60 minutes depending on the size and location. Quick and straightforward.',
      },
      {
        question: 'What kind of filling material do you use?',
        shortAnswer:
          'We use tooth-colored composite resin. It blends right in with your natural teeth -- no silver fillings.',
      },
      {
        question: 'How much does a filling cost?',
        shortAnswer:
          'Fillings range from $150-$400 depending on size. Most insurance covers 50-80% of the cost.',
      },
      {
        question: 'Can I eat after getting a filling?',
        shortAnswer:
          'Yes, but wait until the numbness wears off (1-2 hours) so you don\'t accidentally bite your cheek.',
      },
      {
        question: 'How long does a filling last?',
        shortAnswer:
          'Composite fillings typically last 7-15 years with good care. We\'ll monitor them at your regular visits.',
      },
    ],
    prepInstructions: [
      'Eat before your appointment since your mouth will be numb afterward.',
      'Take ibuprofen 30 minutes before if you tend to be sensitive.',
      'Let us know about any medication allergies, especially to local anesthetics.',
    ],
    whatToExpect: [
      'We\'ll numb the area so you\'re completely comfortable during the procedure.',
      'The decay is removed and the tooth is cleaned and prepared.',
      'Tooth-colored composite material is placed, shaped, and hardened with a special light.',
      'Your bite is checked and adjusted so everything feels natural.',
    ],
    messaging: {
      instantResponse:
        'Hi {{firstName}}! Thanks for reaching out about your filling. The sooner we take care of it, the simpler the treatment. We have openings this week -- want to get it done?',
      followUp2hr:
        'Hi {{firstName}}, just following up! Getting your filling done sooner rather than later keeps it simple and prevents the cavity from growing. When works best for you?',
      followUp24hr:
        'Hey {{firstName}}, wanted to check in about scheduling your filling. Cavities don\'t fix themselves, but the good news is fillings are quick and easy. Ready to book?',
    },
    toneNotes:
      'Reassuring and matter-of-fact. Many patients are anxious about fillings. Normalize the procedure, emphasize how quick and painless it is. Create gentle urgency -- cavities get worse over time.',
  },

  // --------------------------------------------------------------------------
  // 5. Crown (Restorative)
  // --------------------------------------------------------------------------
  {
    id: 'crown',
    name: 'Dental Crown',
    category: 'restorative',
    aliases: [
      'crown',
      'dental crown',
      'cap',
      'tooth cap',
      'onlay',
      'inlay',
      'porcelain crown',
      'ceramic crown',
      'crown replacement',
    ],
    keywords: [
      'crown',
      'cap',
      'porcelain',
      'ceramic',
      'onlay',
      'inlay',
      'cracked tooth',
      'broken tooth needs crown',
      'large filling',
      'tooth cap',
      'same day crown',
      'cerec',
    ],
    priceRange: { low: 800, high: 1500, unit: 'per crown' },
    averageRevenue: 1200,
    insuranceNote:
      'Most PPO plans cover crowns at 50% after deductible. There may be a waiting period for new plans. Pre-authorization is often recommended.',
    typicalDuration: '2 visits, 60-90 minutes each (or single visit with same-day technology)',
    recallCycleDays: 0,
    recallWindow: { earliest: 0, latest: 0 },
    requiresConsult: true,
    urgencyLevel: 'moderate',
    decisionTimeline: '1-4 weeks',
    leadTemperature: 'hot',
    topQuestions: [
      {
        question: 'How many visits does a crown take?',
        shortAnswer:
          'Traditionally 2 visits about 2 weeks apart. Some offices offer same-day crowns with digital technology.',
      },
      {
        question: 'Does getting a crown hurt?',
        shortAnswer:
          'The area is fully numbed. Most patients feel pressure but no pain. Mild soreness after is normal and manageable.',
      },
      {
        question: 'How much does a crown cost?',
        shortAnswer:
          'Crowns range $800-$1500 depending on material. Most insurance covers about 50% after deductible.',
      },
      {
        question: 'How long does a crown last?',
        shortAnswer:
          'A well-made crown lasts 10-20+ years with proper care. We use high-quality materials built to last.',
      },
      {
        question: 'What is the crown made of?',
        shortAnswer:
          'We use porcelain and ceramic materials that match your natural tooth color. Strong and beautiful results.',
      },
      {
        question: 'Why do I need a crown instead of a filling?',
        shortAnswer:
          'When a tooth is too damaged for a filling to hold, a crown covers and protects the entire tooth from further damage.',
      },
      {
        question: 'What do I do between the two appointments?',
        shortAnswer:
          'You\'ll wear a temporary crown. Eat on the other side and avoid sticky foods. It protects your tooth until the permanent crown is ready.',
      },
    ],
    prepInstructions: [
      'Eat before your appointment as the area will be numb for 2-3 hours after.',
      'Take ibuprofen 30 minutes before if recommended by your dentist.',
      'Plan for 60-90 minutes for each visit.',
      'If you have dental anxiety, let us know so we can discuss comfort options.',
    ],
    whatToExpect: [
      'Visit 1: The tooth is prepared, impressions are taken, and a temporary crown is placed.',
      'Your permanent crown is custom-made in a dental lab (about 2 weeks).',
      'Visit 2: The temporary is removed and your permanent crown is fitted, adjusted, and cemented.',
      'We check your bite and make sure everything looks and feels perfect.',
    ],
    messaging: {
      instantResponse:
        'Hi {{firstName}}! Thanks for reaching out about a dental crown. We\'d like to evaluate the tooth and discuss your best options. Can we schedule a quick consultation for you this week?',
      followUp2hr:
        'Hi {{firstName}}, following up on your crown inquiry. We want to make sure your tooth is protected. We have consultation openings this week -- which day works for you?',
      followUp24hr:
        'Hey {{firstName}}, just checking in about your crown. The sooner we evaluate the tooth, the more options we have to save it. Would you like to schedule a visit?',
    },
    toneNotes:
      'Professional and confident. Crowns are a bigger investment, so patients need to trust the quality. Be informative about the process and reassuring about the outcome. Acknowledge the cost concern proactively.',
  },

  // --------------------------------------------------------------------------
  // 6. Root Canal (Restorative)
  // --------------------------------------------------------------------------
  {
    id: 'root_canal',
    name: 'Root Canal Therapy',
    category: 'restorative',
    aliases: [
      'root canal',
      'endodontic',
      'root canal therapy',
      'root canal treatment',
      'endo',
      'nerve treatment',
    ],
    keywords: [
      'root canal',
      'endodontic',
      'nerve',
      'infected tooth',
      'infection',
      'tooth infection',
      'abscess',
      'deep cavity',
      'severe decay',
      'tooth nerve',
      'pulp',
      'inflamed',
    ],
    priceRange: { low: 700, high: 1200, unit: 'per tooth' },
    averageRevenue: 950,
    insuranceNote:
      'Most PPO plans cover root canals at 50-80%. A crown is usually needed after and is billed separately.',
    typicalDuration: '60-90 minutes',
    recallCycleDays: 0,
    recallWindow: { earliest: 0, latest: 0 },
    requiresConsult: true,
    urgencyLevel: 'urgent',
    decisionTimeline: 'Within 1 week (infection risk)',
    leadTemperature: 'hot',
    topQuestions: [
      {
        question: 'Does a root canal hurt?',
        shortAnswer:
          'Modern root canals are no worse than getting a filling. The area is fully numb. Most patients say the relief from pain was worth it!',
      },
      {
        question: 'How long does a root canal take?',
        shortAnswer:
          'Usually 60-90 minutes in a single visit. You\'ll be comfortable the entire time.',
      },
      {
        question: 'What does a root canal cost?',
        shortAnswer:
          'Root canals range from $700-$1200 depending on the tooth. Insurance typically covers 50-80%.',
      },
      {
        question: 'Do I need a crown after a root canal?',
        shortAnswer:
          'Usually yes. A crown protects the treated tooth and prevents it from breaking. We\'ll discuss the full plan.',
      },
      {
        question: 'What happens if I don\'t get the root canal?',
        shortAnswer:
          'The infection can spread, cause more pain, and you may lose the tooth. It\'s best to treat it sooner rather than later.',
      },
      {
        question: 'How long is recovery?',
        shortAnswer:
          'Most patients feel fine the next day. Some mild tenderness for 2-3 days is normal and managed with over-the-counter pain relievers.',
      },
    ],
    prepInstructions: [
      'Eat a good meal before your appointment since your mouth will be numb for several hours.',
      'Take any prescribed antibiotics as directed before your visit.',
      'Avoid alcohol for 24 hours before and after the procedure.',
      'Arrange a ride if sedation is being used.',
    ],
    whatToExpect: [
      'The area is thoroughly numbed -- you\'ll be completely comfortable.',
      'The infected or inflamed pulp is removed from inside the tooth.',
      'The canals are cleaned, shaped, and sealed with a biocompatible material.',
      'A temporary filling is placed. You\'ll return for a crown to protect the tooth.',
    ],
    messaging: {
      instantResponse:
        'Hi {{firstName}}! We understand you may need a root canal -- we know that can sound stressful, but we\'ll take great care of you. Can we get you in for an evaluation this week?',
      followUp2hr:
        'Hi {{firstName}}, checking in on your root canal inquiry. If you\'re in any discomfort, we don\'t want you to wait. We can see you as soon as tomorrow -- want us to hold a spot?',
      followUp24hr:
        'Hey {{firstName}}, we want to make sure your tooth is taken care of. Root canal issues can get worse with time. Reply here and we\'ll get you scheduled right away.',
    },
    toneNotes:
      'Empathetic and calming. Root canals have a scary reputation, so your job is to destigmatize. Acknowledge their concern, then pivot to modern comfort and how much better they\'ll feel after. Add gentle urgency because infections worsen.',
  },

  // --------------------------------------------------------------------------
  // 7. Extraction (Surgical)
  // --------------------------------------------------------------------------
  {
    id: 'extraction',
    name: 'Tooth Extraction',
    category: 'surgical',
    aliases: [
      'extraction',
      'tooth extraction',
      'tooth removal',
      'pull a tooth',
      'wisdom teeth',
      'wisdom tooth removal',
      'pull tooth',
      'remove tooth',
      'wisdom tooth',
    ],
    keywords: [
      'extraction',
      'extract',
      'pull',
      'remove',
      'removal',
      'wisdom',
      'wisdom teeth',
      'wisdom tooth',
      'impacted',
      'third molar',
      'tooth removal',
      'pull a tooth',
      'take out',
    ],
    priceRange: { low: 150, high: 500, unit: 'per tooth' },
    averageRevenue: 350,
    insuranceNote:
      'Simple extractions are usually covered at 50-80%. Surgical extractions and wisdom teeth may require pre-authorization.',
    typicalDuration: '30-60 minutes',
    recallCycleDays: 0,
    recallWindow: { earliest: 0, latest: 0 },
    requiresConsult: true,
    urgencyLevel: 'moderate',
    decisionTimeline: '1-2 weeks (unless urgent)',
    leadTemperature: 'hot',
    topQuestions: [
      {
        question: 'Does getting a tooth pulled hurt?',
        shortAnswer:
          'We numb the area completely. You\'ll feel pressure but not pain. Sedation options are available for anxious patients.',
      },
      {
        question: 'How long does recovery take?',
        shortAnswer:
          'Most patients feel better in 3-5 days. Wisdom teeth may take 5-7 days. We\'ll give you clear recovery instructions.',
      },
      {
        question: 'How much does an extraction cost?',
        shortAnswer:
          'Simple extractions are $150-$300. Surgical (like wisdom teeth) are $250-$500 per tooth. Insurance often covers 50-80%.',
      },
      {
        question: 'Will I need stitches?',
        shortAnswer:
          'Surgical extractions usually need a few stitches. They dissolve on their own in about a week.',
      },
      {
        question: 'What can I eat after an extraction?',
        shortAnswer:
          'Soft foods for 2-3 days: yogurt, soup, mashed potatoes, smoothies. Avoid straws and hot foods for 24 hours.',
      },
      {
        question: 'Do I need to replace the extracted tooth?',
        shortAnswer:
          'For non-wisdom teeth, yes -- we\'ll discuss options like implants or bridges to prevent shifting.',
      },
    ],
    prepInstructions: [
      'Eat a light meal before your appointment since you won\'t be able to eat for a few hours after.',
      'Arrange a ride home if sedation will be used.',
      'Wear comfortable, loose-fitting clothing.',
      'Avoid aspirin or blood thinners for 48 hours before (check with your doctor first).',
    ],
    whatToExpect: [
      'The area is numbed and you\'ll be comfortable throughout the procedure.',
      'The tooth is carefully loosened and removed. You\'ll feel pressure but not pain.',
      'Gauze is placed and you\'ll receive detailed aftercare instructions.',
      'We\'ll prescribe pain medication if needed and schedule a follow-up check.',
    ],
    messaging: {
      instantResponse:
        'Hi {{firstName}}! We got your message about a tooth extraction. We\'ll make sure you\'re comfortable throughout the process. Can we schedule a quick evaluation to discuss your options?',
      followUp2hr:
        'Hi {{firstName}}, following up on your extraction inquiry. We want to assess the tooth and explain your options. We have evaluation openings this week -- which day works?',
      followUp24hr:
        'Hey {{firstName}}, checking in about your extraction. We know it can feel overwhelming but our team will take great care of you. Ready to schedule your evaluation?',
    },
    toneNotes:
      'Calm and supportive. Patients facing extractions are often anxious or have been in pain. Validate their concerns, emphasize comfort measures, and be clear about what to expect. Avoid making it sound scarier than it is.',
  },

  // --------------------------------------------------------------------------
  // 8. Implant Consultation (Surgical)
  // --------------------------------------------------------------------------
  {
    id: 'implant_consult',
    name: 'Dental Implant Consultation',
    category: 'surgical',
    aliases: [
      'implant',
      'dental implant',
      'implant consultation',
      'tooth replacement',
      'implant consult',
      'dental implants',
      'implant surgery',
      'titanium implant',
    ],
    keywords: [
      'implant',
      'implants',
      'tooth replacement',
      'replace tooth',
      'replace missing',
      'missing tooth',
      'missing teeth',
      'titanium',
      'implant surgery',
      'bone graft',
      'implant consult',
      'permanent tooth',
      'false tooth',
    ],
    priceRange: { low: 3000, high: 5000, unit: 'per implant (full treatment)' },
    averageRevenue: 4000,
    insuranceNote:
      'Some PPO plans cover implants partially (usually 50% up to annual max). Many patients use financing. Coverage varies significantly by plan.',
    typicalDuration: 'Consultation: 30-60 minutes. Full treatment: 3-6 months.',
    recallCycleDays: 0,
    recallWindow: { earliest: 0, latest: 0 },
    requiresConsult: true,
    urgencyLevel: 'routine',
    decisionTimeline: '2-8 weeks (research-heavy decision)',
    leadTemperature: 'warm',
    topQuestions: [
      {
        question: 'How much does a dental implant cost?',
        shortAnswer:
          'Full implant treatment (implant, abutment, crown) ranges $3,000-$5,000 per tooth. We offer financing options.',
      },
      {
        question: 'Does getting an implant hurt?',
        shortAnswer:
          'The surgery is done under local anesthesia and most patients report less discomfort than expected. Recovery is usually 2-3 days.',
      },
      {
        question: 'How long does the implant process take?',
        shortAnswer:
          'The full process takes 3-6 months to allow the implant to fuse with bone. You\'ll have a temporary tooth in the meantime.',
      },
      {
        question: 'Am I a good candidate for implants?',
        shortAnswer:
          'Most adults are good candidates. We\'ll evaluate your bone density and overall health at your consultation to confirm.',
      },
      {
        question: 'How long do implants last?',
        shortAnswer:
          'Dental implants can last a lifetime with proper care. They\'re the gold standard for tooth replacement.',
      },
      {
        question: 'Does insurance cover implants?',
        shortAnswer:
          'Coverage varies widely. Some plans cover a portion. We also offer flexible financing to make it affordable.',
      },
      {
        question: 'What are the alternatives to implants?',
        shortAnswer:
          'Bridges and dentures are alternatives. We\'ll discuss all options at your consultation so you can make the best choice.',
      },
    ],
    prepInstructions: [
      'Bring a list of your medications and any relevant medical history.',
      'Bring any recent dental X-rays or records from your previous dentist.',
      'Write down your questions -- we\'ll take the time to answer all of them.',
      'No special preparation needed for the consultation visit.',
    ],
    whatToExpect: [
      'We\'ll take a 3D scan to evaluate your bone structure and plan the implant placement.',
      'The doctor will explain the full process, timeline, and costs in detail.',
      'You\'ll receive a written treatment plan with all fees and financing options.',
      'There is no obligation -- the consultation is about giving you the information to decide.',
    ],
    messaging: {
      instantResponse:
        'Hi {{firstName}}! Thanks for your interest in dental implants. We\'d love to bring you in for a complimentary consultation to evaluate your options. Do you have time this week?',
      followUp2hr:
        'Hi {{firstName}}, following up on your implant inquiry. A consultation is the best first step -- we\'ll answer all your questions and give you a clear picture of the process and cost. When works for you?',
      followUp24hr:
        'Hey {{firstName}}, still interested in learning more about dental implants? Our consultations are informative and no-obligation. We have availability this week if you\'d like to come in.',
    },
    toneNotes:
      'Consultative and patient. Implant patients are often researching heavily and comparing options. Be informative, not pushy. Emphasize the consultation as a no-pressure learning opportunity. Acknowledge cost is a factor and mention financing proactively.',
  },

  // --------------------------------------------------------------------------
  // 9. Whitening (Cosmetic)
  // --------------------------------------------------------------------------
  {
    id: 'whitening',
    name: 'Teeth Whitening',
    category: 'cosmetic',
    aliases: [
      'whitening',
      'teeth whitening',
      'bleaching',
      'whiter teeth',
      'tooth whitening',
      'bright smile',
      'teeth bleaching',
      'zoom whitening',
    ],
    keywords: [
      'whitening',
      'whiten',
      'bleach',
      'bleaching',
      'whiter',
      'brighter',
      'bright smile',
      'stain',
      'stains',
      'stained',
      'yellow',
      'discolored',
      'discoloration',
      'zoom',
      'white teeth',
      'shade',
    ],
    priceRange: { low: 300, high: 600, unit: 'per treatment' },
    averageRevenue: 450,
    insuranceNote:
      'Whitening is considered cosmetic and is not covered by dental insurance. We offer competitive self-pay pricing.',
    typicalDuration: '60-90 minutes (in-office) or 1-2 weeks (take-home trays)',
    recallCycleDays: 365,
    recallWindow: { earliest: 270, latest: 450 },
    requiresConsult: false,
    urgencyLevel: 'routine',
    decisionTimeline: '1-4 weeks (often tied to an event)',
    leadTemperature: 'warm',
    topQuestions: [
      {
        question: 'How much does teeth whitening cost?',
        shortAnswer:
          'In-office whitening ranges $300-$600. Take-home custom trays are also available. Results are much better than over-the-counter.',
      },
      {
        question: 'Does whitening hurt or cause sensitivity?',
        shortAnswer:
          'Some temporary sensitivity is normal and usually resolves within 24-48 hours. We use desensitizing agents to minimize it.',
      },
      {
        question: 'How white will my teeth get?',
        shortAnswer:
          'Most patients see 3-8 shades whiter in one visit! Results depend on the type of staining and your natural tooth color.',
      },
      {
        question: 'How long do whitening results last?',
        shortAnswer:
          'Results typically last 6-12 months with good care. Avoid coffee, wine, and tobacco for the longest-lasting results.',
      },
      {
        question: 'Is professional whitening better than strips?',
        shortAnswer:
          'Yes! Professional whitening is stronger, more even, and supervised by a dentist. You\'ll see dramatically better results.',
      },
      {
        question: 'Can I whiten if I have crowns or fillings?',
        shortAnswer:
          'Whitening works on natural teeth only. We\'ll evaluate your situation and discuss options to get an even, bright result.',
      },
    ],
    prepInstructions: [
      'Get a cleaning first for the best whitening results (we can do both same day).',
      'Avoid red wine, coffee, and dark-colored foods for 24 hours before treatment.',
      'Brush and floss normally before your appointment.',
    ],
    whatToExpect: [
      'A protective barrier is applied to your gums for comfort.',
      'Professional-grade whitening gel is applied to your teeth.',
      'A special light activates the gel for maximum results.',
      'You\'ll see results immediately -- most patients are thrilled walking out!',
    ],
    messaging: {
      instantResponse:
        'Hi {{firstName}}! Interested in a brighter smile? We\'d love to help! Our professional whitening gets amazing results in just one visit. Want to schedule a whitening appointment?',
      followUp2hr:
        'Hi {{firstName}}, following up on whitening! Most patients are amazed at how much brighter their smile gets in just one visit. Do you have a special event coming up? Let\'s get you scheduled!',
      followUp24hr:
        'Hey {{firstName}}, still thinking about whitening? Our patients love their results. Reply here and we can get you booked -- we have availability this week!',
    },
    toneNotes:
      'Enthusiastic and positive. Whitening is a fun, elective procedure. Patients are excited about improving their appearance. Match their energy! Ask about events (weddings, photos, etc.) to create natural urgency.',
  },

  // --------------------------------------------------------------------------
  // 10. Emergency (Emergency)
  // --------------------------------------------------------------------------
  {
    id: 'emergency',
    name: 'Dental Emergency',
    category: 'emergency',
    aliases: [
      'emergency',
      'dental emergency',
      'tooth pain',
      'toothache',
      'broken tooth',
      'chipped tooth',
      'swelling',
      'dental trauma',
      'knocked out tooth',
      'lost filling',
      'lost crown',
    ],
    keywords: [
      'emergency',
      'pain',
      'hurts',
      'hurt',
      'ache',
      'aching',
      'toothache',
      'tooth ache',
      'swollen',
      'swelling',
      'broken',
      'broke',
      'chipped',
      'chip',
      'cracked',
      'crack',
      'knocked out',
      'bleeding',
      'blood',
      'abscess',
      'infected',
      'infection',
      'throbbing',
      'can\'t eat',
      'cant eat',
      'can\'t sleep',
      'cant sleep',
      'trauma',
      'fell',
      'hit',
      'accident',
      'crown fell off',
      'crown came off',
      'filling fell out',
      'filling came out',
      'lost filling',
      'lost crown',
      'jaw pain',
      'face swollen',
      'pus',
      'fever',
    ],
    priceRange: { low: 100, high: 300, unit: 'emergency exam' },
    averageRevenue: 200,
    insuranceNote:
      'Emergency exams are typically covered by insurance. Additional treatment will be quoted separately based on what\'s needed.',
    typicalDuration: '30-60 minutes',
    recallCycleDays: 0,
    recallWindow: { earliest: 0, latest: 0 },
    requiresConsult: false,
    urgencyLevel: 'emergency',
    decisionTimeline: 'Immediate -- same day or next day',
    leadTemperature: 'red-hot',
    topQuestions: [
      {
        question: 'Can you see me today?',
        shortAnswer:
          'We keep emergency slots open every day. Call us now and we\'ll get you in as soon as possible -- often the same day.',
      },
      {
        question: 'What should I do until I can get in?',
        shortAnswer:
          'Take ibuprofen for pain, apply a cold compress to swelling, and avoid hot/cold foods. Call us and we\'ll guide you.',
      },
      {
        question: 'My tooth got knocked out. What do I do?',
        shortAnswer:
          'Keep the tooth moist (in milk or saliva). Don\'t touch the root. Get to us ASAP -- time is critical for reimplantation.',
      },
      {
        question: 'How much does an emergency visit cost?',
        shortAnswer:
          'The emergency exam is $100-$300. We\'ll diagnose the problem and give you costs for any treatment before starting.',
      },
      {
        question: 'My face is swollen. Is that serious?',
        shortAnswer:
          'Facial swelling can indicate an infection that needs immediate treatment. Please call us right away or go to the ER if severe.',
      },
      {
        question: 'A crown/filling fell out. Is that an emergency?',
        shortAnswer:
          'It\'s not a crisis but should be seen within 1-2 days to protect the tooth. Save the crown and keep the area clean.',
      },
      {
        question: 'Do I need to go to the ER?',
        shortAnswer:
          'If you have severe swelling affecting breathing/swallowing, uncontrolled bleeding, or high fever, go to the ER. Otherwise call us first.',
      },
    ],
    prepInstructions: [
      'Call us before coming in so we can prepare and give you immediate guidance.',
      'Take over-the-counter pain medication (ibuprofen is best for dental pain).',
      'If a tooth is knocked out, place it in milk and bring it with you.',
      'Apply a cold compress to any swelling (20 minutes on, 20 minutes off).',
    ],
    whatToExpect: [
      'We\'ll see you as quickly as possible -- emergency patients are prioritized.',
      'The dentist will evaluate the problem, take X-rays if needed, and diagnose the issue.',
      'We\'ll relieve your pain first, then discuss treatment options and costs.',
      'If additional treatment is needed, we\'ll schedule it promptly or refer you to a specialist.',
    ],
    messaging: {
      instantResponse:
        'Hi {{firstName}}, we\'re sorry you\'re dealing with a dental emergency. We want to help you right away. Can you call us at {{phone}} so we can get you in today? In the meantime, take ibuprofen for pain.',
      followUp2hr:
        'Hi {{firstName}}, checking in -- are you still in pain? We have emergency availability today and want to get you comfortable as soon as possible. Call or reply and we\'ll get you in.',
      followUp24hr:
        'Hey {{firstName}}, we hope you\'re feeling better. If you\'re still experiencing pain or discomfort, please don\'t wait -- we can see you today. Your dental health is our priority.',
    },
    toneNotes:
      'Urgent, empathetic, and action-oriented. People in pain need to feel heard and helped immediately. Lead with empathy, then move to action. Never be casual about pain. Use words like "right away," "today," "immediately." Provide interim pain management advice proactively.',
  },
];

// ============================================================================
// Emergency Override Keywords
// These words/phrases always route to emergency regardless of other context.
// ============================================================================

const EMERGENCY_OVERRIDE_KEYWORDS: string[] = [
  'pain',
  'hurts',
  'hurt',
  'swollen',
  'swelling',
  'broken',
  'chipped',
  'knocked out',
  'bleeding',
  'abscess',
  'throbbing',
  "can't eat",
  'cant eat',
  "can't sleep",
  'cant sleep',
  'crown fell off',
  'crown came off',
  'filling fell out',
  'filling came out',
  'lost crown',
  'lost filling',
  'tooth fell out',
  'pus',
  'fever',
  'face swollen',
  'jaw locked',
];

// ============================================================================
// Lookup Helpers
// ============================================================================

/**
 * Retrieve a dental service profile by its unique id.
 */
export function getServiceById(id: string): DentalServiceProfile | undefined {
  return DENTAL_SERVICES.find((s) => s.id === id);
}

/**
 * Return all dental service profiles.
 */
export function getAllServices(): DentalServiceProfile[] {
  return [...DENTAL_SERVICES];
}

// ============================================================================
// matchService()  --  Intelligent Message-to-Service Matching
// ============================================================================

export interface MatchResult {
  service: DentalServiceProfile | null;
  confidence: number;
  matchedKeywords: string[];
  allMatches: {
    service: DentalServiceProfile;
    score: number;
    matchedKeywords: string[];
  }[];
}

/**
 * Match a patient's free-text message to the most relevant dental service.
 *
 * Matching pipeline:
 *   1. Normalize input to lowercase.
 *   2. Check for emergency override keywords (always highest priority).
 *   3. Score every service by counting keyword + alias hits.
 *   4. Return the top match with a 0-1 confidence score plus all scored matches.
 */
export function matchService(message: string): MatchResult {
  const normalized = message.toLowerCase().trim();

  // ------------------------------------------------------------------
  // Step 1: Emergency override check
  // ------------------------------------------------------------------
  const emergencyHits: string[] = [];
  for (const keyword of EMERGENCY_OVERRIDE_KEYWORDS) {
    if (normalized.includes(keyword)) {
      emergencyHits.push(keyword);
    }
  }

  // Special-case: "crown came off" / "crown fell off" should be emergency,
  // NOT the crown service. Only trigger crown service for proactive crown
  // inquiries that do NOT include emergency language.
  const isCrownEmergency =
    normalized.includes('crown came off') ||
    normalized.includes('crown fell off') ||
    normalized.includes('crown fell out') ||
    normalized.includes('lost crown');

  if (emergencyHits.length > 0 || isCrownEmergency) {
    const emergencyService = DENTAL_SERVICES.find((s) => s.id === 'emergency')!;
    const allScored = scoreAllServices(normalized);

    // Make sure emergency is at the top
    const emergencyEntry = allScored.find((m) => m.service.id === 'emergency');
    if (emergencyEntry) {
      emergencyEntry.score = Math.max(emergencyEntry.score, 100);
      emergencyEntry.matchedKeywords = [
        ...new Set([...emergencyEntry.matchedKeywords, ...emergencyHits]),
      ];
    }

    allScored.sort((a, b) => b.score - a.score);

    return {
      service: emergencyService,
      confidence: Math.min(1, (emergencyHits.length + (isCrownEmergency ? 2 : 0)) * 0.3 + 0.4),
      matchedKeywords: isCrownEmergency
        ? [...emergencyHits, ...(isCrownEmergency ? ['crown emergency'] : [])]
        : emergencyHits,
      allMatches: allScored,
    };
  }

  // ------------------------------------------------------------------
  // Step 2: Score all services
  // ------------------------------------------------------------------
  const allScored = scoreAllServices(normalized);
  allScored.sort((a, b) => b.score - a.score);

  const topMatch = allScored[0];

  if (!topMatch || topMatch.score === 0) {
    // ------------------------------------------------------------------
    // Step 3: Fallback heuristics for generic messages
    // ------------------------------------------------------------------
    // "appointment" / "checkup" / "schedule" without specifics
    if (
      normalized.includes('appointment') ||
      normalized.includes('checkup') ||
      normalized.includes('check up') ||
      normalized.includes('schedule') ||
      normalized.includes('book')
    ) {
      // If they say "new patient" route to comprehensive exam
      if (
        normalized.includes('new patient') ||
        normalized.includes('first time') ||
        normalized.includes('first visit') ||
        normalized.includes('new dentist') ||
        normalized.includes("haven't been") ||
        normalized.includes('havent been')
      ) {
        const compExam = DENTAL_SERVICES.find((s) => s.id === 'comprehensive_exam')!;
        return {
          service: compExam,
          confidence: 0.6,
          matchedKeywords: ['new patient / generic appointment'],
          allMatches: allScored,
        };
      }

      // Default generic appointment = hygiene cleaning (existing patient)
      const hygiene = DENTAL_SERVICES.find((s) => s.id === 'hygiene_cleaning')!;
      return {
        service: hygiene,
        confidence: 0.5,
        matchedKeywords: ['generic appointment'],
        allMatches: allScored,
      };
    }

    return {
      service: null,
      confidence: 0,
      matchedKeywords: [],
      allMatches: allScored,
    };
  }

  // ------------------------------------------------------------------
  // Step 4: Compute confidence from score
  // ------------------------------------------------------------------
  // Confidence = clamped ratio of matched keywords to total possible.
  const maxPossible = topMatch.service.keywords.length + topMatch.service.aliases.length;
  const rawConfidence = maxPossible > 0 ? topMatch.score / maxPossible : 0;
  const confidence = Math.min(1, rawConfidence * 2.5); // Scale up so a few hits give solid confidence

  return {
    service: topMatch.service,
    confidence: Math.round(confidence * 100) / 100,
    matchedKeywords: topMatch.matchedKeywords,
    allMatches: allScored,
  };
}

// ============================================================================
// Internal Scoring
// ============================================================================

function scoreAllServices(
  normalized: string
): { service: DentalServiceProfile; score: number; matchedKeywords: string[] }[] {
  return DENTAL_SERVICES.map((service) => {
    let score = 0;
    const matchedKeywords: string[] = [];

    // Score aliases (higher weight -- exact phrase matches)
    for (const alias of service.aliases) {
      if (normalized.includes(alias.toLowerCase())) {
        score += 3;
        matchedKeywords.push(alias);
      }
    }

    // Score keywords (standard weight)
    for (const keyword of service.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        score += 1;
        matchedKeywords.push(keyword);
      }
    }

    // Bonus: exact id match (e.g., user literally typed the service id)
    if (normalized.includes(service.id)) {
      score += 5;
      matchedKeywords.push(service.id);
    }

    return { service, score, matchedKeywords: [...new Set(matchedKeywords)] };
  });
}
