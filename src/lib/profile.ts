import type { IAuthUser } from '@/interfaces';

/**
 * Verifica se o usuário tem alguma das roles informadas.
 * Faz matching case-insensitive e sem acentos para ser robusto
 * independente de como o perfil foi cadastrado no banco.
 */
function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function hasRole(user: IAuthUser, ...roles: string[]) {
  const normalizedRoles = roles.map(normalize);
  return user.roles.some(r => normalizedRoles.includes(normalize(r)));
}

/**
 * Derivar o perfil do usuário a partir de:
 * 1. Vínculos estruturais (sellers, cells, cellNetworks, cellsMember) — fonte primária
 * 2. Roles dinâmicas do banco — complemento
 *
 * Isso garante que funciona independente do nome do perfil cadastrado.
 */
export function getProfile(user: IAuthUser) {
  // ── Vínculos estruturais ──────────────────────────────────────────────
  const hasSellers     = (user.sellers ?? []).length > 0;
  const hasCells       = (user.cells ?? []).length > 0;       // é líder de célula
  const hasNetworks    = (user.cellNetworks ?? []).length > 0; // é supervisor de rede
  const hasCellMember  = (user.cellsMember ?? []).length > 0;  // é membro de célula

  // ── Roles dinâmicas (fallback) ────────────────────────────────────────
  // Aceita qualquer variação: "Administração", "ADMIN", "T.I", "IT", etc.
  const isAdmin = hasRole(user,
    'IT', 'T.I', 'TI', 'ADMIN', 'ADMINISTRACAO', 'ADMINISTRAÇÃO', 'ADMINISTRADOR'
  );
  const isFinance = hasRole(user,
    'FINANCE', 'FINANCEIRO', 'FINANCEIRA', 'TESOUREIRO', 'TESOUREIRA'
  );
  const isManager = hasRole(user,
    'RECEPTION', 'RECEPCAO', 'RECEPÇÃO', 'EXPEDITION', 'EXPEDICAO', 'EXPEDIÇÃO',
    'BALCAO', 'BALCÃO', 'PRODUCAO', 'PRODUÇÃO', 'KITCHEN', 'COZINHA'
  );

  // Supervisor: tem rede vinculada OU tem role de supervisor
  const isSupervisor = hasNetworks || hasRole(user,
    'MANAGER', 'SUPERVISOR', 'SUPERVISOR DE REDE', 'SUPERVISOR_DE_REDE'
  );

  // Líder: tem célula vinculada OU tem role de líder
  const isLeader = hasCells || hasRole(user,
    'LEADER', 'LIDER', 'LÍDER', 'LIDER DE CELULA', 'LÍDER DE CÉLULA'
  );

  // Vendedor: tem seller vinculado OU é membro de célula OU tem role de vendedor
  const isSeller = hasSellers || hasCellMember || hasRole(user,
    'SELLER', 'VENDEDOR', 'VENDEDORA'
  );

  // ── Permissões derivadas ──────────────────────────────────────────────
  const canSeeRevenue      = isAdmin || isFinance;
  const canSeeGlobalStats  = isAdmin || isFinance || isManager;
  const canSeeNetworkStats = isSupervisor || canSeeGlobalStats;
  const canSeeCellStats    = isLeader || canSeeNetworkStats;
  const canSeeRanking      = isLeader || isSupervisor || canSeeGlobalStats;

  // Pode ver acertos financeiros (próprios)
  const canSeeSettlement   = isSeller || isLeader || isSupervisor;

  // Pode confirmar acertos (tesoureira/financeiro)
  const canConfirmSettlement = isFinance || isAdmin;

  return {
    isAdmin,
    isFinance,
    isManager,
    isSupervisor,
    isLeader,
    isSeller,
    canSeeRevenue,
    canSeeGlobalStats,
    canSeeCellStats,
    canSeeNetworkStats,
    canSeeRanking,
    canSeeSettlement,
    canConfirmSettlement,
  };
}

export type UserProfile = ReturnType<typeof getProfile>;
