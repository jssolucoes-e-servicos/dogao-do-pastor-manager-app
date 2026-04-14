import { type AuthUser } from './auth';

// Roles que chegam em uppercase no array (o backend também inclui os IDs, filtramos)
const hasRole = (user: AuthUser, ...roles: string[]) =>
  roles.some((r) => user.roles.includes(r.toUpperCase()));

export function getProfile(user: AuthUser) {
  const isAdmin      = hasRole(user, 'T.I', 'ADMINISTRAÇÃO');
  const isFinance    = hasRole(user, 'FINANCEIRO');
  const isManager    = hasRole(user, 'RECEPÇÃO', 'EXPEDIÇÃO', 'BALCÃO', 'FINALIZAÇÃO', 'PRODUÇÃO');
  const isSupervisor = hasRole(user, 'SUPERVISOR DE REDE') || (user.cellNetworks ?? []).length > 0;
  const isLeader     = hasRole(user, 'LÍDER DE CÉLULA') || (user.cells ?? []).length > 0;
  // vendedor direto OU membro de célula com seller vinculado
  const isSeller     = hasRole(user, 'VENDEDOR')
    || (user.sellers ?? []).length > 0
    || (user.cellsMember ?? []).length > 0;

  const canSeeRevenue      = isAdmin || isFinance;
  const canSeeGlobalStats  = isAdmin || isFinance || isManager;
  const canSeeNetworkStats = isSupervisor || canSeeGlobalStats;
  const canSeeCellStats    = isLeader || canSeeNetworkStats;
  const canSeeRanking      = isLeader || isSupervisor || canSeeGlobalStats;

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
    defaultSellerTag: (user.sellers ?? [])[0] ? undefined : 'igrejaviva',
  };
}

export type UserProfile = ReturnType<typeof getProfile>;
