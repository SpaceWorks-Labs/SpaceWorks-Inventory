import { isIP } from "node:net";

/**
 * Webhook targets must be public internet addresses so a space manager cannot
 * point the server at its own private network (SSRF). Development and
 * trusted LANs can opt out with ALLOW_PRIVATE_WEBHOOK_TARGETS=true.
 */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number) as [number, number];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (version === 6) {
    // URL canonicalization also converts dotted IPv4 tails to hexadecimal.
    // Expand before classifying so alternate spellings cannot hide loopback,
    // mapped IPv4, unique-local or link-local addresses from the check.
    const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
    const halves = canonical.split("::");
    const left = halves[0] ? halves[0].split(":") : [];
    const right = halves[1] ? halves[1].split(":") : [];
    const words = [...left, ...Array(8 - left.length - right.length).fill("0"), ...right].map((word) => parseInt(word, 16));
    if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
      return isPrivateAddress(`${words[6]! >>> 8}.${words[6]! & 255}.${words[7]! >>> 8}.${words[7]! & 255}`);
    }
    // Only global unicast is routable for outbound webhooks. This excludes
    // unspecified/loopback, local scopes and translation-only address ranges.
    if ((words[0]! & 0xe000) !== 0x2000) return true;
    // 6to4 embeds the destination IPv4 in its next two words.
    if (words[0] === 0x2002) return isPrivateAddress(`${words[1]! >>> 8}.${words[1]! & 255}.${words[2]! >>> 8}.${words[2]! & 255}`);
    return false;
  }
  return true;
}

export function privateTargetsAllowed(env: Record<string, string | undefined> = process.env) {
  return env.ALLOW_PRIVATE_WEBHOOK_TARGETS === "true";
}

/** Syntax check for the endpoint form: https only in production, no credentials in the URL. */
export function webhookUrlProblem(raw: string, env: Record<string, string | undefined> = process.env): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Enter a full URL starting with https://.";
  }
  if (url.username || url.password) return "Remove the username and password from the URL.";
  const httpAllowed = env.NODE_ENV !== "production" || privateTargetsAllowed(env);
  if (url.protocol !== "https:" && !(httpAllowed && url.protocol === "http:")) return "Use an https:// URL.";
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!privateTargetsAllowed(env) && (host === "localhost" || host.endsWith(".localhost") || (isIP(host) && isPrivateAddress(host)))) {
    return "Webhooks can only reach public addresses.";
  }
  return null;
}
