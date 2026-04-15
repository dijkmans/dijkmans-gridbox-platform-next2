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
  "SD-kaart klaarleggen",
  "Imager instellingen",
  "Opstartbestanden",
  "Eerste opstart",
  "Live controle"
];

export const provisioningStepContent: ProvisioningStepContent[] = [
  {
    title: "Nieuwe box voorbereiden",
    text:
      "Hier hoort straks de eerste stap van de wizard te komen. Box ID, klant en site moeten hier bewust gekozen worden. Niet terug naar losse locatievelden op boxniveau."
  },
  {
    title: "Installatievoorbereiding aanmaken",
    text:
      "Deze stap moet later een backend-call worden die een provisioningrecord en beperkte bootstrapinfo aanmaakt. Niet in de frontend zelf verzinnen."
  },
  {
    title: "SD-kaart klaarleggen",
    text:
      "Wout moet hier maar één fysieke taak tegelijk zien. Geen technische chaos, gewoon duidelijke checkstappen."
  },
  {
    title: "Imager instellingen",
    text:
      "Hostname, gebruiker, wachtwoord, SSH en OS-keuze moeten zichtbaar op het scherm staan. Niets uit het hoofd laten onthouden."
  },
  {
    title: "Opstartbestanden",
    text:
      "De richting blijft beperkt bootstrapmateriaal. Geen brede secrets als standaard op de SD-kaart."
  },
  {
    title: "Eerste opstart",
    text:
      "Deze stap moet later live tonen wanneer de Pi zichzelf claimt en voor het eerst online komt."
  },
  {
    title: "Live controle",
    text:
      "Pas wanneer backend en device dit echt bevestigen, mag een installatie als klaar getoond worden."
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
