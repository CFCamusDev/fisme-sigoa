export interface LogoutCommand {
  refreshToken: string;
  userId: string;
  ip?: string | null;
}
