---
title: Satellites
---

# Satellites

Satellite apps (e.g. pair-programming) are separate processes configured in `~/.anima/config.yaml` and started/stopped with `anima service`.

## Example

```yaml
satellites:
  pair-programming:
    enabled: true
    command: bun
    args: ["satellites/pair-programming/dev.ts"]
    workspace: /path/to/project
    gitignore: true
    showHidden: false
    env:
      SATELLITE_PORT: "4173"
```

| Field                      | Role                                            |
| -------------------------- | ----------------------------------------------- |
| `command` / `args`         | Process to spawn                                |
| `workspace`                | File tree root (injected as `STUDIO_WORKSPACE`) |
| `gitignore` / `showHidden` | File tree filters                               |
| `env`                      | Extra environment variables                     |

Open the UI at the URL reported on Chamber → Satellites (from SAP `http_url`), typically `http://127.0.0.1:4173`.

There is **no** global `studio:` section in `config.yaml`.
