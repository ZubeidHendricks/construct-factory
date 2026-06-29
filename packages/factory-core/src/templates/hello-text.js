// Hello-text template: a Text object placed on the layout. Text needs no image
// assets, so this exercises object types + instances without the (still
// unverified) Sprite image pipeline.

export function helloText(game, { message = "Hello from construct-factory" } = {}) {
  const layout = game.addLayout({ name: "Game", withEventSheet: true, makeFirst: true });
  game.addText({ name: "Hello" });
  game.placeInstance({
    layout: layout.name,
    object: "Hello",
    x: 640,
    y: 360,
    width: 400,
    height: 60,
    properties: { text: message },
  });
}
