# Mesa Viva — VTT para RPG de mesa online

Plataforma privada de mesa virtual (VTT) para grupos de RPG, com arquitetura
preparada para uso público no futuro. Esta entrega cobre a **Fase 1** do
roadmap: autenticação, perfis, dashboard, campanhas, membros e convites.

> "Mesa Viva" é um nome de trabalho — troque em `app/layout.tsx`,
> `package.json` e `README.md` se quiser outro.

## Stack

- Next.js 16.3.4 (App Router) + React 19.2.8 + TypeScript 5.9
- Tailwind CSS (tema dark, identidade própria — ver `app/globals.css`)
- Supabase (Auth + Postgres + Row Level Security). Storage/Realtime entram
  na Fase 2/3.
- PixiJS entra na Fase 2 (mesa/canvas) — ainda não instalado nesta entrega.

## Por que só a Fase 1?

O briefing pede explicitamente para **não construir tudo de uma vez** e
avançar fase por fase, validando cada uma. Esta entrega contém:

- estrutura de projeto e organização de pastas pensada para crescer
  (`features/`, `lib/`, `game/` chegam nas próximas fases);
- schema SQL completo da Fase 1 com Row Level Security;
- cadastro com confirmação de e-mail, login, logout e recuperação de senha;
- perfil editável com tratamento atômico de username duplicado;
- dashboard com "Minhas campanhas", criação de campanha e entrada por
  convite;
- tipos TypeScript para as entidades da Fase 1.

Nada aqui é placeholder decorativo: cada botão executa uma ação real contra
o Supabase.

## Setup

1. Crie um projeto em https://supabase.com (grátis) e copie a URL e a
   `publishable key`.
2. Rode o SQL de `supabase/schema.sql` no editor SQL do Supabase — ele cria
   as tabelas, RLS e triggers da Fase 1.
3. Copie `.env.local.example` para `.env.local` e preencha:

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ```

4. Instale as dependências e rode localmente:

   ```
   npm install
   npm run dev
   ```

5. Em **Authentication > URL Configuration**, configure a URL do site e
   adicione `http://localhost:3000/auth/confirm` e
   `http://localhost:3000/reset-password` às URLs de redirecionamento.
6. Valide com `npm run typecheck`, `npm run lint` e `npm run build`.

O lockfile fixa as versões verificadas em setembro de 2026. A chave legada
`NEXT_PUBLIC_SUPABASE_ANON_KEY` continua aceita pelo código para migração.

## Estrutura de pastas

```
app/                    rotas (App Router)
  (auth)/login          tela de login
  (auth)/signup         tela de cadastro
  dashboard/            dashboard pós-login
  campaigns/new/        criação de campanha
  invite/[code]/        tela pública de convite
components/ui/          primitivos visuais (Button, Input, Card, Field)
lib/supabase/           clientes Supabase (browser, server, middleware)
types/                  tipos das entidades do banco
supabase/schema.sql     baseline SQL + RLS/RPCs seguras da Fase 1
```

Nas próximas fases: `game/` (engine PixiJS, objetos, interação, realtime,
fog, grid), `features/` (sheet builder, assets, áudio), `stores/` (estado
local do VTT).

## O que NÃO está nesta fase (de propósito)

Scenes, canvas PixiJS, upload de assets, tokens, permissões de mesa, sheet
builder, fog of war, áudio via YouTube, chat e dados — tudo isso é Fase 2
em diante, conforme o roadmap. Peça para eu seguir para a Fase 2 quando
tiver validado esta parte.

## Roadmap (visão geral)

1. **Fase 1 (esta entrega)** — auth, perfis, dashboard, campanhas, convites
2. Fase 2 — Scenes, canvas PixiJS, upload de mapa, biblioteca de assets
3. Fase 3 — props, tokens, mover/redimensionar/rotacionar, layers, realtime
4. Fase 4 — permissões de mesa, locking, GM only
5. Fase 5 — personagens, sheet builder, sheet schema/data
6. Fase 6 — Fog of War, grid, desenho básico
7. Fase 7 — YouTube/áudio sincronizado com volume local
8. Fase 8 — chat, dados, iniciativa
