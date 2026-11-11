export interface AuthUser {
  readonly sub: string;
  readonly name?: string;
  readonly email?: string;
  readonly picture?: string;
  readonly nickname?: string;
}

export interface AuthSessionData {
  readonly user: AuthUser;
  readonly accessToken?: string;
}

export interface AuthContextValue {
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly user: AuthUser | null;
  readonly login: () => Promise<void>;
  readonly logout: () => void;
  readonly setSession: (session: AuthSessionData | null) => void;
  readonly isConfigured: boolean;
  readonly error: string | null;
}
