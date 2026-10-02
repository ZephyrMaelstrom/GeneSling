# GeneSling

**Catch it in the Bloom. Cut it free. Breed something the Bloom can never take back.**

GeneSling is a browser roguelite about creature capture with extraction stakes. Dive into a living dungeon with a gun, three creatures and a bag of cages. Weaken wild creatures, cage them and run for an extraction point. Die inside and you lose everything you brought. What you carry out, you breed, raise and put to work in your hideout.

## Play the prototype

Open `prototype/index.html` in a browser. It works on desktop (WASD and mouse) and on phones (touch joysticks).

## Docs

- [Design](docs/DESIGN.md): the vision for 1.0
- [Roadmap](docs/ROADMAP.md): ten phases from prototype to launch
- [Development phases](docs/DEVELOPMENT_PHASES.md): goals, build lists and exit tests
- [Prototype notes](docs/PROTOTYPE.md): how the current build works

## Develop

```bash
python3 prototype/build.py   # rebuild the game from prototype/src
npm install && npm test      # headless browser tests
```
