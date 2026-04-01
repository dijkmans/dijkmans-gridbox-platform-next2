import type { AdminBoxItem, AdminRoleItem } from "./types";

export function getBoxLabel(box: AdminBoxItem) {
  const id = box.boxId || box.id;
  const site = box.siteId || "geen-site";
  return `${id} (${site})`;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("nl-BE");
}

export function getRoleLabel(roleId: string | undefined, roles: AdminRoleItem[]) {
  if (!roleId) return "-";
  return roles.find((role) => role.id === roleId)?.label || roleId;
}
