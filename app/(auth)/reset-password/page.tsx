"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage(){const router=useRouter();const [password,setPassword]=useState("");const [error,setError]=useState<string|null>(null);const [loading,setLoading]=useState(false);
async function submit(e:React.FormEvent){e.preventDefault();setLoading(true);const {error}=await createClient().auth.updateUser({password});setLoading(false);if(error){setError("O link expirou ou a senha não pôde ser alterada.");return;}router.replace("/dashboard");router.refresh();}
return <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6"><h1 className="text-3xl">Criar nova senha</h1><form onSubmit={submit} className="mt-8 space-y-4"><Input label="Nova senha" type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/>{error&&<p className="text-sm text-danger">{error}</p>}<Button className="w-full" disabled={loading}>{loading?"Salvando…":"Salvar senha"}</Button></form></main>}
