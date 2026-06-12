# Notion fork of Refinery

This is Notion's fork of [honeycombio/refinery](https://github.com/honeycombio/refinery).
It exists to carry a small patch set that upstream does not have: **individual span
(partial trace) sampling**.

## The patch

Spans that arrive with the `meta.refinery.individual_span` attribute receive an
immediate, independent sampling decision from the configured sampler — as though
they were a trace consisting of a single span. The decision is not recorded in any
cache, and the span is never forwarded to peers, so the rest of the trace continues
to be sampled normally. Notion's app servers tail-sample spans and mark the kept
ones with this attribute (see `NotionTailSamplerSpanProcessor` and the
`transform/refinery_individual_span` OTel collector processor in notion-next).

Originally implemented by Ben Hughes on a v2.9.5-era fork
([schleyfox/refinery#1](https://github.com/schleyfox/refinery/pull/1), preserved
here as the `v2-main-fork` branch) and ported onto v3.2.2.

An additional v2-era experiment, batch uniform sampling for individual spans
([schleyfox/refinery#2](https://github.com/schleyfox/refinery/pull/2)), is preserved
on `v2-buffer-spans-for-accuracy` but has not been ported to v3 or deployed.

## Branches

- `notion-main` (default): upstream release + Notion patches. This is what we build
  and deploy.
- `main`: pristine upstream `honeycombio/refinery` main, for syncing.
- `v2-main-fork`, `v2-buffer-spans-for-accuracy`: Ben Hughes's original v2-era
  branches, kept for provenance.

## Upgrading to a new upstream release

```sh
git remote add upstream https://github.com/honeycombio/refinery.git
git fetch upstream --tags
git push origin upstream/main:main         # keep our mirror of upstream current
git checkout -b notion-main-vX.Y.Z vX.Y.Z  # start from the new release tag
git cherry-pick <patch commits from notion-main>
go test ./types/ ./collect/... ./route/
```

Then fast-forward/reset `notion-main` to the new branch once tests pass and the
image has been verified (see "Building" below). The patch touches
`types/payload.go`, `route/route.go`, `collect/collect.go`,
`collect/collector_worker.go`, `collect/mockCollector.go`, and tests; expect to
re-resolve it by hand if upstream reworks the collector again.

## Building and deploying

The deployable image is built from this repo and pushed to the `refinery-base` ECR
repo, then consumed by `docker/refinery/Dockerfile` in notion-next:

1. Tag the fork (see "Versioning"), then run `./build-docker.sh`. Do **not** publish
   a raw `ko build` / `go build` image — it reports `service.version="dev"`.
2. Tag and push as
   `274567149370.dkr.ecr.us-west-2.amazonaws.com/refinery-base:<short commit sha>`.
3. Update the `FROM` tag in notion-next `docker/refinery/Dockerfile`.

The pubsub package's Redis tests require a local Redis on `:6379`; all other tests
run standalone.

## Versioning

`cmd/refinery/main.go` stamps the OTLP `service.version` resource attribute from a
`main.BuildID` symbol set via ldflags at compile time, falling back to `"dev"` when
the ldflag is absent. We read `service.version` in Notion's Honeycomb `metrics`
dataset to tell rollouts/builds apart, so a `"dev"` value (every container
indistinguishable) is a bug. When publishing the `refinery-base` image:

- **Build via `build-docker.sh`** (or any build passing
  `-ldflags "-X main.BuildID=<version>"`); it derives the version from
  `git describe --tags --match='v[0-9]*' --always`. A raw `ko build` / `go build`
  omits the ldflag and yields `service.version="dev"`.
- **Tag the fork first** with a `v3.x`-style tag so `git describe` produces a
  meaningful version, not a bare sha. Convention: `v3.2.2-notion.1`, incrementing
  the `-notion.N` suffix per Notion fork build.
