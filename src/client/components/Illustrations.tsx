import React from 'react';

/*
 * Poetree icon set: Lucide-style line icons (ISC-licensed path data) rendered as
 * inline SVG, so nothing is ever fetched. Rooms are shown as an icon inside a
 * soft mint tile ("icon tile") everywhere in the app.
 */

type P = { className?: string; size?: number };

function Line({ children, size = 24, className }: P & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const LineIcons = {
  ask: (p: P) => (
    <Line {...p}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </Line>
  ),
  research: (p: P) => (
    <Line {...p}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </Line>
  ),
  schoolwork: (p: P) => (
    <Line {...p}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </Line>
  ),
  play: (p: P) => (
    <Line {...p}>
      <line x1="6" x2="10" y1="11" y2="11" />
      <line x1="8" x2="8" y1="9" y2="13" />
      <line x1="15" x2="15.01" y1="12" y2="12" />
      <line x1="18" x2="18.01" y1="10" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
    </Line>
  ),
  saved: (p: P) => (
    <Line {...p}>
      <path d="M3 12V9a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v3" />
      <rect x="3" y="12" width="18" height="8" rx="2" />
      <rect x="10" y="10" width="4" height="5" rx="1" />
    </Line>
  ),
  note: (p: P) => (
    <Line {...p}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </Line>
  ),
  arrow: (p: P) => (
    <Line {...p}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </Line>
  ),
  clock: (p: P) => (
    <Line {...p}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Line>
  ),
  leaf: (p: P) => (
    <Line {...p}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </Line>
  ),
  grid: (p: P) => (
    <Line {...p}>
      <rect width="7" height="7" x="3" y="3" rx="1.5" />
      <rect width="7" height="7" x="14" y="3" rx="1.5" />
      <rect width="7" height="7" x="14" y="14" rx="1.5" />
      <rect width="7" height="7" x="3" y="14" rx="1.5" />
    </Line>
  ),
  shield: (p: P) => (
    <Line {...p}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </Line>
  ),
  heart: (p: P) => (
    <Line {...p}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </Line>
  ),
  code: (p: P) => (
    <Line {...p}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </Line>
  ),
  cpu: (p: P) => (
    <Line {...p}>
      <rect width="16" height="16" x="4" y="4" rx="2" />
      <rect width="6" height="6" x="9" y="9" rx="1" />
      <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
    </Line>
  ),
};

type RoomKey = 'ask' | 'research' | 'schoolwork' | 'play' | 'saved' | 'note';

/** A room icon inside a soft mint tile. */
export function IconTile({
  room,
  size = 26,
  className = '',
}: {
  room: RoomKey;
  size?: number;
  className?: string;
}) {
  const Icon = LineIcons[room];
  return (
    <span className={`icon-tile ${className}`} aria-hidden="true">
      <Icon size={size} />
    </span>
  );
}

const tile = (room: RoomKey) =>
  function RoomTile({ className }: { className?: string }) {
    return <IconTile room={room} className={className} />;
  };

export const roomArt = {
  ask: tile('ask'),
  research: tile('research'),
  schoolwork: tile('schoolwork'),
  play: tile('play'),
  saved: tile('saved'),
} as const;
export const TreasureChestArt = tile('saved');
export const NoteArt = tile('note');

export function ChestIcon({ className }: { className?: string }) {
  return <LineIcons.saved size={20} className={className} />;
}
export function MapIcon({ className }: { className?: string }) {
  return <LineIcons.grid size={18} className={className} />;
}
export function LanternIcon(_: { lit?: boolean; className?: string }) {
  return <LineIcons.clock size={18} />;
}
