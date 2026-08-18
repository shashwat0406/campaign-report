"use server";

import { revalidatePath } from "next/cache";

// Busts the ISR cache for the dashboard so the next render re-reads the sheet.
export async function refreshData() {
  revalidatePath("/");
}
