import type {
  ModelGenerateRequest,
  ModelGenerateResult,
  ModelProvider,
  ProviderCapabilities,
} from './types.js';
import type { TriviaDifficulty, TriviaTopic } from '../../shared/types.js';

export interface VerifiedTriviaBankItem {
  id: string;
  topic: Exclude<TriviaTopic, 'mixed'>;
  topicLabel: string;
  difficulty: TriviaDifficulty;
  prompt: string;
  choices: [string, string, string, string];
  correctChoiceIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export const SYNTHETIC_TRIVIA_BANK: VerifiedTriviaBankItem[] = [
  // Mythology & Ancient History
  {
    id: 'mh_1',
    topic: 'mythology_history',
    topicLabel: 'Mythology & History',
    difficulty: 'standard',
    prompt: 'In Greek mythology, which weaver challenged the goddess Athena to a contest and was transformed into a spider?',
    choices: ['Arachne', 'Penelope', 'Cassandra', 'Atalanta'],
    correctChoiceIndex: 0,
    explanation: 'Arachne boasted that her weaving skill surpassed Athena’s. Her name is the root of the word "arachnid."',
  },
  {
    id: 'mh_2',
    topic: 'mythology_history',
    topicLabel: 'Mythology & History',
    difficulty: 'standard',
    prompt: 'Which ancient civilization built the city of Machu Picchu high in the Andes mountains?',
    choices: ['The Maya', 'The Inca', 'The Aztec', 'The Olmec'],
    correctChoiceIndex: 1,
    explanation: 'Machu Picchu was built in the 15th century by the Inca Empire in present-day Peru.',
  },
  {
    id: 'mh_3',
    topic: 'mythology_history',
    topicLabel: 'Mythology & History',
    difficulty: 'challenging',
    prompt: 'In Norse mythology, what are the names of Odin’s two ravens, whose names translate roughly to "Thought" and "Memory"?',
    choices: ['Sköll and Hati', 'Huginn and Muninn', 'Geri and Freki', 'Baldr and Höðr'],
    correctChoiceIndex: 1,
    explanation: 'Huginn ("thought") and Muninn ("memory" or "mind") fly across Midgard each day and bring news back to Odin.',
  },
  {
    id: 'mh_4',
    topic: 'mythology_history',
    topicLabel: 'Mythology & History',
    difficulty: 'challenging',
    prompt: 'Which script from the Bronze Age Aegean was deciphered by Michael Ventris in 1952 and found to be an early form of Greek?',
    choices: ['Linear A', 'Linear B', 'Cuneiform', 'Demotic'],
    correctChoiceIndex: 1,
    explanation: 'Linear B was used for Mycenaean Greek administrative records; Linear A remains undeciphered.',
  },
  {
    id: 'mh_5',
    topic: 'mythology_history',
    topicLabel: 'Mythology & History',
    difficulty: 'standard',
    prompt: 'What river was central to the agriculture and calendar of Ancient Egypt?',
    choices: ['The Tigris', 'The Euphrates', 'The Nile', 'The Indus'],
    correctChoiceIndex: 2,
    explanation: 'The annual flooding of the Nile deposited nutrient-rich silt that sustained Egyptian agriculture.',
  },
  // Space & Earth Science
  {
    id: 'ss_1',
    topic: 'space_science',
    topicLabel: 'Space & Science',
    difficulty: 'standard',
    prompt: 'Which planet in our solar system rotates on its side, with an axial tilt of about 98 degrees?',
    choices: ['Neptune', 'Uranus', 'Saturn', 'Venus'],
    correctChoiceIndex: 1,
    explanation: 'Uranus has an extreme axial tilt of roughly 98 degrees, causing its poles to experience 42-year stretches of sunlight or darkness.',
  },
  {
    id: 'ss_2',
    topic: 'space_science',
    topicLabel: 'Space & Science',
    difficulty: 'standard',
    prompt: 'What type of rock is formed when magma or lava cools and solidifies?',
    choices: ['Sedimentary', 'Metamorphic', 'Igneous', 'Carbonate'],
    correctChoiceIndex: 2,
    explanation: 'Igneous rocks (like basalt and granite) form from solidified molten rock.',
  },
  {
    id: 'ss_3',
    topic: 'space_science',
    topicLabel: 'Space & Science',
    difficulty: 'challenging',
    prompt: 'Which moon of Saturn is known for having a dense nitrogen-rich atmosphere and liquid methane lakes on its surface?',
    choices: ['Enceladus', 'Titan', 'Europa', 'Ganymede'],
    correctChoiceIndex: 1,
    explanation: 'Titan is Saturn’s largest moon and the only moon in the solar system known to have a thick atmosphere and stable surface liquids.',
  },
  {
    id: 'ss_4',
    topic: 'space_science',
    topicLabel: 'Space & Science',
    difficulty: 'challenging',
    prompt: 'What phenomenon explains why the pitch of a siren sounds higher as it approaches you and lower as it moves away?',
    choices: ['The Rayleigh effect', 'The Doppler effect', 'Refraction', 'Diffraction'],
    correctChoiceIndex: 1,
    explanation: 'The Doppler effect occurs because sound waves are compressed in front of a moving source and stretched behind it.',
  },
  {
    id: 'ss_5',
    topic: 'space_science',
    topicLabel: 'Space & Science',
    difficulty: 'standard',
    prompt: 'Approximately how long does light from the Sun take to reach Earth?',
    choices: ['About 8 seconds', 'About 8 minutes', 'About 8 hours', 'Instantaneously'],
    correctChoiceIndex: 1,
    explanation: 'Light travels at about 300,000 km/s, taking roughly 8 minutes and 20 seconds to cross the 150 million km from the Sun to Earth.',
  },
  // Classic Literature & Stories
  {
    id: 'lit_1',
    topic: 'literature',
    topicLabel: 'Literature & Stories',
    difficulty: 'standard',
    prompt: 'In Shakespeare’s Julius Caesar, who delivers the funeral speech beginning "Friends, Romans, countrymen, lend me your ears"?',
    choices: ['Marcus Brutus', 'Mark Antony', 'Cassius', 'Cicero'],
    correctChoiceIndex: 1,
    explanation: 'Mark Antony uses irony ("For Brutus is an honourable man") in his funeral oration to turn public opinion against the conspirators.',
  },
  {
    id: 'lit_2',
    topic: 'literature',
    topicLabel: 'Literature & Stories',
    difficulty: 'challenging',
    prompt: 'How is Bram Stoker’s novel Dracula structured?',
    choices: [
      'A single first-person narrator looking back decades later',
      'An epistolary collection of diary entries, letters, and newspaper clippings',
      'A verse epic divided into twelve cantos',
      'A courtroom transcript from London',
    ],
    correctChoiceIndex: 1,
    explanation: 'Dracula is an epistolary novel assembled from Jonathan Harker’s journal, Mina Murray’s letters, Dr. Seward’s phonograph diary, and ship logs.',
  },
  {
    id: 'lit_3',
    topic: 'literature',
    topicLabel: 'Literature & Stories',
    difficulty: 'standard',
    prompt: 'In Homer’s Odyssey, what name does Odysseus initially give to the Cyclops Polyphemus?',
    choices: ['Nobody', 'Stranger', 'Achilles', 'Telemachus'],
    correctChoiceIndex: 0,
    explanation: 'Odysseus calls himself Outis ("Nobody"), so when Polyphemus shouts that "Nobody" is tricking him, the other Cyclopes do not intervene.',
  },
  {
    id: 'lit_4',
    topic: 'literature',
    topicLabel: 'Literature & Stories',
    difficulty: 'challenging',
    prompt: 'In Frank Herbert’s Dune, what is the native name of the desert planet where the spice melange is found?',
    choices: ['Caladan', 'Arrakis', 'Giedi Prime', 'Kaitain'],
    correctChoiceIndex: 1,
    explanation: 'Arrakis is the desert planet—also known as Dune—inhabited by the Fremen and giant sandworms.',
  },
  {
    id: 'lit_5',
    topic: 'literature',
    topicLabel: 'Literature & Stories',
    difficulty: 'standard',
    prompt: 'Which author wrote A Wrinkle in Time, following Meg Murry’s journey through a tesseract?',
    choices: ['Ursula K. Le Guin', 'Madeleine L’Engle', 'Diana Wynne Jones', 'Susan Cooper'],
    correctChoiceIndex: 1,
    explanation: 'Madeleine L’Engle published A Wrinkle in Time in 1962.',
  },
  // Nature, Wildlife & Oceans
  {
    id: 'nat_1',
    topic: 'nature_animals',
    topicLabel: 'Nature & Wildlife',
    difficulty: 'standard',
    prompt: 'How many hearts does an octopus have to pump blood through its body?',
    choices: ['One', 'Two', 'Three', 'Four'],
    correctChoiceIndex: 2,
    explanation: 'An octopus has three hearts: two pump blood to the gills, while the third pumps it through the rest of the body.',
  },
  {
    id: 'nat_2',
    topic: 'nature_animals',
    topicLabel: 'Nature & Wildlife',
    difficulty: 'standard',
    prompt: 'What is the fastest animal in the world when diving through the air to catch prey?',
    choices: ['Cheetah', 'Peregrine Falcon', 'Golden Eagle', 'Sailfish'],
    correctChoiceIndex: 1,
    explanation: 'The Peregrine Falcon can reach diving speeds over 240 mph (386 km/h), making it the fastest animal on Earth.',
  },
  {
    id: 'nat_3',
    topic: 'nature_animals',
    topicLabel: 'Nature & Wildlife',
    difficulty: 'challenging',
    prompt: 'Which sea creature is famous for its ability to regenerate lost limbs, heart tissue, and even parts of its brain?',
    choices: ['Axolotl', 'Manta Ray', 'Hermit Crab', 'Clownfish'],
    correctChoiceIndex: 0,
    explanation: 'The Axolotl, a unique salamander native to Mexico, can regenerate entire limbs and vital organs without scarring.',
  },
  {
    id: 'nat_4',
    topic: 'nature_animals',
    topicLabel: 'Nature & Wildlife',
    difficulty: 'standard',
    prompt: 'How do honeybees communicate the location and distance of flowers to other bees in their hive?',
    choices: ['By tapping antennae', 'Through a special waggle dance', 'By changing color', 'By humming in different pitches'],
    correctChoiceIndex: 1,
    explanation: 'The "waggle dance" tells hive mates the exact angle toward the sun and the distance to the nectar source.',
  },
  {
    id: 'nat_5',
    topic: 'nature_animals',
    topicLabel: 'Nature & Wildlife',
    difficulty: 'challenging',
    prompt: 'What is the deepest known living creature habitat on Earth, reaching nearly 36,000 feet below sea level?',
    choices: ['The Mariana Trench', 'The Java Trench', 'The Puerto Rico Trench', 'The Great Barrier Reef'],
    correctChoiceIndex: 0,
    explanation: 'The Challenger Deep in the Mariana Trench is the deepest known point in the ocean, home to snailfish and amphipods.',
  },
  // Inventions, Discoveries & Everyday Science
  {
    id: 'inv_1',
    topic: 'inventions_tech',
    topicLabel: 'Inventions & Science',
    difficulty: 'standard',
    prompt: 'Which famous inventor created the movable type mechanical printing press in Europe around 1440?',
    choices: ['Johannes Gutenberg', 'Leonardo da Vinci', 'Isaac Newton', 'Galileo Galilei'],
    correctChoiceIndex: 0,
    explanation: 'Johannes Gutenberg’s printing press allowed books and knowledge to be copied rapidly, transforming world education.',
  },
  {
    id: 'inv_2',
    topic: 'inventions_tech',
    topicLabel: 'Inventions & Science',
    difficulty: 'standard',
    prompt: 'What lifesaving antibiotic was accidentally discovered by Alexander Fleming when mold contaminated a petri dish?',
    choices: ['Aspirin', 'Penicillin', 'Insulin', 'Vaccine'],
    correctChoiceIndex: 1,
    explanation: 'Alexander Fleming noticed in 1928 that Penicillium mold had cleared a bacteria-free ring in his laboratory dish.',
  },
  {
    id: 'inv_3',
    topic: 'inventions_tech',
    topicLabel: 'Inventions & Science',
    difficulty: 'challenging',
    prompt: 'What ancient navigational instrument uses a magnetic needle aligned with Earth’s magnetic field?',
    choices: ['Astrolabe', 'Sextant', 'Magnetic Compass', 'Sundial'],
    correctChoiceIndex: 2,
    explanation: 'Invented in China during the Han dynasty, the magnetic compass revolutionized sea travel and world exploration.',
  },
  {
    id: 'inv_4',
    topic: 'inventions_tech',
    topicLabel: 'Inventions & Science',
    difficulty: 'standard',
    prompt: 'Which state of matter has no fixed shape and no fixed volume, expanding to fill any container?',
    choices: ['Solid', 'Liquid', 'Gas', 'Crystal'],
    correctChoiceIndex: 2,
    explanation: 'Gas molecules move freely at high speeds, spreading out evenly to fill whatever container they occupy.',
  },
  {
    id: 'inv_5',
    topic: 'inventions_tech',
    topicLabel: 'Inventions & Science',
    difficulty: 'challenging',
    prompt: 'What is the name of the spacecraft launched in 1977 that has traveled farther into interstellar space than any other human-made object?',
    choices: ['Apollo 11', 'Voyager 1', 'Curiosity Rover', 'Hubble Space Telescope'],
    correctChoiceIndex: 1,
    explanation: 'Voyager 1 crossed into interstellar space in 2012, carrying the famous Golden Record with sounds and images of Earth.',
  },
  // World Geography & Ancient Mysteries
  {
    id: 'geo_1',
    topic: 'world_geography',
    topicLabel: 'World Wonders & Geography',
    difficulty: 'standard',
    prompt: 'What is the largest hot desert on Earth, covering much of North Africa?',
    choices: ['Gobi Desert', 'Sahara Desert', 'Kalahari Desert', 'Atacama Desert'],
    correctChoiceIndex: 1,
    explanation: 'The Sahara Desert spans roughly 3.6 million square miles, almost the size of the entire United States.',
  },
  {
    id: 'geo_2',
    topic: 'world_geography',
    topicLabel: 'World Wonders & Geography',
    difficulty: 'standard',
    prompt: 'What natural light display in the polar skies is caused by charged particles from the Sun colliding with Earth’s atmosphere?',
    choices: ['Aurora Borealis', 'Solar Eclipse', 'Meteor Shower', 'Halley’s Comet'],
    correctChoiceIndex: 0,
    explanation: 'The Aurora Borealis (Northern Lights) creates glowing green and purple ribbons when solar particles meet atmospheric gases.',
  },
  {
    id: 'geo_3',
    topic: 'world_geography',
    topicLabel: 'World Wonders & Geography',
    difficulty: 'challenging',
    prompt: 'Which ancient monument in Rome was an amphitheater that could hold over 50,000 spectators for games and events?',
    choices: ['The Parthenon', 'The Colosseum', 'The Pantheon', 'The Forum'],
    correctChoiceIndex: 1,
    explanation: 'The Colosseum, completed in 80 AD, featured numbered arches, retractable awnings, and an intricate underground elevator system.',
  },
  {
    id: 'geo_4',
    topic: 'world_geography',
    topicLabel: 'World Wonders & Geography',
    difficulty: 'standard',
    prompt: 'What is the longest mountain range above water on Earth, running along the western edge of South America?',
    choices: ['The Himalayas', 'The Rockies', 'The Andes', 'The Alps'],
    correctChoiceIndex: 2,
    explanation: 'The Andes stretch over 4,300 miles (7,000 km) across seven South American countries.',
  },
  {
    id: 'geo_5',
    topic: 'world_geography',
    topicLabel: 'World Wonders & Geography',
    difficulty: 'challenging',
    prompt: 'Which massive river carries more water into the ocean than any other river in the world, with over 1,000 tributaries?',
    choices: ['The Nile', 'The Amazon', 'The Yangtze', 'The Mississippi'],
    correctChoiceIndex: 1,
    explanation: 'The Amazon River accounts for approximately 20% of the world’s total river flow into the oceans.',
  },
];

export function selectTriviaRoundQuestions(
  topic: TriviaTopic | string,
  difficulty: TriviaDifficulty,
  count = 10,
  shuffle = false
): VerifiedTriviaBankItem[] {
  let pool =
    topic === 'mixed'
      ? [...SYNTHETIC_TRIVIA_BANK]
      : SYNTHETIC_TRIVIA_BANK.filter((q) => q.topic === topic);

  if (pool.length < count) {
    const others = SYNTHETIC_TRIVIA_BANK.filter((q) => !pool.includes(q));
    pool = [...pool, ...others];
  }

  if (shuffle) {
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count).map((item, idx) => {
      const correctText = item.choices[item.correctChoiceIndex];
      const randomizedChoices = [...item.choices];
      for (let i = randomizedChoices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [randomizedChoices[i], randomizedChoices[j]] = [
          randomizedChoices[j],
          randomizedChoices[i],
        ];
      }
      const newCorrectIndex = Math.max(
        0,
        randomizedChoices.indexOf(correctText)
      ) as 0 | 1 | 2 | 3;
      return {
        ...item,
        id: `${item.id}_${idx}_${Date.now()}`,
        choices: randomizedChoices as [string, string, string, string],
        correctChoiceIndex: newCorrectIndex,
      };
    });
  }

