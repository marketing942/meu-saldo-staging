# Finanças

App de organização financeira pessoal: gastos e receitas do mês, cartões (faturas e limite), contas a pagar, previsão de desnecessários e projetos. É mobile-first, instalável (PWA) e em português do Brasil (R$, datas dd/mm/aaaa, fuso America/Sao_Paulo).

> "Finanças" é um nome provisório. Para trocar, veja [Trocar o nome do app](#trocar-o-nome-do-app).

## Stack

| Camada         | Tecnologia                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------- |
| Front-end      | React 18, Vite, TypeScript (strict), React Router 7, Tailwind CSS 4 (tokens em variáveis CSS) |
| Dados e estado | TanStack Query (servidor), Zustand (interface: mês selecionado, ocultar valores, tema)        |
| Formulários    | react-hook-form + zod                                                                         |
| Datas          | date-fns (pt-BR), com datas como texto `AAAA-MM-DD` e meses como `AAAA-MM`                    |
| Back-end       | Supabase: Auth (e-mail e senha), Postgres com RLS, funções RPC e Edge Function                |
| PWA            | vite-plugin-pwa (instalável, sem modo offline nesta versão)                                   |
| Qualidade      | ESLint, Prettier, Vitest, pgTAP, Playwright, GitHub Actions                                   |
| Deploy         | Vercel (front) + Supabase (back), com staging e produção                                      |
| Erros          | Sentry (opcional, via variável de ambiente). Sem rastreadores de terceiros.                   |

## Requisitos

- Node.js 22 (`.nvmrc`)
- Para os testes do banco: Docker, `psql` e `pg_prove`
  (Ubuntu: `sudo apt-get install postgresql-client libtap-parser-sourcehandler-pgtap-perl`)

## Rodando localmente

```bash
npm ci
cp .env.example .env.local   # preencha com as chaves do projeto de STAGING
npm run dev                  # http://localhost:5173
```

Sem as variáveis de ambiente, o app abre uma tela explicando o que falta.

### Scripts

| Comando                           | O que faz                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Servidor de desenvolvimento                                                                        |
| `npm run build`                   | Checa os tipos e gera o build de produção em `dist/`                                               |
| `npm run preview`                 | Serve o build em http://localhost:4173                                                             |
| `npm run lint`                    | ESLint (inclui acessibilidade e a proibição de `new Date('AAAA-MM-DD')`)                           |
| `npm run format` / `format:check` | Prettier                                                                                           |
| `npm run typecheck`               | TypeScript sem gerar arquivos                                                                      |
| `npm test`                        | Vitest: funções puras (datas, dinheiro e regras financeiras)                                       |
| `npm run test:e2e`                | Playwright: jornadas completas e acessibilidade (axe), com um Supabase falso em memória            |
| `npm run test:db`                 | Sobe um Postgres do Supabase no Docker, aplica as migrations e roda os testes pgTAP (RLS e regras) |
| `npm run gen:types`               | Regenera `src/types/database.ts` a partir das migrations (`supabase gen types`)                    |
| `npm run gen:pwa-assets`          | Regenera os ícones do PWA a partir de `public/icone.svg`                                           |
| `npm run check:ptbr`              | Procura nos textos da interface palavras comuns sem acento (`-- --listar` mostra todos os textos)  |

## Estrutura

```
src/
  app/            roteador, layouts (abas, cabeçalho) e telas de erro
  components/ui/  componentes base: Botao, Card, Campo, Pilula, Alerta, EstadoVazio, EstadoErro...
  config/         marca (nome do app em um só lugar)
  lib/            supabase, react-query, ambiente, monitoramento, datas, dinheiro
  lib/regras/     regras financeiras puras (espelham as funções SQL), com testes
  pages/          telas
  stores/         estado de interface (Zustand)
  styles/         tokens de cor, fontes e base do Tailwind
  types/          tipos gerados do banco (não editar à mão)
e2e/              testes Playwright e o Supabase falso usado por eles
supabase/
  migrations/     schema, RLS, gatilhos e RPCs
  functions/      Edge Function excluir-conta (Deno)
  tests/          testes pgTAP (RLS com dois usuários e regras financeiras)
scripts/          testes do banco, geração de tipos e checagem de português (check-ptbr)
```

As regras financeiras existem em dois lugares com os mesmos casos de teste: funções puras em `src/lib/regras` (Vitest) e funções SQL em `supabase/migrations` (pgTAP). Detalhes e decisões de modelagem estão em [`supabase/README.md`](supabase/README.md).

Nomes na tela e no código: o que a interface chama de **Contas a pagar** (rota `/contas-a-pagar`) é a tabela `dividas`; a **Carteira** é a tabela `contas`; a **Previsão de desnecessários** é a coluna `profiles.meta_desnecessario_centavos`. Os nomes internos ficam sem acento; os textos de tela, não.

## Ambientes

| Ambiente | Front                                            | Supabase            | `VITE_APP_AMBIENTE` |
| -------- | ------------------------------------------------ | ------------------- | ------------------- |
| Local    | `npm run dev`                                    | projeto de staging  | `local`             |
| Staging  | Preview deployments da Vercel (toda branch e PR) | projeto de staging  | `staging`           |
| Produção | Production deployment da Vercel (branch `main`)  | projeto de produção | `producao`          |

"Carregar/Limpar dados de exemplo" (Configurações) só aparece fora de produção.

### Variáveis de ambiente

| Variável                 | Obrigatória | Descrição                                                                         |
| ------------------------ | ----------- | --------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | sim         | URL do projeto (Project Settings > API)                                           |
| `VITE_SUPABASE_ANON_KEY` | sim         | Chave pública anon/publishable. É segura no front, porque o RLS protege os dados. |
| `VITE_APP_AMBIENTE`      | sim         | `local`, `staging` ou `producao`                                                  |
| `VITE_SENTRY_DSN`        | não         | Liga o monitoramento de erros com Sentry                                          |

> A chave `service_role` **nunca** vai para o front-end nem para variáveis `VITE_`. Ela só é usada pela Edge Function de excluir conta, como segredo do próprio Supabase.

## Deploy passo a passo

### 1. Criar os dois projetos no Supabase

1. Em [supabase.com/dashboard](https://supabase.com/dashboard), crie **dois** projetos: `financas-staging` e `financas-producao`.
2. Use a região **South America (São Paulo)** e uma senha de banco forte (guarde num gerenciador de senhas).
3. Em cada projeto, anote em **Project Settings > API** o _Project URL_, a chave _anon/publishable_ e o _Reference ID_.

### 2. Rodar as migrations

```bash
npx supabase login

# Staging
npx supabase link --project-ref <ref-do-staging>
npx supabase db push

# Produção
npx supabase link --project-ref <ref-da-producao>
npx supabase db push
```

Confira em **Table Editor** que as tabelas aparecem com o selo "RLS enabled". Se quiser conferir antes, rode os testes do banco localmente com `npm run test:db`.

### 2.1 Publicar a Edge Function de excluir conta

"Excluir minha conta" (Configurações) chama a Edge Function `supabase/functions/excluir-conta`. Ela usa a chave `service_role`, que o Supabase injeta sozinho no ambiente das funções (não é preciso cadastrar segredo). Em cada projeto:

```bash
npx supabase functions deploy excluir-conta --project-ref <ref>
```

Sem a função publicada, o restante do app funciona normalmente; só a exclusão de conta mostra "Não foi possível excluir a conta agora".

### 3. Configurar a autenticação (em cada projeto)

Em **Authentication**:

1. **Sign In / Providers > Email**: habilitado. **Confirm email**: **ligado em produção** (em staging é opcional). **Minimum password length**: 6.
2. **URL Configuration**:
   - _Site URL_: o endereço principal do ambiente (produção: `https://seu-dominio.com.br`; staging: o domínio de staging da Vercel).
   - _Redirect URLs_: adicione
     - produção: `https://seu-dominio.com.br/**`
     - staging: `https://<projeto>-git-<branch>-<time>.vercel.app/**` ou, para todos os previews, `https://*-<time>.vercel.app/**`
     - local (só no staging): `http://localhost:5173/**`
   - O `/**` cobre os links de confirmação de cadastro (voltam para `/`) e de recuperação de senha (voltam para `/nova-senha`).
3. **Rate Limits**: mantenha os limites padrão.
4. **SMTP** (produção): configure um SMTP próprio (Resend, Amazon SES, Postmark...). O envio padrão do Supabase só entrega e-mails para membros do time e tem limite muito baixo, o que impede cadastro e recuperação de senha de usuários reais.

### 4. Conectar o repositório na Vercel

1. Em [vercel.com/new](https://vercel.com/new), importe este repositório. O framework é detectado como **Vite**, e o `vercel.json` já define instalação, build e saída.
2. Em **Settings > Environment Variables**, cadastre as variáveis por ambiente:

   | Variável                 | Production        | Preview          | Development      |
   | ------------------------ | ----------------- | ---------------- | ---------------- |
   | `VITE_SUPABASE_URL`      | URL de produção   | URL de staging   | URL de staging   |
   | `VITE_SUPABASE_ANON_KEY` | chave de produção | chave de staging | chave de staging |
   | `VITE_APP_AMBIENTE`      | `producao`        | `staging`        | `local`          |
   | `VITE_SENTRY_DSN`        | opcional          | opcional         | —                |

   Assim, os Preview deployments apontam para o Supabase de staging.

3. Em **Settings > Git**, confirme que a _Production Branch_ é `main`.

### 5. Primeiro deploy

1. Faça push na `main` (ou clique em **Deploy**). Cada branch e PR gera um preview apontando para staging.
2. Abra o endereço e confira que o app carrega. Se aparecer "não está configurado", revise as variáveis e faça **Redeploy**.
3. Em **Settings > Domains**, adicione o domínio próprio e atualize a _Site URL_ e as _Redirect URLs_ do Supabase de produção.

### 6. Segurança e cabeçalhos

O `vercel.json` aplica rewrite de SPA para `/index.html` e estes cabeçalhos: `Content-Security-Policy` (libera só o próprio domínio, `*.supabase.co` e, se usado, o Sentry), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` e `Strict-Transport-Security`. As fontes são servidas pelo próprio domínio, sem Google Fonts.

Se usar um domínio próprio no Supabase (custom domain) ou um Sentry fora de `*.ingest.(us|de).sentry.io`, acrescente o endereço em `connect-src` no `vercel.json`.

## CI

O workflow `.github/workflows/ci.yml` roda em todo push e PR:

- **app**: lint, formatação, tipos, testes unitários e build;
- **e2e**: Playwright com as jornadas principais (cadastro, primeiro acesso, gastos e receitas, cartões, faturas e limite, contas a pagar, previsão de desnecessários, projetos, configurações, excluir conta) e checagem de acessibilidade com axe nos temas claro e escuro. Usa um Supabase falso em memória, sem rede nem segredos;
- **banco**: aplica as migrations num Postgres do Supabase, roda os testes pgTAP (RLS com dois usuários e regras financeiras) e confere se `src/types/database.ts` está em dia com as migrations.

## Trocar o nome do app

1. Altere `src/config/marca.ts` (nome, descrição e cores do PWA).
2. Se quiser outro ícone, troque `public/icone.svg` e rode `npm run gen:pwa-assets`.

## Privacidade

Sem rastreadores nem analytics de terceiros. O Sentry é opcional e configurado para não enviar dados do usuário, cookies, cabeçalhos, corpos de requisição nem parâmetros de URL.

## Roteiro de entrega

1. Migrations SQL, RLS, gatilhos, RPCs e teste de RLS
2. Projeto base: Vite, TypeScript, Tailwind, tokens e fontes, rotas, cliente Supabase tipado, `vercel.json`, CI e README
3. Autenticação, termos e privacidade, onboarding, navegação por mês e tela Início
4. Gastos, categorias, cartões, faturas e formulário de gasto
5. Contas a pagar
6. Metas, alertas, lembrete e Configurações (inclui excluir conta)
7. Testes ponta a ponta (Playwright), acessibilidade, dados de exemplo e checklist de deploy
8. "Dívidas" virou "Contas a pagar"; a meta de receita saiu e Metas ficou com a previsão de desnecessários e os projetos; receitas na aba Gastos; limite do cartão por lançamento (`limite_cartao`); revisão de português

Todas as fases estão concluídas. Antes de publicar, siga o [checklist de deploy](docs/CHECKLIST-DEPLOY.md).

O que ficou de fora desta versão (decisões conscientes): modo offline, notificação push do lembrete diário (o lembrete aparece no Início), exportação de dados e gráficos de análise.
