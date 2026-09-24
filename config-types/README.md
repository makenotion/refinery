# Refinery configuration types

`@notionhq/refinery-config-types` is a types-only package generated from this
fork's canonical `config/metadata/configMeta.yaml` and `rulesMeta.yaml` files.
It exports `RefineryConfig`, `RefineryRules`, and individual section/sampler types.
There are no runtime dependencies or install/build hooks.

```typescript
import type { RefineryConfig, RefineryRules } from "@notionhq/refinery-config-types"

const config = {
  General: { ConfigurationVersion: 2 },
} satisfies RefineryConfig

const rules = {
  RulesVersion: 2,
  Samplers: { __default__: { DeterministicSampler: { SampleRate: 1 } } },
} satisfies RefineryRules
```

## Regeneration and verification

From the repository root, with Node 22.13 or newer:

```sh
npm ci
npm run generate
npm test
npm pack --dry-run
```

Commit regenerated `config-types/index.d.ts` whenever the metadata or generator
changes. CI checks that generation is reproducible and compiles both valid and
intentionally invalid consumer examples. Generator fixture tests also compile
small schemas to check required fields, conflicting fields, conditional
requirements (including defaults), and failure on unknown field types or invalid
constraint references. Run them alone with:

```sh
node --experimental-strip-types --test config-types/generate.test.mjs
```

The declaration header records a hash
of both metadata files so packaging-only commits do not imply a schema change.

The small structural mapping in `generate.ts` connects rules, conditions, and
samplers because the metadata describes those object fields without their full
TypeScript structure. Unknown field types fail generation and must be mapped
when upgrading Refinery.

## Consumption and upgrades

The root package manifest supports an authenticated Git dependency pinned to a
full immutable commit SHA in `makenotion/refinery`. Generated declarations are
checked in, so consumers do not need Go, the generator, or its development tools.
The package is private to prevent accidental registry publication. Registry
publishing and notion-next dependency integration are separate changes.

Choose a package revision whose metadata matches the deployed Refinery version;
update the pin and generated consumer config when upgrading that version. A
packaging-only commit can differ from the image commit while having identical
metadata. Do not depend on a moving branch. Private Git authentication must be
verified in the consuming repository's install and CI environment.

These types check structure, choices, required fields, conflicting fields and
exactly one sampler per target. They do not replace `refinery --validate`:
numeric ranges, duration syntax, secret expansion and other runtime constraints
remain the binary's responsibility. Metadata may also include deprecated options
or differ from runtime implementation; the package follows that metadata rather
than silently introducing its own configuration schema.
