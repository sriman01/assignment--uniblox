export interface PasswordHasherPort {
  hash(password: string): string;
  verify(password: string, passwordHash: string): boolean;
}
