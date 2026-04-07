import type {
  ActiveSection,
  AdminBoxItem,
  AdminRoleItem,
  CustomerBoxAccessItem,
  CustomerItem,
  InviteItem,
  MembershipItem,
  NavigationItem,
  ProvisioningStepContent
} from "./types";
import { getRoleLabel } from "./helpers";

export type SiteSummary = {
  siteId: string;
  boxCount: number;
  customerIds: Set<string>;
};

export type CustomerSummary = {
  id: string;
  name?: string;
  active?: boolean;
  memberCount: number;
  accessCount: number;
};

export const navigationItems: NavigationItem[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "provisioning", label: "Installatiecockpit" },
  { id: "customers", label: "Klanten" },
  { id: "sites", label: "Sites" },
  { id: "boxes", label: "Boxen" },
  { id: "invites", label: "Uitnodigingen" },
  { id: "memberships", label: "Gebruikerstoegang" },
  { id: "roles", label: "Rollen en rechten" },
  { id: "logs", label: "Provisioning logs" }
];

export const provisioningSteps: string[] = [
  "Nieuwe box voorbereiden",
  "Installatievoorbereiding aanmaken",
  "SD-kaart flashen",
  "Opstartbestanden",
  "Eerste opstart",
  "Live controle",
  "Installatie voltooid"
];

export const provisioningStepContent: ProvisioningStepContent[] = [
  {
    title: "Nieuwe box voorbereiden",
    text: "Kies de klant, de locatie (site) en geef de nieuwe box een ID."
  },
  {
    title: "Installatievoorbereiding aanmaken",
    text: "Het systeem maakt een uniek installatierecord aan met een beveiligde bootstrap-sleutel."
  },
  {
    title: "SD-kaart flashen",
    text: "Het script flasht het master image en schrijft automatisch de bootstrap-bestanden."
  },
  {
    title: "Opstartbestanden",
    text: "Controleer of de kaart bij de juiste box hoort. Het script heeft de bestanden automatisch geplaatst."
  },
  {
    title: "Eerste opstart",
    text: "Steek de SD-kaart in de Pi en sluit de stroom aan. Wacht 2–3 minuten op de eerste registratie."
  },
  {
    title: "Live controle",
    text: "Pas wanneer backend en device dit bevestigen, mag de installatie als klaar getoond worden."
  },
  {
    title: "Installatie voltooid",
    text: "De box is online en actief. De installatie is succesvol afgerond."
  }
];

export function getPendingInvites(invites: InviteItem[]) {
  return invites.filter((invite) => invite.status === "pending");
}

export function getCustomerSummaries(
  customers: CustomerItem[],
  memberships: MembershipItem[],
  customerBoxAccess: CustomerBoxAccessItem[]
): CustomerSummary[] {
  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    active: customer.active,
    memberCount: memberships.filter((membership) => membership.customerId === customer.id).length,
    accessCount: customerBoxAccess.filter((access) => access.customerId === customer.id).length
  }));
}

export function getSiteSummaries(boxes: AdminBoxItem[]): SiteSummary[] {
  const siteSummaryMap = new Map<string, SiteSummary>();

  boxes.forEach((box) => {
    const siteId = box.siteId || "geen-site";
    const existing = siteSummaryMap.get(siteId) || {
      siteId,
      boxCount: 0,
      customerIds: new Set<string>()
    };

    existing.boxCount += 1;
    if (box.customerId) {
      existing.customerIds.add(box.customerId);
    }

    siteSummaryMap.set(siteId, existing);
  });

  return Array.from(siteSummaryMap.values()).sort((a, b) =>
    a.siteId.localeCompare(b.siteId)
  );
}

export function getAdminRoleLabel(roleId: string | undefined, inviteRoles: AdminRoleItem[]) {
  return getRoleLabel(roleId, inviteRoles);
}

export function getActiveCustomersCount(customers: CustomerItem[]) {
  return customers.filter((customer) => customer.active !== false).length;
}

export function getActiveAccessCount(customerBoxAccess: CustomerBoxAccessItem[]) {
  return customerBoxAccess.filter((access) => access.active !== false).length;
}

export function getCustomerMembers(
  memberships: MembershipItem[],
  selectedCustomerId: string | null
) {
  return memberships.filter((member) => member.customerId === selectedCustomerId);
}

export function getCustomerInvites(
  invites: InviteItem[],
  selectedCustomerId: string | null
) {
  return invites.filter(
    (invite) => invite.customerId === selectedCustomerId && invite.status === "pending"
  );
}

export function getCustomerAccess(
  customerBoxAccess: CustomerBoxAccessItem[],
  selectedCustomerId: string | null
) {
  return customerBoxAccess.filter((access) => access.customerId === selectedCustomerId);
}

export function getSelectedCustomer(
  customers: CustomerItem[],
  selectedCustomerId: string | null
) {
  return customers.find((customer) => customer.id === selectedCustomerId);
}
