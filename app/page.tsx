import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { AuthShell } from "@/app/ui";

export default async function Home() {
  const [user, userCount, t] = await Promise.all([getCurrentUser(), prisma.user.count(), getTranslator()]);

  if (userCount === 0) return <AuthShell mode="setup" t={t} />;
  if (!user) return <AuthShell mode="login" t={t} />;

  redirect("/dashboard");
}
