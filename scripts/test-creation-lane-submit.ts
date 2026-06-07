#!/usr/bin/env node
/**
 * 创作车道提交路由单测（纯逻辑，无需 API）
 * pnpm exec tsx scripts/test-creation-lane-submit.ts
 */
import {
  buildDirectSubmitContext,
  buildOrchestrationDispatchContext,
  hasReferenceImages,
  resolveCreationSubmitPath,
  shouldOrchestrationHandleSubmit,
  shouldUseAgentSubmit,
  shouldUseSkillSubmit,
  type ReferenceImageSources,
} from "../apps/web/src/lib/creation-lane-submit.ts";

const emptyRefs: ReferenceImageSources = {
  assetIds: [],
  mentionedAssetIds: [],
  selectedRefIds: [],
};

const withRefs: ReferenceImageSources = {
  assetIds: ["asset-1"],
  mentionedAssetIds: [],
  selectedRefIds: [],
};

const results: { name: string; pass: boolean; detail?: string }[] = [];

function ok(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  const icon = pass ? "✓" : "✗";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

function assertEq<T>(name: string, actual: T, expected: T) {
  ok(name, actual === expected, actual !== expected ? `got ${String(actual)}` : "");
}

// --- hasReferenceImages ---
ok("hasReferenceImages empty", !hasReferenceImages(emptyRefs));
ok("hasReferenceImages asset", hasReferenceImages(withRefs));

// --- orchestration guard: refs block agent ---
const agentLaneNoRefs = buildOrchestrationDispatchContext({
  creationLane: "agent",
  activeSkillId: null,
  focusEditActive: false,
  mentionedMasksCount: 0,
  submitVideo: false,
  referenceImageSources: emptyRefs,
});
ok(
  "orchestration agent lane no refs",
  shouldOrchestrationHandleSubmit(agentLaneNoRefs),
);

const agentLaneWithRefs = buildOrchestrationDispatchContext({
  creationLane: "agent",
  activeSkillId: null,
  focusEditActive: false,
  mentionedMasksCount: 0,
  submitVideo: false,
  referenceImageSources: withRefs,
});
ok(
  "orchestration blocked by reference images",
  !shouldOrchestrationHandleSubmit(agentLaneWithRefs),
);

// --- direct agent: studio orchestration off (home dock) ---
const homeAgentCtx = buildDirectSubmitContext({
  studioOrchestrationActive: false,
  skillsEnabled: true,
  agentEnabled: true,
  isDock: true,
  creationLane: "agent",
  activeSkillId: null,
  focusEditActive: false,
  mentionedMasksCount: 0,
  submitVideo: false,
  submitEcommerce: false,
  referenceImageSources: emptyRefs,
});
ok("home dock agent submit", shouldUseAgentSubmit(homeAgentCtx));

const homeAgentWithRefs = buildDirectSubmitContext({
  studioOrchestrationActive: false,
  skillsEnabled: true,
  agentEnabled: true,
  isDock: true,
  creationLane: "agent",
  activeSkillId: null,
  focusEditActive: false,
  mentionedMasksCount: 0,
  submitVideo: false,
  submitEcommerce: false,
  referenceImageSources: withRefs,
});
ok("home dock agent blocked by refs", !shouldUseAgentSubmit(homeAgentWithRefs));

// --- studio orchestration active: direct agent/skill disabled ---
const studioCtx = buildDirectSubmitContext({
  studioOrchestrationActive: true,
  skillsEnabled: true,
  agentEnabled: true,
  isDock: true,
  creationLane: "agent",
  activeSkillId: null,
  focusEditActive: false,
  mentionedMasksCount: 0,
  submitVideo: false,
  submitEcommerce: false,
  referenceImageSources: emptyRefs,
});
ok("studio blocks direct agent", !shouldUseAgentSubmit(studioCtx));
ok("studio blocks direct skill", !shouldUseSkillSubmit({ ...studioCtx, activeSkillId: "skill-1" }));

// --- resolveCreationSubmitPath matrix ---
assertEq(
  "path orchestration when provider handles",
  resolveCreationSubmitPath({
    direct: studioCtx,
    orchestrationDispatchWouldHandle: true,
  }),
  "orchestration",
);

assertEq(
  "path image when agent lane + refs (studio)",
  resolveCreationSubmitPath({
    direct: buildDirectSubmitContext({
      studioOrchestrationActive: true,
      skillsEnabled: true,
      agentEnabled: true,
      isDock: true,
      creationLane: "agent",
      activeSkillId: null,
      focusEditActive: false,
      mentionedMasksCount: 0,
      submitVideo: false,
      submitEcommerce: false,
      referenceImageSources: withRefs,
    }),
    orchestrationDispatchWouldHandle: false,
  }),
  "image-or-video",
);

assertEq(
  "path agent home dock",
  resolveCreationSubmitPath({
    direct: homeAgentCtx,
    orchestrationDispatchWouldHandle: false,
  }),
  "agent",
);

const homeDockBase = {
  studioOrchestrationActive: false,
  skillsEnabled: true,
  agentEnabled: true,
  isDock: true,
  focusEditActive: false,
  mentionedMasksCount: 0,
  submitEcommerce: false,
  referenceImageSources: emptyRefs,
} as const;

assertEq(
  "path skill home dock",
  resolveCreationSubmitPath({
    direct: buildDirectSubmitContext({
      ...homeDockBase,
      creationLane: "agent",
      activeSkillId: "ecommerce-set",
      submitVideo: false,
    }),
    orchestrationDispatchWouldHandle: false,
  }),
  "skill",
);

assertEq(
  "path video lane",
  resolveCreationSubmitPath({
    direct: buildDirectSubmitContext({
      ...homeDockBase,
      creationLane: "video",
      activeSkillId: null,
      submitVideo: true,
    }),
    orchestrationDispatchWouldHandle: false,
  }),
  "image-or-video",
);

assertEq(
  "path focus edit",
  resolveCreationSubmitPath({
    direct: buildDirectSubmitContext({
      ...homeDockBase,
      creationLane: "image",
      activeSkillId: null,
      submitVideo: false,
      focusEditActive: true,
    }),
    orchestrationDispatchWouldHandle: false,
  }),
  "focus-edit",
);

const failed = results.filter((r) => !r.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} creation-lane-submit tests passed.`);
