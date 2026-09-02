"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AccountMenu() {
  const router = useRouter();
  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className="flex gap-3">
      <Link href="/profile" className="btn-secondary">Perfil</Link>
      <button type="button" onClick={logout} className="btn-secondary">Sair</button>
    </div>
  );
}
