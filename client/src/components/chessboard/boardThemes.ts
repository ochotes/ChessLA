export interface BoardTheme {
  id: string;
  label: string;
  vars: {
    "--board-light": string;
    "--board-dark": string;
    "--board-coord": string;
    "--board-selected": string;
    "--board-legal-dot": string;
    "--board-last-move": string;
    "--board-check": string;
  };
}

// Each theme fully overrides the board-specific CSS custom properties
// defined in styles/tokens.css. Values are "R G B" triplets to match the
// `rgb(var(--x) / alpha)` pattern used throughout the app.
export const BOARD_THEMES: BoardTheme[] = [
  {
    id: "classic",
    label: "Classic wood",
    vars: {
      "--board-light": "240 217 181",
      "--board-dark": "181 136 99",
      "--board-coord": "120 90 66",
      "--board-selected": "246 216 101",
      "--board-legal-dot": "17 94 82",
      "--board-last-move": "246 199 90",
      "--board-check": "200 55 55",
    },
  },
  {
    id: "emerald",
    label: "Emerald",
    vars: {
      "--board-light": "234 240 230",
      "--board-dark": "58 122 97",
      "--board-coord": "230 240 235",
      "--board-selected": "246 216 101",
      "--board-legal-dot": "17 94 82",
      "--board-last-move": "214 171 82",
      "--board-check": "200 55 55",
    },
  },
  {
    id: "slate",
    label: "Slate",
    vars: {
      "--board-light": "223 227 231",
      "--board-dark": "92 104 116",
      "--board-coord": "230 233 236",
      "--board-selected": "214 171 82",
      "--board-legal-dot": "49 99 148",
      "--board-last-move": "158 128 58",
      "--board-check": "200 70 70",
    },
  },
];

export function getBoardTheme(id: string | undefined): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}
