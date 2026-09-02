"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email,setEmail]=useState(""); const [sent,setSent]=useState(false); const [loading,setLoading]=useState(false);
  async function submit(e:React.FormEvent){e.preventDefault();setLoading(true);await createClient().auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/reset-password`});setLoading(false);setSent(true);}
  return <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6"><h1 className="text-3xl">Recuperar senha</h1>
    {sent?<><p className="mt-3 text-sm text-ink-muted">Se houver uma conta para esse e-mail, você receberá um link de recuperação.</p><Link href="/login" className="btn-primary mt-8 text-center">Voltar</Link></>:
    <form onSubmit={submit} className="mt-8 space-y-4"><Input label="E-mail" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/><Button className="w-full" disabled={loading}>{loading?"Enviando…":"Enviar link"}</Button></form>}
  </main>;
}
