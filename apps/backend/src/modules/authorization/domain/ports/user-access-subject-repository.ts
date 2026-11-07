export interface UserAccessSubjectRepository {
  lockForUpdate(
    userId: string,
  ): Promise<{ id: string; status: 'ACTIVE' | 'INACTIVE' | 'PENDING_ACTIVATION' } | null>;
}
