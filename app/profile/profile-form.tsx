"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function ProfileForm({profile}:{profile:{username:string;display_name:string;avatar_url:string|null}}){const router=useRouter();const [username,setUsername]=useState(profile.username);const [displayName,setDisplayName]=useState(profile.display_name);const [avatarUrl,setAvatarUrl]=useState(profile.avatar_url??"");const [message,setMessage]=useState<string|null>(null);const [loading,setLoading]=useState(false);
async function submit(e:React.FormEvent){e.preventDefault();setLoading(true);setMessage(null);const {error}=await createClient().rpc("update_my_profile",{new_username:username,new_display_name:displayName,new_avatar_url:avatarUrl||null});setLoading(false);if(error){setMessage(error.message.includes("username_taken")||error.code==="23505"?"Este nome de usuário já está em uso.":"Não foi possível salvar o perfil.");return;}setMessage("Perfil salvo.");router.refresh();}
return <form onSubmit={submit} className="mt-8 space-y-4"><Input label="Nome de exibição" required value={displayName} onChange={e=>setDisplayName(e.target.value)}/><Input label="Nome de usuário" pattern="[a-z0-9_]{3,20}" required value={username} onChange={e=>setUsername(e.target.value.toLowerCase())}/><Input label="URL do avatar" type="url" value={avatarUrl} onChange={e=>setAvatarUrl(e.target.value)}/>{message&&<p className="text-sm text-ink-muted">{message}</p>}<Button disabled={loading}>{loading?"Salvando…":"Salvar perfil"}</Button></form>}
