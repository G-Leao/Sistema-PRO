# Pro Vendas — Arquitetura e preparação para SaaS

> Estado: frontend em JavaScript puro, persistência em LocalStorage. **Nenhum backend, API ou autenticação existe ainda.**
> Tudo abaixo marcado como "futuro" é contrato conceitual, não implementação.

## 1. Camadas (hoje)

| Camada | Arquivos | Responsabilidade |
|---|---|---|
| Interface | `js/ui/*`, `index.html`, `css/` | Renderização, eventos (`data-acao`), sem regra de negócio |
| Estado | `js/core/state.js` | Dados em memória, migração, `State.executar()` (snapshot → mutação → persistência → rollback) |
| Regras | `js/services/*` | Validação, cálculo, estoque, métricas. Assíncronas; devolvem `{ok,data}` / `{ok:false,error}` |
| Persistência | `js/core/store.js` | Única porta de acesso a dados (`Store`, adaptador `AdaptadorLocalStorage`) |

Regras de dependência: UI → serviços/estado; serviços → estado; estado → Store. Nenhum arquivo fora de `store.js` acessa `localStorage` (exceção documentada: script de tema no `<head>`).

## 2. Chaves do LocalStorage (preservadas)
`vendas`, `vendedores`, `produtos`, `config`, `meta` (legada, só leitura), mais `pro_tema` (preferência do dispositivo) e `pro_backup_pre_v2` (cópia bruta criada antes da 1ª migração; restaurar = regravar cada chave a partir de `dados`). JSON corrompido é copiado para `<chave>__corrompido_<timestamp>` antes de qualquer regravação.

## 3. Como trocar LocalStorage por API REST
1. Implementar um adaptador com a mesma interface assíncrona de `Store` (`carregar*`, `guardar*`, `escutarAlteracoesExternas`) e registrá-lo com `Store.usarAdaptador()`.
2. Substituir, serviço a serviço, a mutação local por chamadas de operação (`registrar`, `anular`, `revalidar`…). O servidor passa a ser a fonte da verdade: estoque, totais e comissões são recalculados **no backend**; o cliente apenas exibe a resposta.
3. `State.executar()` deixa de fazer snapshot/persistência e passa a recarregar o recurso afetado.
4. Telas não mudam: já consomem apenas serviços assíncronos e o envelope padrão.

## 4. Formato padrão (futuro, já usado nos serviços)
```
Sucesso: { "ok": true,  "data": { ... }, "meta": { "pagina": 1, "total": 120 } }
Erro:    { "ok": false, "error": { "code": "estoque_insuficiente", "message": "...", "fields": { "cantidad": "..." } } }
```
Códigos usados hoje: `validacao`, `nao_encontrado`, `estado_invalido`, `estoque_insuficiente`, `persistencia`, `erro_interno`. Estados de carregamento: `idle | loading | success | error` por recurso (a definir na UI quando houver latência real). HTTP sugerido: 400/422 validação, 401 não autenticado, 403 sem permissão, 404 inexistente (também para recurso de outra empresa), 409 conflito (estoque), 5xx erro.

## 5. Contratos conceituais por domínio (a definir no backend)
Autenticação (login, refresh, logout, recuperação de senha) · Usuários · Empresas · Vendedores · Produtos · Vendas (criar, editar, anular, revalidar, excluir) · Metas (empresa e por vendedor) · Comissões · Relatórios (faturamento por período, ranking, formas de pagamento) · Configurações da empresa. Nenhum endpoint está implementado nem simulado neste projeto.

## 6. Multiempresa (futuro)
- **Empresa**: id, nome, dados cadastrais, configurações, plano, situação da conta.
- **Usuário**: id, nome, e-mail, empresa, perfil (Proprietário, Administrador, Gerente, Vendedor), situação.
- Toda entidade comercial (produtos, vendas, vendedores, metas, configurações) carrega `empresaId`.
- **Isolamento é responsabilidade do backend e do banco** (filtro obrigatório por empresa derivado do token, nunca de parâmetro do cliente; preferencialmente Row-Level Security). Esconder dados no frontend não é segurança. `State.contexto` (`empresaId`, `usuarioId`) é só um ponto de encaixe, hoje nulo.
- Permissões por perfil: apenas documentadas; implementar no backend.

## 7. Segurança e integridade
Corrigido no frontend: XSS por `onclick` com ids interpolados (agora `data-*` + delegação), URLs de imagem restritas a http(s)/data:image, `Utils.esc` corrigido (o valor 0 sumia), limites de tamanho/valor, persistência com rollback. **O backend deve revalidar tudo** (tipos, limites, desconto ≤ bruto, estoque, estado da venda) e executar venda + estoque em uma transação.
Auditoria: `State.aoMudar(fn)` recebe `{entidade, acao, id, em}` a cada alteração confirmada — ponto de partida para trilha de auditoria (quem/quando/antes/depois no servidor).

## 8. Pendências para o backend
- Exclusão de vendedor apaga suas vendas (comportamento original preservado) → preferir inativar e usar exclusão lógica (soft delete) para vendas e produtos.
- IDs gerados no cliente (`Utils.id`) → UUID/ID do servidor.
- Datas sem fuso (`YYYY-MM-DDTHH:mm` local) → timestamps UTC + fuso da empresa.
- Valores em `number` (reais) → centavos inteiros ou `DECIMAL`.
- Paginação, busca e filtros do histórico hoje em memória → server-side.
- Concorrência entre dispositivos (versão/ETag) e idempotência na criação de vendas.
- Identificadores de código misturam espanhol/português (`ServicioVentas`, `fecha`…): mantidos por compatibilidade com os dados salvos; renomear junto com a migração de modelo.
