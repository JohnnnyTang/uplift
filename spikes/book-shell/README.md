# Book shell spike

Run from the repository root:

```sh
pnpm install
pnpm --filter @uplift/spike-book-shell dev
```

Open http://127.0.0.1:5174. Keep the server running for
`pnpm --filter @uplift/spike-book-shell smoke` (requires installed Google Chrome).
The smoke command refreshes committed evidence. If Vite reloads the HTML during a run,
wait for that reload to finish and rerun.

Use `pnpm --filter @uplift/spike-book-shell typecheck` and
`pnpm --filter @uplift/spike-book-shell build` for standalone checks.

This is an explicitly static layout fixture, not an erosion simulation.
See [the decision, evidence and 2E handover](../../docs/spikes/1D-book-shell.md).
