import crypto from "crypto";

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function buildInviteUrl(baseUrl: string, token: string): string {
  const normalized = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalized}/activate-invite?token=${encodeURIComponent(token)}`;
}
