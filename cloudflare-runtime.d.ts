declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}

interface Fetcher { fetch(input: Request | string, init?: RequestInit): Promise<Response>; }
interface D1PreparedStatement { bind(...values: unknown[]): D1PreparedStatement; all<T = unknown>(): Promise<{ results: T[]; success: boolean }>; first<T = unknown>(): Promise<T | null>; run(): Promise<unknown>; }
interface D1Database { prepare(sql: string): D1PreparedStatement; batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]>; }
