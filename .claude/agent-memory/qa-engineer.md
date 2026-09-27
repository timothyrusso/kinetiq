# qa-engineer memory: operational lessons

Read at the start of every run. Append only under the rules in the plugin's
agent-memory/README.md. Humans curate at PR review.

## Known environment

- Simulator: iPhone 17 Pro (`qa.simulator` in `kit.config.json`); `npm run ios` targets it.
- Metro: port 8084 only (`npx expo start --dev-client --port 8084`). 8081 belongs to another
  project on this machine and 8082 to a long-running Metro: never start or stop either.
- Stop any Metro or simulator process the run started before reporting.

## Lessons

- [2026-09-26] The iOS 26.5 and watchOS 26.5 simulator pair cannot deliver `transferUserInfo` or
  `transferFile`: both report success on the sender and never arrive. `sendMessage` and the
  application context work, so phone to watch snapshots can be checked on the simulator, but a
  workout sent from the watch to the phone inbox only arrives on hardware.
- [2026-09-26] The phone reports the watch app installed only after the watch app has been
  installed and launched on the watch simulator and the phone app relaunched.
