export type ActiveSection =
  | "dashboard"
  | "provisioning"
  | "customers"
  | "sites"
  | "boxes"
  | "invites"
  | "memberships"
  | "roles"
  | "logs";

export type NavigationItem = {
  id: ActiveSection;
  label: string;
};

export type ProvisioningStepContent = {
  title: string;
  text: string;
};

export type CustomerItem = {
  id: string;
  name?: string;
  active?: boolean;
  createdAt?: string;
  addedBy?: string;
};

export type MembershipItem = {
  id: string;
  email?: string;
  customerId?: string;
  role?: string;
};

export type InviteItem = {
  id: string;
  email?: string;
  customerId?: string;
  role?: string;
  status?: string;
  createdAt?: string;
};

export type CustomerBoxAccessItem = {
  id: string;
  customerId?: string;
  boxId?: string;
  active?: boolean;
  createdAt?: string;
  addedBy?: string;
};

export type AdminBoxItem = {
  id: string;
  boxId?: string;
  siteId?: string | null;
  customerId?: string | null;
  updatedAt?: string | null;
};

export type AdminCameraData = {
  config?: {
    enabled?: boolean | null;
    username?: string | null;
    password?: string | null;
    snapshotIntervalSeconds?: number | null;
    changeDetectionThreshold?: number | null;
    postCloseSnapshotDurationSeconds?: number | null;
    saveCooldownSeconds?: number | null;
    forceSaveThresholdMultiplier?: number | null;
  } | null;
  assignment?: {
    mac?: string | null;
    ip?: string | null;
    snapshotUrl?: string | null;
    updatedAt?: string | null;
  } | null;
  observed?: {
    detectedMac?: string | null;
    detectedIp?: string | null;
    lastSeenAt?: string | null;
  } | null;
};

export type AdminBoxHardware = {
  camera?: AdminCameraData | null;
  rut?: {
    config?: {
      ip?: string | null;
      username?: string | null;
      password?: string | null;
      model?: string | null;
    } | null;
    observed?: {
      ip?: string | null;
      mac?: string | null;
      serial?: string | null;
      lastSeenAt?: string | null;
    } | null;
  } | null;
  pi?: {
    ip?: string | null;
    mac?: string | null;
    serial?: string | null;
  } | null;
  piConnect?: {
    deviceId?: string | null;
  } | null;
  lighting?: {
    lightOffDelaySeconds?: number | null;
    onWhenOpen?: boolean | null;
  } | null;
  shutter?: {
    closeDurationSeconds?: number | null;
    openDurationSeconds?: number | null;
  } | null;
  detectedDevices?: Array<{ mac: string; ip: string; seenAt?: string }> | null;
};

export type AdminSiteItem = {
  id: string;
  customerId?: string | null;
  name?: string | null;
  city?: string | null;
  address?: string | null;
  postalCode?: string | null;
  country?: string | null;
  active?: boolean;
};

export type AdminRoleItem = {
  id: string;
  label: string;
  active?: boolean;
  assignableInAdmin?: boolean;
};

export type AdminProvisioningStatus =
  | "draft"
  | "awaiting_first_boot"
  | "claimed"
  | "online"
  | "ready"
  | "failed";

export type AdminProvisioningItem = {
  id: string;
  customerId?: string | null;
  siteId?: string | null;
  boxId?: string | null;
  status?: AdminProvisioningStatus | string;
  createdAt?: string | null;
  updatedAt?: string | null;
  claimedAt?: string | null;
  claimedByDevice?: string | null;
  lastHeartbeatAt?: string | null;
  finalizedAt?: string | null;
  finalizedBy?: string | null;
  lastError?: string | null;
};
