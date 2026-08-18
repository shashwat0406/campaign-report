import { getOneXtelData } from "@/lib/sheet";
import Dashboard from "@/app/components/Dashboard";

export const revalidate = 300;

export default async function Page() {
  const data = await getOneXtelData();
  return <Dashboard data={data} />;
}
