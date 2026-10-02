# Closed playtest plan (Phase 8)

The Journey Simulator says a dedicated player reaches the Heart's gate around day 58 and the top Unbound tiers around day 90. The closed playtest checks that real people move at that pace and that nobody gets stuck. This is the half of Phase 8's exit test that needs people.

## Who and how long

- **About 20 players** from the demo's community, using the full game for **four weeks**.
- A mix of play habits: about a third who play most days for an hour or more, and the rest a few times a week.
- Everyone plays on their own phone. Most should be Android phones held sideways, since that's the layout the game targets.

## Before it starts

1. Put a Firebase project in `src/data/firebase.json` (`apiKey`, `projectId`). Without it, nothing is sent: play stats and feedback only work once a project is set.
2. Deploy `main` to GitHub Pages as usual.
3. Send each tester the link with `?playtest` on the end: `https://zephyrmaelstrom.github.io/GeneSling/?playtest`.
   - It marks their save as a playtest save.
   - After the tutorial, it asks them once whether to send anonymous play stats.
4. Ask testers to leave **Settings → Feedback** on and to use the Feedback button whenever something confuses or annoys them.

## What comes in

All events carry a random install id, `playtest: true`, the hideout day, the Keeper rank and the time. Nothing names a player or a creature.

| Event | When | Extra fields |
| --- | --- | --- |
| `session_start` | Each time the game opens | whether the player came back after 8 hours or more |
| `tutorial_done` | The tutorial is finished | |
| `raid_end` | Every raid ends | outcome, floor, deepest floor, mode |
| `act` | A new act opens (Act II: first reach the veins; Act III: the Underheart; Act IV: Ilsa freed) | act, calendar day, raids so far |
| `gate_blocked` | A portal refuses the player (at most once a day per gate) | gate, calendar day, what was still missing |
| `gate_passed` | The player gets past a gate they were held at | gate, days spent waiting, calendar day |

Each player's own pace is also in their save. The **Test Lab → Journey Simulator → This save's pace** panel shows when each act opened and every gate wait.

## What passes

From `BALANCE.PLAYTEST` and the exit test in `docs/DEVELOPMENT_PHASES.md`:

- Testers who play most days reach **Act II by about day 12** (the simulator's dedicated players reach it on day 9 to 11).
- **Nobody waits at a gate for more than 7 days.** Any `gate_passed` with `wait` over 7, or a `gate_blocked` with no `gate_passed` a week later, is a failure. Its `missing` list says which part of the gate held them.
- Feedback has no recurring "I didn't know what to do next" at a gate. The Raid tab's gate checklist is meant to answer that.

## What to do with the results

- Gate waits point at a part of the gate to tune: the rank (`GATES.*.rank`), the stations (`GATES.veins.stations`), vein bosses or the cut-free creature.
- If testers move much faster or slower than the bots, adjust `KEEPER_CURVE`, `BOSS_XP` or the bot styles in `JOURNEY.styles` until the simulator matches the testers. Then retune the game against the simulator.
- Record what changed and why in `docs/DESIGN.md` under "Balance as built".
