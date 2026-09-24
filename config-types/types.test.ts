import type {
  RefineryConfig,
  RefineryRules,
  RefinerySamplerChoice,
  RulesBasedDownstreamSampler,
  RulesBasedSamplerCondition,
} from "@notionhq/refinery-config-types";

const config: RefineryConfig = {
  General: { ConfigurationVersion: 2 },
  AccessKeys: { ReceiveKeys: ["${HONEYCOMB_API_KEY}"] },
  Collection: { AvailableMemory: "8Gi", MaxMemoryPercentage: 85 },
};
const rules: RefineryRules = {
  RulesVersion: 2,
  Samplers: {
    __default__: {
      RulesBasedSampler: {
        Rules: [
          {
            Name: "Full Traces",
            Conditions: [
              { Field: "sampling.full_trace", Operator: "=", Value: true },
            ],
            Sampler: {
              EMADynamicSampler: {
                GoalSampleRate: 10,
                FieldList: ["sampling.reason"],
                MaxKeys: 1000,
              },
            },
          },
        ],
      },
    },
    development: { DeterministicSampler: { SampleRate: 1 } },
  },
};

// @ts-expect-error A globally required configuration group cannot be omitted.
const missingGeneral: RefineryConfig = {};
// @ts-expect-error A sampler is required.
const noSampler: RefinerySamplerChoice = {};
// @ts-expect-error Required sampler fields cannot be omitted.
const missingRate: RefinerySamplerChoice = { DeterministicSampler: {} };
const twoSamplers = {
  DeterministicSampler: { SampleRate: 1 },
  EMADynamicSampler: { GoalSampleRate: 10, FieldList: ["name"] },
};
// @ts-expect-error Multiple sampler types are invalid even through an intermediate variable.
const multipleSamplers: RefinerySamplerChoice = twoSamplers;
// @ts-expect-error The downstream choice also requires exactly one sampler.
const multipleDownstreamSamplers: RulesBasedDownstreamSampler = twoSamplers;
const nestedRules: RulesBasedDownstreamSampler = {
  // @ts-expect-error Rules-based samplers cannot be nested downstream.
  RulesBasedSampler: { Rules: [] },
};
// @ts-expect-error Field and Fields are mutually exclusive.
const conflictingFields: RulesBasedSamplerCondition = {
  Field: "name",
  Fields: ["name"],
  Operator: "=",
};
const singleField: RulesBasedSamplerCondition = {
  Field: "name",
  Operator: "=",
};
const multipleFields: RulesBasedSamplerCondition = {
  Fields: ["name", "other"],
  Operator: "=",
};
const invalidOperator: RulesBasedSamplerCondition = {
  Field: "name",
  // @ts-expect-error Unknown operators are rejected.
  Operator: "typo",
};
const noDefault: RefineryRules = {
  RulesVersion: 2,
  // @ts-expect-error The default target is required.
  Samplers: { development: { DeterministicSampler: { SampleRate: 1 } } },
};
const invalidVersion: RefineryRules = {
  // @ts-expect-error RulesVersion must be 2.
  RulesVersion: 3,
  Samplers: rules.Samplers,
};

void [
  config,
  rules,
  missingGeneral,
  noSampler,
  missingRate,
  multipleSamplers,
  multipleDownstreamSamplers,
  nestedRules,
  conflictingFields,
  singleField,
  multipleFields,
  invalidOperator,
  noDefault,
  invalidVersion,
];

// Refinery accepts memory sizes as either unit strings or numeric byte counts.
const numericMemory: RefineryConfig = {
  General: { ConfigurationVersion: 2 },
  Collection: { AvailableMemory: 8589934592 },
};
void numericMemory;
