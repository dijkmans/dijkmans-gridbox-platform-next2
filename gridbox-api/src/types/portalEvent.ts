export type PortalEventSeverity = "info" | "warning" | "error";

export interface PortalEvent {
  id: string;
  type: string;
  timestamp: string;
  label: string;
  severity: PortalEventSeverity;
}
