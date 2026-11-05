import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { userStatusSchema } from '@sigoa/shared';
import { UsersPage, type UsersSearchParams } from '@/features/users';

const usersSearchSchema = z.object({
  status: userStatusSchema.optional(),
  roleId: z.string().optional(),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  pageSize: z.coerce.number().int().min(1).catch(20).default(20),
});

export const Route = createFileRoute('/_app/usuarios/')({
  validateSearch: (search: Record<string, unknown>): UsersSearchParams => {
    return usersSearchSchema.parse(search);
  },
  component: UsersRouteComponent,
});

function UsersRouteComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const handleSearchChange = (newSearch: Partial<UsersSearchParams>) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        ...newSearch,
      }),
    });
  };

  return <UsersPage search={search} onSearchChange={handleSearchChange} />;
}
