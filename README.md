# GeneSling

**Catch it in the Bloom. Cut it free. Breed something the Bloom can never take back.**

GeneSling is a browser roguelite about creature capture with extraction stakes. Dive into a living dungeon with a gun, three creatures and a bag of cages. Weaken wild creatures, cage them and run for an extraction point. Die inside and you lose everything you brought. What you carry out, you breed, raise and put to work in your hideout.

## Play the prototype

**Play it here: https://zephyrmaelstrom.github.io/GeneSling/** (rebuilt from `main` on every push).

**Free demo** (the Rootworks and Act I): https://zephyrmaelstrom.github.io/GeneSling/demo/. A demo save carries into the full game on the same browser.

Run `npm install && npm run build`, then open `dist/index.html` in a browser. Pushes to `main` also deploy it to GitHub Pages. It works on desktop (WASD and mouse) and on phones (touch joysticks).

## Docs

- [Design](docs/DESIGN.md): the vision for 1.0
- [Roadmap](docs/ROADMAP.md): ten phases from prototype to launch
- [Development phases](docs/DEVELOPMENT_PHASES.md): goals, build lists and exit tests
- [Code](docs/CODE.md): how the code is built

## Develop

```bash
npm install       # once
npm run dev       # rebuild dist/index.html on every change in src/
npm run lint      # ESLint
npm test          # build, then run the headless browser tests
```
