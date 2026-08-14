export function isAdmin(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer && process.env.INGEST_ADMIN_TOKEN && bearer === process.env.INGEST_ADMIN_TOKEN) return true;
  const email = request.headers.get("cf-access-authenticated-user-email") ?? request.headers.get("oai-authenticated-user-email");
  if (!email) return process.env.NODE_ENV === "development" && request.headers.get("x-demo-admin") === "true";
  const allowlist = (process.env.ADMIN_EMAILS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}
