// Compatibility names for feature consumers; lib/storage owns the persisted model.
export type {
  Hit as HitLog,
  UserRecord as UserData,
  UserProfile,
  UserSettings,
  GameSettings,
  Store,
} from './lib/storage/model';
