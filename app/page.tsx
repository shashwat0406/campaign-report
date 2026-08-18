import { getSheetData } from "@/lib/sheet";
import Workspace from "@/app/components/Workspace";

export const revalidate = 300;

export default async function Page() {
  const data = await getSheetData();
  return <Workspace data={data} />;
}
