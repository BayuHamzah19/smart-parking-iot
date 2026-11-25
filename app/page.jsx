import { redirect } from "next/navigation";
import { isAdmin } from "../lib/auth";
import Dashboard from "../components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isAdmin())) redirect("/login");
  return <Dashboard />;
}
