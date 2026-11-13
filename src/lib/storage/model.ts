export type Hit = {
  id: string;
  at: number;
  [key: string]: unknown;
};

export type GameSettings = {
  forkInTheRoadEnabled?: boolean;
  cardDropEnabled?: boolean;
  [key: string]: unknown;
};

export type UserSettings = {
  timezone?: string;
  theme?: string;
  darkMode?: 'light' | 'dark';
  games?: GameSettings;
  [key: string]: unknown;
};

export type UserProfile = {
  email?: string;
  [key: string]: unknown;
};

export type UserRecord = {
  username: string;
  registeredAt: number;
  hits: Hit[];
  profile?: UserProfile;
  settings?: UserSettings;
  cardCollections?: Record<string, number>;
  unknown?: unknown;
  importBackups?: unknown[];
  [key: string]: unknown;
};

export type Store = {
  schemaVersion: 2;
  users: Record<string, UserRecord>;
  unknown?: Record<string, unknown>;
};
