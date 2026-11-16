-- ADR 0007: accepted plain PostgreSQL schema design, 2026-11-16.
-- Apply through the API migration runner; document acceptance does not apply DDL.
-- Argon2id hashing and UUID generation are in the API; no extensions required.
-- Runner uses one transaction + advisory migration lock + checksum ledger.
-- IF NOT EXISTS supports exact initial-schema restart, not schema upgrades.

create table if not exists accounts (
  id uuid primary key,
  logical_id uuid not null unique,
  handle text collate "C" not null unique,
  password_hash text not null,
  schema_version integer not null check (schema_version > 0),
  version bigint not null check (version > 0),
  created_ms bigint not null,
  updated_ms bigint not null,
  registered_ms bigint not null,
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  settings jsonb not null check (jsonb_typeof(settings) = 'object'),
  extensions jsonb not null,
  account_extensions jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_handle_valid check (
    handle ~ '^[a-z][a-z0-9_]{2,31}$'
    and handle not in ('admin','administrator','root','support','system',
      'auth','api','local','cloud','postgres')
  ),
  constraint logical_uuid_v4 check (
    logical_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  constraint profile_unverified check (
    coalesce(profile ->> 'emailVerification' = 'unverified', false)
  )
);

create table if not exists run_chunks (
  account_id uuid not null references accounts(id),
  partition text collate "C" not null
    check (partition ~ '^yn?[0-9]{4,}-m(0[1-9]|1[0-2])$'),
  seq bigint not null check (seq > 0),
  hits jsonb not null check (jsonb_typeof(hits) = 'array'),
  hit_count integer generated always as (jsonb_array_length(hits)) stored,
  bytes bigint not null check (bytes between 1 and 1000000),
  sha256 bytea not null check (octet_length(sha256) = 32),
  codec text not null check (codec = 'run-json-1'),
  schema_version integer not null check (schema_version > 0),
  version bigint not null check (version > 0),
  created_ms bigint not null,
  updated_ms bigint not null,
  primary key (account_id, partition, seq),
  check (hit_count between 1 and 5000)
);

create table if not exists account_plugins (
  account_id uuid not null references accounts(id),
  plugin_id text not null check (plugin_id ~ '^[a-z][a-z0-9-]{0,31}$'),
  payload jsonb not null,
  schema_version integer not null check (schema_version > 0),
  version bigint not null check (version > 0),
  created_ms bigint not null,
  updated_ms bigint not null,
  primary key (account_id, plugin_id)
);

create table if not exists account_imports (
  account_id uuid not null references accounts(id),
  import_id text not null check (import_id ~ '^i-[0-9]{8,}$'),
  payload jsonb not null,
  source_digest bytea not null check (octet_length(source_digest) = 32),
  schema_version integer not null check (schema_version > 0),
  version bigint not null check (version > 0),
  created_ms bigint not null,
  updated_ms bigint not null,
  primary key (account_id, import_id),
  unique (account_id, source_digest)
);

create table if not exists account_revision (
  account_id uuid primary key references accounts(id),
  revision bigint not null check (revision >= 0),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  manifest_digest bytea not null check (octet_length(manifest_digest) = 32),
  run_index jsonb not null check (jsonb_typeof(run_index) = 'object'),
  device_id uuid not null,
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key,
  account_id uuid not null references accounts(id),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  device_label text not null check (char_length(device_label) <= 100),
  revoked_at timestamptz,
  check (expires_at <= absolute_expires_at)
);

create table if not exists recovery_codes (
  id uuid primary key,
  account_id uuid not null references accounts(id),
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create unique index if not exists recovery_one_unused_per_account
  on recovery_codes(account_id) where used_at is null;

create table if not exists rate_limits (
  scope text not null check (scope in ('ip','handle','account')),
  subject_hash bytea not null check (octet_length(subject_hash) = 32),
  action text not null,
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0),
  expires_at timestamptz not null,
  primary key (scope, subject_hash, action, window_start)
);

create table if not exists operation_log (
  account_id uuid not null references accounts(id),
  operation_id uuid not null,
  kind text not null,
  request_digest bytea not null check (octet_length(request_digest) = 32),
  base_revision bigint not null check (base_revision >= 0),
  result_revision bigint check (result_revision >= 0),
  phase text not null check (phase in ('prepared','publishing',
    'committed-unverified','verified','confirmed','cancelled','failed','committed')),
  changed_partitions jsonb not null default '[]'::jsonb,
  changed_modules jsonb not null default '[]'::jsonb,
  gate_report jsonb,
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, operation_id)
);

-- PK/UNIQUE indexes already cover handle, logical id, chunk range,
-- plugin/import lookup, revision lookup, token hash and operation idempotency.
create index if not exists sessions_account_active
  on sessions(account_id, expires_at) where revoked_at is null;
create index if not exists sessions_expiry on sessions(expires_at);
create index if not exists rate_limits_expiry on rate_limits(expires_at);
create index if not exists operation_log_revision
  on operation_log(account_id, result_revision) where result_revision is not null;