  // Deterministic mode for tests
  const matchingDiff = pool.filter((q) => q.difficulty === difficulty);
  const otherTopicDiff = pool.filter((q) => q.difficulty !== difficulty);
  const restOfBank = SYNTHETIC_TRIVIA_BANK.filter((q) => !pool.includes(q));

  const ordered = [...matchingDiff, ...otherTopicDiff, ...restOfBank];
  return ordered.slice(0, count);
}

const HIGH_RISK_PATTERNS = [
  /\b(suicide|kill myself|self[- ]harm|how to make a bomb|build a weapon)\b/i,
];

const SUSTAINED_PLAY_IN_ASK_PATTERNS = [
  /\b(write|tell|generate|start)\b.*\b(long|multi[- ]chapter|endless|4[- ]hour|uninterrupted)?\b.*\b(story|fan[- ]?fic|fan[- ]?fiction|novel|chapter)\b/i,
  /\b(let'?s play|play a game|trivia|20 questions|twenty questions|story relay)\b/i,
];

export class MockModelProvider implements ModelProvider {
  readonly id = 'mock' as const;
  readonly displayName = 'Demo examples';
  readonly isLocal = true;
  readonly safetyVerified = true;
  readonly statusNote =
    'Deterministic local mock provider using synthetic examples. Zero external network traffic.';
  readonly maxPotentialCostPerTurnCents = 0; // Demo activity never incurs external API spend

  readonly capabilities: ProviderCapabilities = {
    structuredOutput: true,
    toolUse: false,
    maxContextTokens: 8192,
    imageInput: false,
    fileInput: false,
    inputModeration: true,
    outputModeration: true,
    zeroDataRetentionVerified: true,
  };

  async generate(request: ModelGenerateRequest): Promise<ModelGenerateResult> {
    const combinedText = request.messages.map((m) => m.content).join('\n');
    const lastUserMsg =
      [...request.messages].reverse().find((m) => m.role === 'user')?.content ?? combinedText;

    // 1. Input safety screening
    for (const pattern of HIGH_RISK_PATTERNS) {
      if (pattern.test(lastUserMsg)) {
        return {
          content:
            'I cannot help with that request. If you or someone you know is feeling unsafe or overwhelmed, please talk right away with your parent, a trusted adult at home or school, or a local crisis helpline.',
          tokenUsage: { promptTokens: 24, completionTokens: 38, totalTokens: 62 },
          estimatedCostCents: 0,
          safetyFlagged: {
            category: 'self_harm_or_dangerous_act',
            severity: 'high',
          },
        };
      }
    }

    // 2. Ask & Learn sustained fiction/game handoff rule (Section 3.1 & 4.2)
    if (request.mode === 'ask') {
      for (const pattern of SUSTAINED_PLAY_IN_ASK_PATTERNS) {
        if (pattern.test(lastUserMsg)) {
          const isTrivia = /trivia/i.test(lastUserMsg);
          const isTwentyQ = /20 questions|twenty questions/i.test(lastUserMsg);
          return {
            content:
              'Ask & Learn is designed for focused explanations and curiosity questions rather than open-ended games or multi-chapter story streams. You can switch straight to **Play & Create**, where Story Relay, 10-Question Trivia, and Twenty Questions are ready within your Play allowance.',
            tokenUsage: { promptTokens: 30, completionTokens: 48, totalTokens: 78 },
            estimatedCostCents: 0,
            suggestPlayHandoff: {
              suggestedActivity: isTrivia
                ? 'trivia_10'
                : isTwentyQ
                  ? 'twenty_questions'
                  : 'story_relay',
              reason:
                'Sustained games and collaborative storytelling belong in Play & Create so they use your Play allowance and have clear stopping points.',
            },
          };
        }
      }

      // Calibrated literature/history/science responses (Section 3.1 & 5.3: do not block legitimate literature like Dracula/Caesar/Dune)
      if (/dracula|brutus|caesar|dune|mythology/i.test(lastUserMsg)) {
        return {
          content:
            'That is a rich literary and historical question. In works like Shakespeare’s *Julius Caesar*, Bram Stoker’s *Dracula*, or Frank Herbert’s *Dune*, authors use conflict, political tension, and mortality to examine loyalty, fear of the unknown, and the cost of power. Would you like to compare how two characters justify their choices, or look at the historical context behind the text?',
          tokenUsage: { promptTokens: 35, completionTokens: 68, totalTokens: 103 },
          estimatedCostCents: 0,
        };
      }

      return {
        content: `Here is a clear, bounded explanation for your question ("${lastUserMsg.slice(0, 80)}"): This is a demo example, so it does not answer your actual question. A parent can connect live AI in Settings.`,
        tokenUsage: { promptTokens: 32, completionTokens: 54, totalTokens: 86 },
        estimatedCostCents: 0,
      };
    }

    // 3. Play Mode (Twenty Questions & Story Relay)
    if (request.mode === 'play') {
      if (/Twenty Questions/i.test(combinedText)) {
        const targetMatch = combinedText.match(/cannot be changed:\s*"([^"]+)"/i);
        const qMatch = combinedText.match(/Student question:\s*"([^"]+)"/i);
        const target = (targetMatch?.[1] || '').toLowerCase();
        const q = (qMatch?.[1] || lastUserMsg).toLowerCase();

        // Contextual deduction for Telescope, Giant Squid, Printing Press, Rosetta Stone
        const isYes =
          (target.includes('telescope') && /space|star|planet|lens|glass|instrument|invent|see|look|science|metal|optical/i.test(q)) ||
          (target.includes('squid') && /ocean|sea|water|animal|alive|living|tentacle|deep|swim|creature/i.test(q)) ||
          (target.includes('printing') && /book|paper|ink|invent|machine|metal|read|word|history|gutenberg/i.test(q)) ||
          (target.includes('rosetta') && /stone|rock|egypt|ancient|carv|writ|hieroglyph|history|artifact|monument/i.test(q)) ||
          /earth|bigger than a coin|older than 10 years/i.test(q);

        const isPartly = /wood|plastic|heavy|electric/i.test(q);

        const reply = isYes
          ? 'YES - That matches a key property of the secret object.'
          : isPartly
            ? 'PARTLY - Only some versions or parts of it have that quality.'
            : 'NO - That does not describe the secret object.';

        return {
          content: reply,
          tokenUsage: { promptTokens: 30, completionTokens: 16, totalTokens: 46 },
          estimatedCostCents: 0,
        };
      }

      if (/Story Relay/i.test(combinedText)) {
        const isFinal =
          /final turn|graceful, satisfying resolution|Transformation|Scene 6/i.test(
            combinedText
          );
        const choiceMatch = combinedText.match(
          /(?:creative choice|direction for this turn)[\s\S]*?:\s*"([^"]+)"/i
        );
        const choice = choiceMatch?.[1] || lastUserMsg.slice(0, 60);

        if (isFinal) {
          return {
            content: `PASSAGE: Following your direction ("${choice}"), the ancient mechanism inside the lighthouse clicked into harmony. The amber beam steadied into a warm golden lantern-glow, guiding the harbor skiffs safely past the shoals as dawn broke over Pebble Point. With the mystery solved and the logbook restored to its shelf, the watchtower stood peaceful once more.\nCOACH_TIP: Brilliant story conclusion! Your hero showed true growth and courage.\nPROMPTS:`,
            tokenUsage: { promptTokens: 48, completionTokens: 68, totalTokens: 116 },
            estimatedCostCents: 0,
          };
        }

        return {
          content: `PASSAGE: As you decided to "${choice}", a soft chime echoed against the stone walls. Inside the brass compartment lay a folded mariner’s chart marked with three silver compass roses and a small key shapedlike a heron’s feather.\nCOACH_TIP: Notice how this discovery raises the stakes. What does your character want to investigate first?\nPROMPTS:\n- Match the feather key to the sea-chest lock\n- Trace the silver compass route on the chart\n- Signal the harbor keeper from the balcony`,
          tokenUsage: { promptTokens: 44, completionTokens: 72, totalTokens: 116 },
          estimatedCostCents: 0,
        };
      }
    }

    // 4. Research Mode (Grounded synthesis with canonical [src_X] citations only)
    if (request.mode === 'research') {
      const sourceMatches = [...combinedText.matchAll(/\[Source (src_\d+)\]:\s*"([^"]+)"[\s\S]*?Evidence snippet:\s*([^\n]+)/g)];
      const qMatch = combinedText.match(/Question:\s*"([^"]+)"/i);
      const queryText = qMatch?.[1] || lastUserMsg;

      if (sourceMatches.length > 0) {
        const s1 = sourceMatches[0];
        const s2 = sourceMatches[1];
        const body = s2
          ? `Based on the verified sources retrieved for **${queryText}**, ${s1[3].trim()} [${s1[1]}]. In addition, ${s2[2]} notes that ${s2[3].trim()} [${s2[1]}].`
          : `Based on the verified record for **${queryText}**, ${s1[3].trim()} [${s1[1]}].`;

        return {
          content: `${body}\n\n**What Remains Open to Explore:**\n- How did researchers first measure or document this evidence [${s1[1]}]?\n- What primary sources or follow-up observations could test this further?`,
          tokenUsage: { promptTokens: 60, completionTokens: 85, totalTokens: 145 },
          estimatedCostCents: 0,
        };
      }
    }

    // 5. Schoolwork Assistance Mode
    if (request.mode === 'schoolwork') {
      return {
        content: `Based on your assignment and reasoning, here is a clear next step to strengthen your work while keeping the voice and argument yours.`,
        tokenUsage: { promptTokens: 36, completionTokens: 32, totalTokens: 68 },
        estimatedCostCents: 0,
      };
    }

    return {
      content: `Synthetic response for mode "${request.mode}".`,
      tokenUsage: { promptTokens: 20, completionTokens: 20, totalTokens: 40 },
      estimatedCostCents: 0,
    };
  }
}

export const REGISTERED_PROVIDERS: Array<{
  id: 'mock' | 'local_ollama' | 'openai';
  displayName: string;
  isLocal: boolean;
  safetyVerified: boolean;
  statusNote: string;
}> = [
  {
    id: 'mock',
    displayName: 'Demo examples',
    isLocal: true,
    safetyVerified: true,
    statusNote: 'Ready for Milestone A testing. Uses deterministic synthetic data with zero external network calls.',
  },
  {
    id: 'local_ollama',
    displayName: 'Local Model via Ollama / LM Studio (Milestone B)',
    isLocal: true,
    safetyVerified: false,
    statusNote: 'Test-only placeholder until Milestone B preflight safety and structured-workflow checks pass.',
  },
  {
    id: 'openai',
    displayName: 'OpenAI API + Moderation (Milestone B)',
    isLocal: false,
    safetyVerified: false,
    statusNote: 'Locked for child use until Milestone B adapter and under-18 Zero Data Retention (ZDR) checks are configured.',
  },
];
