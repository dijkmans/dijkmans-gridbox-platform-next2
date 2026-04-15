import { getFirestore } from "firebase-admin/firestore";

export type PlatformBrandingRecord = {
  gridboxLogoPath?: string;
  gridboxFooterLogoPath?: string;
  footerText?: string;
};

export async function getPlatformBranding(): Promise<PlatformBrandingRecord | null> {
  const db = getFirestore();

  const doc = await db.collection("platformConfig").doc("branding").get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data() as Record<string, any>;

  return {
    gridboxLogoPath: typeof data.gridboxLogoPath === "string" ? data.gridboxLogoPath : undefined,
    gridboxFooterLogoPath: typeof data.gridboxFooterLogoPath === "string" ? data.gridboxFooterLogoPath : undefined,
    footerText: typeof data.footerText === "string" ? data.footerText : undefined
  };
}
