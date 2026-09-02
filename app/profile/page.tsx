import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const {data:profile,error}=await supabase.from("profiles").select("username,display_name,avatar_url").eq("id",user.id).single();if(error||!profile)notFound();return <main className="mx-auto max-w-lg px-6 py-12"><Link href="/dashboard" className="text-sm text-arcane">← Dashboard</Link><h1 className="mt-6 text-3xl">Seu perfil</h1><ProfileForm profile={profile}/></main>}
