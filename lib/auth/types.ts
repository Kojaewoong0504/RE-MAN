export type AuthUser = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  provider: "google";
};

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  sessionStateToken: string;
};
