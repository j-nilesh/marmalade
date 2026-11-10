import React, { useEffect, useRef, useState } from 'react';

/**
 * Marmalade — a small ginger cat who lives on the treehouse map.
 * Pure inline SVG + CSS animation. No external assets.
 * Moods: idle (blinks, tail sways), happy (petted: purr + heart),
 * wave (paw wave on greet), curious (looks around), sleepy (naps
 * after a quiet spell), celebrate (new treasure in the chest),
 * stretch (reaches after a nap), play (bats a yarn ball),
 * groom (licks a paw), surprised (startled: wide eyes, puffed tail).
 */
type Mood =
  | 'idle'
  | 'happy'
  | 'wave'
  | 'curious'
  | 'sleepy'
  | 'celebrate'
  | 'stretch'
  | 'play'
  | 'groom'
  | 'surprised'
  | 'loaf'
  | 'curl'
  | 'stand'
  | 'chase'
  | 'dizzy'
  | 'boop'
  | 'purr'
  | 'rollover'
  | 'swat';

const LINES: Record<Mood, string[]> = {
  idle: ['', ''],
  happy: ['Prrrr…', 'Mrrp! Again!', 'Purr purr.', 'That’s the spot.'],
  wave: ['Hi there!', 'Mew! You’re back!'],
  curious: ['Hmm? What’s that?', 'Which room today?'],
  sleepy: ['zzz…'],
  celebrate: ['Ooh, a new treasure!', 'Shiny! Into the chest!'],
  stretch: ['Streeeetch.', 'Ahh, that’s better.'],
  play: ['Boop!', 'Got it!', 'My turn!'],
  groom: ['Lick lick.', 'All tidy.'],
  surprised: ['Oh! What was that?', 'Mew!!'],
  loaf: ['Just loafing.', 'Comfy.', 'Cat loaf mode.'],
  curl: ['zzz…', 'mrrm… zzz'],
  stand: ['Patrol time!', 'Off on an adventure!', 'Stretchy walk.'],
  chase: ['Tail! TAIL!', 'Almost got it!', 'Come back, tail!'],
  dizzy: ['Whoa… dizzy.', 'The room is spinning.'],
  boop: ['Boop!', 'Head scritches!', 'Mrrp.'],
  purr: ['Prrrrrrrr…', 'Purr purr purr.', 'Rumble rumble.'],
  rollover: ['Belly rubs?!', 'Wheee!', 'Look, I’m upside down!'],
  swat: ['Hey! Gentle!', 'Too fast!', 'Pat pat… swat!'],
};

/** Lines saved up for a long stretch of petting. */
const PET_LINES = ['Purrrrr!!', 'Best. Day. Ever.', 'More pets please!'];

/** Weighted things the cat gets up to while nobody is busy. */
const REACTIONS: Mood[] = [
  'curious',
  'curious',
  'curious',
  'play',
  'play',
  'groom',
  'groom',
  'stretch',
  'surprised',
  'loaf',
  'loaf',
  'stand',
  'stand',
  'chase',
  'chase',
];

/** How long each reaction lasts before she settles back down. */
const DURATION: Partial<Record<Mood, number>> = {
  loaf: 7000,
  stand: 3600,
  chase: 2200,
  dizzy: 1800,
  rollover: 3600,
  purr: 3200,
  swat: 1300,
};

const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];

