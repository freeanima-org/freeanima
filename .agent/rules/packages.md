# Package naming (RFC #1)

New-stack workspace package names **prefix with layer name**:

| Shape                | Pattern                            | Example                                         |
| -------------------- | ---------------------------------- | ----------------------------------------------- |
| Layer aggregate      | `@freeanima/{layer}`               | `kernel`, `engine`                              |
| Layer component      | `@freeanima/{layer}-{slug}`        | `kernel-eventbus`, `engine-tool`, `service-api` |
| Layer implementation | `@freeanima/{layer}-{slug}-{impl}` | `connectors-eventbus-redis`                     |

- Compound slugs without inner hyphens (`eventbus`, not `event-bus`)
- Hook / EventTopic `qualifiedId` is independent of npm package name

Layer dependency rules: [`code-layers.md`](code-layers.md).
