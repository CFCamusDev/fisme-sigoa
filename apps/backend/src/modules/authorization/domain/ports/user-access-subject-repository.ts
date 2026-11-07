export interface UserAccessSubjectRepository {
  findById(
    userId: string,
  ): Promise<{ id: string; status: 'ACTIVE' | 'INACTIVE' | 'PENDING_ACTIVATION' } | null>;
  lockForUpdate(
    userId: string,
  ): Promise<{ id: string; status: 'ACTIVE' | 'INACTIVE' | 'PENDING_ACTIVATION' } | null>;
}
