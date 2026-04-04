import type { AdminBoxItem, AdminRoleItem } from "./types";

export function getBoxLabel(box: AdminBoxItem) {
  const id = box.boxId || box.id;
  const site = box.siteId || "geen-site";
  return `${id} (${site})`;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function formatDate(value?: string | null | { _seconds: number; _nanoseconds: number }) {
  if (!value) return "-";
  if (typeof value === "object" && "_seconds" in value) {
    return new Date(value._seconds * 1000).toLocaleString("nl-BE");
  }
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("nl-BE");
}

export function getRoleLabel(roleId: string | undefined, roles: AdminRoleItem[]) {
  if (!roleId) return "-";
  return roles.find((role) => role.id === roleId)?.label || roleId;
}