export function GingerCat({ treasures = 0 }: { treasures?: number }) {
  const [mood, setMood] = useState<Mood>('wave');
  const [line, setLine] = useState(pick(LINES.wave));
  const [pets, setPets] = useState(0);
  const moodRef = useRef<Mood>('wave');
  const timer = useRef<number | undefined>(undefined);
  const idleTimer = useRef<number | undefined>(undefined);
  const lastArm = useRef(0);
  const prevTreasures = useRef(treasures);

  function setM(next: Mood) {
    moodRef.current = next;
    setMood(next);
  }

  /** A quiet spell of this long ends in a nap. */
  function armSleep() {
    lastArm.current = Date.now();
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => show('sleepy'), 45000);
  }

  function show(next: Mood, ms = DURATION[next] ?? 2600) {
    setM(next);
    setLine(pick(LINES[next]));
    window.clearTimeout(timer.current);
    if (next === 'sleepy') {
      // Dozing off sitting up, then curling into a ball.
      timer.current = window.setTimeout(() => show('curl'), 6000);
    } else if (next === 'chase') {
      timer.current = window.setTimeout(() => show('dizzy'), ms);
    } else if (next !== 'curl') {
      timer.current = window.setTimeout(() => {
        setM('idle');
        setLine('');
      }, ms);
    }
  }

  useEffect(() => {
    show('wave', 3200);
    armSleep();
    // Now and then the cat gets up to something on her own.
    const react = window.setInterval(() => {
      if (moodRef.current !== 'idle') return;
      if (Math.random() < 0.6)
        show(REACTIONS[Math.floor(Math.random() * REACTIONS.length)]);
    }, 7000);
    const wake = () => {
      if (moodRef.current === 'sleepy' || moodRef.current === 'curl') {
        show('stretch', 2800);
        armSleep();
        return;
      }
      if (Date.now() - lastArm.current > 5000) armSleep();
    };
    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('keydown', wake);
    return () => {
      window.clearInterval(react);
      window.clearTimeout(timer.current);
      window.clearTimeout(idleTimer.current);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('keydown', wake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (treasures > prevTreasures.current) {
      show('celebrate', 3200);
      armSleep();
    }
    prevTreasures.current = treasures;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treasures]);

  const lastPet = useRef(0);
  const quick = useRef(0);
  const streakTimer = useRef<number | undefined>(undefined);

  function pet() {
    const now = Date.now();
    quick.current = now - lastPet.current < 320 ? quick.current + 1 : 0;
    lastPet.current = now;
    const next = pets + 1;
    setPets(next);
    // A streak fades if she's left alone for a bit.
    window.clearTimeout(streakTimer.current);
    streakTimer.current = window.setTimeout(() => setPets(0), 8000);
    armSleep();
    const m = moodRef.current;
    if (m === 'sleepy' || m === 'curl') return show('stretch', 2800);
    if (quick.current >= 2) {
      quick.current = 0;
      return show('swat');
    }
    if (next >= 5 && next % 2 === 1) return show('rollover');
    if (next >= 3) {
      show('purr');
      setLine(pick(PET_LINES));
      return;
    }
    show(next === 1 ? 'boop' : 'happy');
  }

  return (
    <div className={`cat cat-${mood}${pets >= 3 ? ' cat-lots' : ''}`}>
      <p className="cat-bubble" aria-live="polite">
        {line && <span key={line + pets}>{line}</span>}
      </p>
      <button
        type="button"
        className="cat-button"
        onClick={pet}
        aria-label="Pet Marmalade the cat"
      >
        <svg viewBox="0 0 160 140" width="132" height="116" aria-hidden="true">
          <ellipse className="cat-shadow" cx="80" cy="132" rx="33" ry="5" />
          <g className="cat-sit">
          {/* tail */}
          <g className="cat-tail">
            <path
              d="M103 118 C128 118 134 92 124 74"
              fill="none"
              stroke="#e8823f"
              strokeWidth="9.5"
              strokeLinecap="round"
            />
            <path
              d="M127 82 C126 78 125 76 124 74"
              fill="none"
              stroke="#fbe3c8"
              strokeWidth="9.5"
              strokeLinecap="round"
            />
          </g>
          {/* body */}
          <g className="cat-body">
            <path
              d="M57 124 C50 96 60 68 80 68 C100 68 110 96 103 124 C97 135 63 135 57 124 Z"
              fill="#f08c48"
            />
            <path
              d="M71 118 C69 102 74 90 80 90 C86 90 91 102 89 118 C86 122 74 122 71 118 Z"
              fill="#fbe3c8"
            />
            <path
              d="M60 99 l9 3 M58 111 l10 2 M100 99 l-9 3 M101 111 l-10 2"
              stroke="#d26a2a"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* paws */}
            <g className="cat-paw-left">
              <ellipse cx="71" cy="128" rx="8" ry="5.5" fill="#fbe3c8" />
            </g>
            <g className="cat-paw-wave">
              <ellipse cx="89" cy="128" rx="8" ry="5.5" fill="#fbe3c8" />
            </g>
          </g>
          {/* forearm, out while grooming */}
          <g className="cat-arm">
            <path
              d="M90 108 C86 101 80 96 78 92"
              fill="none"
              stroke="#f08c48"
              strokeWidth="9"
              strokeLinecap="round"
            />
          </g>
          {/* forearm, out while waving */}
          <g className="cat-arm-wave">
            <path
              d="M96 116 C100 104 100 90 100 80"
              fill="none"
              stroke="#f08c48"
              strokeWidth="9"
              strokeLinecap="round"
            />
          </g>
          </g>
          {/* lying-down loaf */}
          <g className="cat-pose cat-pose-loaf">
            <path d="M116 118 C142 118 140 133 104 132" fill="none" stroke="#e8823f" strokeWidth="9" strokeLinecap="round" />
            <ellipse cx="90" cy="111" rx="38" ry="21" fill="#f08c48" />
            <path d="M86 92 l2 9 M98 91 l1 9 M110 94 l-1 8" stroke="#d26a2a" strokeWidth="3.5" strokeLinecap="round" />
            <ellipse cx="60" cy="128" rx="7" ry="4.5" fill="#fbe3c8" />
            <ellipse cx="74" cy="129" rx="7" ry="4.5" fill="#fbe3c8" />
          </g>
          {/* curled-up ball */}
          <g className="cat-pose cat-pose-curl">
            <ellipse cx="88" cy="110" rx="32" ry="23" fill="#f08c48" />
            <path d="M84 90 l2 8 M96 89 l1 8 M108 93 l-2 7" stroke="#d26a2a" strokeWidth="3.5" strokeLinecap="round" />
          </g>
          {/* standing on four legs */}
          <g className="cat-pose cat-pose-stand">
            <g className="cat-stand-tail">
              <path d="M120 92 C138 86 138 62 128 54" fill="none" stroke="#e8823f" strokeWidth="9" strokeLinecap="round" />
            </g>
            <g className="cat-leg cat-leg-b1"><path d="M110 100 V126" stroke="#e8823f" strokeWidth="9" strokeLinecap="round" /><ellipse cx="110" cy="128" rx="6" ry="4" fill="#fbe3c8" /></g>
            <g className="cat-leg cat-leg-f1"><path d="M74 100 V126" stroke="#e8823f" strokeWidth="9" strokeLinecap="round" /><ellipse cx="74" cy="128" rx="6" ry="4" fill="#fbe3c8" /></g>
            <ellipse cx="94" cy="96" rx="32" ry="15" fill="#f08c48" />
            <path d="M90 82 l1 8 M101 82 l0 8 M112 84 l-1 7" stroke="#d26a2a" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M80 104 C88 110 104 110 112 104" stroke="#fbe3c8" strokeWidth="5" strokeLinecap="round" fill="none" />
            <g className="cat-leg cat-leg-b2"><path d="M120 100 V126" stroke="#f08c48" strokeWidth="9" strokeLinecap="round" /><ellipse cx="120" cy="128" rx="6" ry="4" fill="#fbe3c8" /></g>
            <g className="cat-leg cat-leg-f2"><path d="M84 100 V126" stroke="#f08c48" strokeWidth="9" strokeLinecap="round" /><ellipse cx="84" cy="128" rx="6" ry="4" fill="#fbe3c8" /></g>
          </g>
          {/* rolled over, belly up */}
          <g className="cat-pose cat-pose-roll">
            <path d="M116 120 C134 126 142 118 144 108" fill="none" stroke="#e8823f" strokeWidth="9" strokeLinecap="round" />
            <g className="cat-roll-legs" stroke="#f08c48" strokeWidth="8" strokeLinecap="round">
              <path className="cat-rleg1" d="M74 104 L68 86" />
              <path className="cat-rleg2" d="M86 100 L84 82" />
              <path className="cat-rleg3" d="M100 100 L104 83" />
              <path className="cat-rleg4" d="M110 104 L118 88" />
            </g>
            <g fill="#fbe3c8">
              <circle cx="68" cy="85" r="4.5" /><circle cx="84" cy="81" r="4.5" /><circle cx="104" cy="82" r="4.5" /><circle cx="118" cy="87" r="4.5" />
            </g>
            <ellipse cx="92" cy="116" rx="34" ry="16" fill="#f08c48" />
            <ellipse cx="92" cy="111" rx="22" ry="9" fill="#fbe3c8" />
          </g>
          {/* head */}
          <g className="cat-head">
            <path d="M54 38 L58 9 L75 26 Z" fill="#f08c48" />
            <path d="M106 38 L102 9 L85 26 Z" fill="#f08c48" />
            <path d="M60 30 L62 16 L70 25 Z" fill="#f7b49a" />
            <path d="M100 30 L98 16 L90 25 Z" fill="#f7b49a" />
            <ellipse cx="80" cy="49" rx="31" ry="29" fill="#f08c48" />
            <path
              d="M80 22 v11 M72 24 l3 9 M88 24 l-3 9"
              stroke="#d26a2a"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <ellipse cx="80" cy="62" rx="15" ry="11.5" fill="#fbe3c8" />
            {/* cheeks */}
            <ellipse
              className="cat-blush"
              cx="61"
              cy="58"
              rx="6"
              ry="4"
              fill="#f2784b"
            />
            <ellipse
              className="cat-blush"
              cx="99"
              cy="58"
              rx="6"
              ry="4"
              fill="#f2784b"
            />
            {/* eyes: open */}
            <g className="cat-eyes-open">
              <g className="cat-pupils">
                <ellipse cx="68" cy="47" rx="4.6" ry="6" fill="#1f3a2e" />
                <ellipse cx="92" cy="47" rx="4.6" ry="6" fill="#1f3a2e" />
                <circle cx="69.3" cy="44.7" r="1.6" fill="#fff" />
                <circle cx="93.3" cy="44.7" r="1.6" fill="#fff" />
              </g>
            </g>
            {/* eyes: happy arcs */}
            <g
              className="cat-eyes-happy"
              fill="none"
              stroke="#1f3a2e"
              strokeWidth="3.5"
              strokeLinecap="round"
            >
              <path d="M62 49 q6 -7 12 0" />
              <path d="M86 49 q6 -7 12 0" />
            </g>
            {/* eyes: sleepy lines */}
            <g
              className="cat-eyes-sleep"
              fill="none"
              stroke="#1f3a2e"
              strokeWidth="3.5"
              strokeLinecap="round"
            >
              <path d="M62 48 q6 5 12 0" />
              <path d="M86 48 q6 5 12 0" />
            </g>
            <path d="M76.5 56 h7 l-3.5 4 z" fill="#c95b4a" />
            <path
              className="cat-mouth"
              d="M80 60 q-4 5 -8 2 M80 60 q4 5 8 2"
              fill="none"
              stroke="#1f3a2e"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <ellipse
              className="cat-mouth-open"
              cx="80"
              cy="65"
              rx="3.2"
              ry="2.8"
              fill="#c95b4a"
            />
            {/* tongue, out while grooming */}
            <path
              className="cat-tongue"
              d="M80 65 q4 6 0 11 q-4 -5 0 -11"
              fill="#f19aa4"
            />
            <path
              d="M65 60 l-13 -3 M65 64 l-13 2 M95 60 l13 -3 M95 64 l13 2"
              stroke="#fff"
              strokeOpacity="0.85"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </g>
          {/* tail wrapped over the nose while curled up */}
          <g className="cat-pose cat-pose-curl">
            <path d="M118 116 C116 136 66 138 56 120" fill="none" stroke="#e8823f" strokeWidth="10" strokeLinecap="round" />
            <path d="M60 126 C58 124 57 122 56 120" fill="none" stroke="#fbe3c8" strokeWidth="10" strokeLinecap="round" />
          </g>
          {/* purr notes */}
          <g className="cat-notes" fill="#1f4d3a">
            <g className="cat-note1"><circle cx="124" cy="40" r="4" /><path d="M127.5 40 V26 l6 3" stroke="#1f4d3a" strokeWidth="2" fill="none" strokeLinecap="round" /></g>
            <g className="cat-note2"><circle cx="34" cy="48" r="3.4" /><path d="M37 48 V36 l5 2.5" stroke="#1f4d3a" strokeWidth="2" fill="none" strokeLinecap="round" /></g>
          </g>
          {/* dizzy stars */}
          <g className="cat-dizzy-stars" fill="#f2b84b">
            <path d="M56 14 l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1z" />
            <path d="M100 8 l1.6 4 4 .8 -3 2.4 .8 4 -3.4 -2.4 -3.4 2.4 .8 -4 -3 -2.4 4 -.8z" />
          </g>
          {/* extras */}
          <g className="cat-heart" fill="#f2784b">
            <path d="M128 30 c-4 -6 -12 -2 -8 5 l8 8 8 -8 c4 -7 -4 -11 -8 -5z" />
          </g>
          <g className="cat-heart2" fill="#f2784b">
            <path d="M36 36 c-3 -5 -10 -2 -7 4 l7 7 7 -7 c3 -6 -4 -9 -7 -4z" />
          </g>
          <g
            className="cat-zzz"
            fill="#1f4d3a"
            fontFamily="inherit"
            fontWeight="700"
          >
            <text x="114" y="33" fontSize="14">
              z
            </text>
            <text x="126" y="20" fontSize="10">
              z
            </text>
          </g>
          <g
            className="cat-sparkle"
            stroke="#f2b84b"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="M24 30 v10 M19 35 h10" />
            <path d="M138 44 v8 M134 48 h8" />
            <path d="M30 70 v6 M27 73 h6" />
          </g>
          {/* yarn ball, out while playing */}
          <g className="cat-yarn">
            <circle cx="50" cy="123" r="7.5" fill="#f2784b" />
            <path
              d="M44 119 q6 4 12 0 M43 124 q7 4 14 0"
              stroke="#fbe3c8"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M57 127 q9 4 15 -2"
              stroke="#f2784b"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
            />
          </g>
          {/* startled "!" */}
          <g className="cat-bang">
            <path
              d="M124 17 v13"
              stroke="#f2784b"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="124" cy="39" r="2.8" fill="#f2784b" />
          </g>
        </svg>
      </button>
    </div>
  );
}
