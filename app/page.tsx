import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthShell } from "@/app/ui";

export default async function Home() {
  const [user, userCount] = await Promise.all([getCurrentUser(), prisma.user.count()]);

  if (userCount === 0) return <AuthShell mode="setup" />;
  if (!user) return <AuthShell mode="login" />;

  redirect("/dashboard");
}
