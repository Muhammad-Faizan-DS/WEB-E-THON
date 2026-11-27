import { redirect } from "next/navigation";
import { SignInPanel } from "@/components/backend-preview/sign-in";
import { currentUser, roleHome } from "@/components/dashboard/guard";
import { readOrgSettings } from "@/server/accounts";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect(roleHome(user.role));
  const institution = await readOrgSettings().then((settings) => settings.name).catch(() => "SecureExam");
  // Demo shortcuts show in development, or on a deployment where SHOW_DEMO_ACCOUNTS=1 (e.g. the judged demo).
  const showDemoAccounts = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS === "1";
  return <SignInPanel showDemoAccounts={showDemoAccounts} institution={institution} />;
}
