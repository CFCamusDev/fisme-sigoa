export const authorizationKeys = {
  roles: {
    all: ['roles'] as const,
  },
  permissions: {
    all: ['permissions'] as const,
  },
  userAccess: {
    all: ['userAccess'] as const,
    detail: (userId: string) => ['userAccess', userId] as const,
  },
  mePermissions: {
    all: ['me', 'permissions'] as const,
    byUser: (userId: string) => ['me', 'permissions', userId] as const,
  },
};
