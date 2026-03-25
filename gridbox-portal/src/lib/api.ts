const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
