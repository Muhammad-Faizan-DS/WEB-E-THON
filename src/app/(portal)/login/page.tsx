import { redirect } from "next/navigation";
import { SignInPanel } from "@/components/backend-preview/sign-in";
import { currentUser, roleHome } from "@/components/dashboard/guard";

export const metadata = { title: "Sign in · SecureExam" };

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect(roleHome(user.role));
  return <SignInPanel showDemoAccounts={process.env.NODE_ENV !== "production"} />;
}
