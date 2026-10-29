import { describe, expect, it } from "vitest";
import { isPrivateAddress, webhookUrlProblem } from "@/lib/events/network";

describe("webhook address isolation", () => {
  it.each([
    "127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254",
    "::", "::1", "0:0:0:0:0:0:0:1", "0:0:0:0:0:0:0:0", "::ffff:127.0.0.1",
    "::ffff:7f00:1", "0:0:0:0:0:ffff:a00:1", "::ffff:a9fe:a9fe",
    "fe80::1", "0:0:0:0:0:ffff:c0a8:101", "fc00::1", "ff02::1",
    "64:ff9b::a9fe:a9fe", "2002:7f00:1::", "invalid",
  ])("blocks non-public destination %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:808:808"])("allows public destination %s", (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });

  it.each(["https://[::ffff:127.0.0.1]/hook", "https://[::ffff:7f00:1]/hook", "https://[0:0:0:0:0:0:0:1]/hook"])("rejects canonicalized private endpoint %s", (url) => {
    expect(webhookUrlProblem(url, { NODE_ENV: "production" })).toBe("Webhooks can only reach public addresses.");
  });
});
