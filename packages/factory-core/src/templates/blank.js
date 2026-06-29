// Blank template: one empty layout + its event sheet, set as firstLayout.
// No object types, so no image assets are required. This is the minimal project
// known to open cleanly in Construct 3 — the verification baseline.

export function blank(game, {} = {}) {
  game.addLayout({ name: "Game", withEventSheet: true, makeFirst: true });
}
