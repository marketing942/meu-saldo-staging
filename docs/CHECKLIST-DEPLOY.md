# Checklist de deploy

Use antes de cada publicação. Os passos detalhados estão no [README](../README.md#deploy-passo-a-passo).

## 1. Código

- [ ] CI verde na branch: `app` (lint, formatação, tipos, testes, build), `banco` (pgTAP e tipos em dia) e `e2e` (Playwright e acessibilidade).
- [ ] Localmente, se quiser conferir: `npm run lint && npm run typecheck && npm test && npm run test:e2e`.
- [ ] `src/config/marca.ts`: nome do app e `emailContato` (aparece nos Termos e na Política de privacidade) preenchidos.
- [ ] Textos de Termos de uso e Política de privacidade revisados por quem responde pelo app.

## 2. Supabase (em cada projeto: staging e produção)

- [ ] Migrations aplicadas (`npx supabase db push`) e tabelas com "RLS enabled".
- [ ] Edge Function publicada: `npx supabase functions deploy excluir-conta --project-ref <ref>`.
- [ ] Authentication › Email habilitado; senha mínima de 6 caracteres.
- [ ] Authentication › URL Configuration: _Site URL_ e _Redirect URLs_ com o domínio do ambiente e `/**`
      (cobre a confirmação de cadastro e a recuperação de senha em `/nova-senha`).
- [ ] **Produção:** "Confirm email" ligado e SMTP próprio configurado. Sem SMTP próprio, o Supabase só
      envia e-mails para membros do time, e cadastro e recuperação de senha não funcionam para usuários reais.
- [ ] **Staging:** se não houver SMTP, deixe "Confirm email" desligado para conseguir testar o cadastro.

## 3. Vercel

- [ ] Variáveis por ambiente: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon ou publishable, **nunca** service_role) e `VITE_APP_AMBIENTE` (`producao` em Production, `staging` em Preview).
- [ ] Depois de mudar variáveis: **Redeploy** (elas entram no build).
- [ ] _Production Branch_ correta em Settings › Git (padrão: `main`).
- [ ] Domínio próprio (se houver) adicionado e também cadastrado no Supabase de produção.
- [ ] Uso do plano dentro do limite (no Hobby, estourar a cota pausa a conta inteira).

## 4. Depois de publicar (teste manual, 5 minutos)

- [ ] Abrir o endereço: carrega a tela Entrar (se aparecer "não está configurado", revise as variáveis).
- [ ] Criar conta → primeiro acesso → Início com "Olá, nome".
- [ ] Lançar um gasto no Pix, uma receita e uma compra parcelada no cartão; conferir saldo, Gastos (e Receitas) e a fatura.
- [ ] Conferir o limite do cartão (usado e disponível) no Início, na tela do cartão e no formulário de gasto; marcar a fatura como paga e ver o limite voltar.
- [ ] Cadastrar uma conta a pagar e marcar a parcela do mês como paga.
- [ ] Definir a previsão de desnecessários em Metas; ver o progresso lá e o alerta no Início.
- [ ] Recarregar a página (a sessão continua) e Sair.
- [ ] "Esqueci minha senha": o e-mail chega e o link abre `/nova-senha`.
- [ ] Em staging: Configurações › Dados de exemplo › Carregar e depois Limpar.
- [ ] (Opcional) Excluir uma conta de teste em Configurações › Excluir minha conta.
