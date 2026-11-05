import { expect, test } from "bun:test";
import { chromiumAppPath } from "./chromium-app";

const input = {
  runId: "dino__haiku__r0",
  chromiumSrc: "/chromium/src",
  buildDirectory: "/builds",
  latestTarget: null,
  latestLocalRunId: null,
  remoteAppExists: false,
  localAppExists: false,
};

test("a build-Mac copy is that run's chrome even without a passed row", () => {
  expect(chromiumAppPath({ ...input, remoteAppExists: true })).toBe("/builds/dino__haiku__r0/Chromium.app");
});

test("the shared local app belongs to the newest local build that passed", () => {
  expect(
    chromiumAppPath({
      ...input,
      latestTarget: "local",
      latestLocalRunId: "dino__haiku__r0",
      localAppExists: true,
    }),
  ).toBe("/chromium/src/out/Default/Chromium.app");
  expect(
    chromiumAppPath({
      ...input,
      latestTarget: "local",
      latestLocalRunId: "other",
      localAppExists: true,
      remoteAppExists: true,
    }),
  ).toBe("/builds/dino__haiku__r0/Chromium.app");
});

test("the newer passed build wins when both apps are on disk", () => {
  expect(
    chromiumAppPath({
      ...input,
      latestTarget: "remote",
      latestLocalRunId: "dino__haiku__r0",
      remoteAppExists: true,
      localAppExists: true,
    }),
  ).toBe("/builds/dino__haiku__r0/Chromium.app");
  expect(
    chromiumAppPath({
      ...input,
      latestTarget: "local",
      latestLocalRunId: "dino__haiku__r0",
      remoteAppExists: true,
      localAppExists: true,
    }),
  ).toBe("/chromium/src/out/Default/Chromium.app");
});

test("a missing copy falls back to the local app this run still owns", () => {
  expect(
    chromiumAppPath({
      ...input,
      latestTarget: "remote",
      latestLocalRunId: "dino__haiku__r0",
      localAppExists: true,
    }),
  ).toBe("/chromium/src/out/Default/Chromium.app");
  expect(chromiumAppPath(input)).toBeNull();
});
