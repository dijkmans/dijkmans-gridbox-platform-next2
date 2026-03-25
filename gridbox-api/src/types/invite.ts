export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";

export type MembershipRole = "platformAdmin" | "customerAdmin" | "viewer";

export type InviteScope = {
  siteIds?: string[];
  boxIds?: string[];
  permissions?: string[];
};

export type InviteRecord = {
  id: string;
  email: string;
  displayName?: string;
  customerId: string;
  role: MembershipRole;
  scope: InviteScope;
  createdByAuthUid: string;
  tokenHash: string;
  expiresAt: FirebaseFirestore.Timestamp;
  status: InviteStatus;
  createdAt: FirebaseFirestore.Timestamp;
  acceptedAt?: FirebaseFirestore.Timestamp;
  acceptedByAuthUid?: string;
  phoneNumber?: string;
  phoneVerified?: boolean;
};

export type MembershipRecord = {
  id: string;
  authUid: string;
  email: string;
  displayName?: string;
  phoneNumber: string;
  phoneVerified: boolean;
  customerId: string;
  role: MembershipRole;
  scope: InviteScope;
  active: boolean;
  invitedByAuthUid: string;
  inviteId: string;
  createdAt: FirebaseFirestore.Timestamp;
  activatedAt: FirebaseFirestore.Timestamp;
};

export type CreateInviteInput = {
  email: string;
  displayName?: string;
  customerId: string;
  role: MembershipRole;
  scope?: InviteScope;
};

export type ValidateInviteInput = {
  token: string;
};

export type AcceptInviteInput = {
  token: string;
  displayName?: string;
  phoneNumber: string;
};
