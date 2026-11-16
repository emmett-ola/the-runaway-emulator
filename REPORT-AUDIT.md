# Dependency audit only — executor report for Soren

Generated 2026-11-16T06:53:27.800Z. This is execution evidence, **not independent acceptance, a release approval, or a claim that all vulnerabilities are fixed**.

## Scope, candidate and repository state

- Packet: `.git/audit-only-packet.md`; canceled release packet was not used.
- Workspace: `/Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a`.
- Clean baseline: `305cd009e43ff3242474b7e2145f1a955c0425d1`, branch `storage-v2`. Baseline porcelain and remotes output were both empty; child exits 0.
- Dependency candidate SHA: **`2f57b1fd7776ca85cd2a09f875002dde3b107601`**. Local commit subject: `chore: apply non-breaking dependency security updates`. Author and committer: Emmett <emmett@initialize.in>. Only `package.json` and `package-lock.json` were committed.
- Candidate status readback after that commit: empty porcelain, exit 0. There are no configured remotes.
- This report is committed separately to avoid a circular candidate SHA. Its final HEAD/branch/porcelain/remotes are read after the report commit and returned in the executor closeout; they cannot be embedded in the commit that defines that HEAD.
- Application/package version remains **1.2.0**. Original lock top-level and root package versions remain **1.0.0** as explicitly requested; no version synchronization or release bump.
- No tracked application source, tests, locales, release notes, specifications, catalog, CI, or other existing reports were modified. No main merge, push, deploy, force audit fix, broad override, global config edit, or credential inspection.
- Node v22.23.2, npm 10.9.8. All timestamps below are UTC.
- Evidence and helper scripts are local and ignored under `node_modules/.cache/audit-only-evidence/`, a newly created directory. They are not in either commit. Complete audit JSON, separate stdout/stderr, and child-exit metadata are retained there.

## Audit results and actual npm metadata

Counts below are npm audit affected-package aggregates, not counts of unique advisories or demonstrated exploits.

| Snapshot | Low | Moderate | High | Critical | Total |
| --- | --- | --- | --- | --- | --- |
| Baseline | 3 | 8 | 20 | 2 | 33 |
| Immediately after npm audit fix (no force) | 2 | 11 | 0 | 2 | 15 |
| Final frozen candidate | 2 | 10 | 0 | 0 | 12 |

| Snapshot | prod | dev | optional | peer | peerOptional | total |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline | 16 | 611 | 49 | 7 | 0 | 626 |
| After first fix | 16 | 588 | 53 | 8 | 0 | 603 |
| Final | 16 | 588 | 53 | 8 | 0 | 603 |

Baseline, immediate post-fix, and final `npm audit --json` each returned **1 because advisories remain**; these are audit findings, not failed final gates. `npm audit fix` also returned 1 while applying fixes. Its raw summary was: added 10, removed 37, changed 181, audited 554 installed packages. Lockfile package-location counts differ from installed counts because platform-optional records are retained.

### Non-breaking remediation and npm resolver incident

1. Captured baseline manifests/lock and full baseline audit before mutation.
2. Ran exactly `npm audit fix`, never `--force`. It updated the router, Vite, PWA/Workbox and many transitive security packages within existing direct ranges, but left Vitest at 4.0.15 with critical findings.
3. `npm update vitest @vitest/ui` returned 0 but left the 15 findings unchanged. Registry metadata verified matching Vitest/UI 4.1.12 and Node 22 compatibility.
4. Non-breaking explicit installation of existing dependencies `vitest@^4.1.12` and `@vitest/ui@^4.1.12` failed in npm 10.9.8 with `Cannot read properties of null (reading 'edgesOut')`. The same internal error occurred with plain install, lock-only install, and strict-peer lock resolution. No application compatibility/source error was reported. These failures are preserved, not suppressed.
5. Raised only those two existing manifest ranges to ^4.1.12, then `npm install --package-lock-only --legacy-peer-deps` worked around the npm resolver failure, exit 0. A subsequent **normal `npm install` with no legacy flag** succeeded, exit 0, changed 23 installed packages, and normalized the final graph. Full `npm ls --all` then returned 0. The internal failure's root cause was not established. No legacy configuration was persisted; no arbitrary direct dependency was introduced; no force or broad override was used.
6. npm temporarily rewrote the lock top/root versions to 1.2.0. Restored both metadata fields to the captured baseline 1.0.0 before freeze; application package version never changed.
7. Final audit: 12 affected packages, no high/critical entries. Freeze at 2026-11-16T06:44:15.898Z; all four full gates ran once after freeze, with no subsequent dependency/source changes or gate reruns.

## Manifest and direct dependency inventory

Only the `vitest` and `@vitest/ui` devDependency ranges changed (^4.0.15 → ^4.1.12). No direct packages were added or removed. React/react-dom remain 19.2.0; TypeScript remains 5.9.3; eslint remains 9.39.1. No direct major change was taken.

| Package | Manifest section | Old range | Final range | Old locked | Final locked |
| --- | --- | --- | --- | --- | --- |
| @eslint/js | development | ^9.39.1 | ^9.39.1 | 9.39.1 | 9.39.1 |
| @testing-library/jest-dom | development | ^6.9.1 | ^6.9.1 | 6.9.1 | 6.9.1 |
| @testing-library/react | development | ^16.3.0 | ^16.3.0 | 16.3.0 | 16.3.0 |
| @testing-library/user-event | development | ^14.6.1 | ^14.6.1 | 14.6.1 | 14.6.1 |
| @types/animejs | production | ^3.1.13 | ^3.1.13 | 3.1.13 | 3.1.13 |
| @types/crypto-js | development | ^4.2.2 | ^4.2.2 | 4.2.2 | 4.2.2 |
| @types/node | development | ^24.10.1 | ^24.10.1 | 24.10.1 | 24.10.1 |
| @types/react | development | ^19.2.5 | ^19.2.5 | 19.2.7 | 19.2.7 |
| @types/react-dom | development | ^19.2.3 | ^19.2.3 | 19.2.3 | 19.2.3 |
| @vitejs/plugin-react | development | ^5.1.1 | ^5.1.1 | 5.1.1 | 5.1.1 |
| @vitest/ui | development | ^4.0.15 | ^4.1.12 | 4.0.15 | 4.1.12 |
| animejs | production | ^4.2.2 | ^4.2.2 | 4.2.2 | 4.2.2 |
| crypto-js | production | ^4.2.0 | ^4.2.0 | 4.2.0 | 4.2.0 |
| eslint | development | ^9.39.1 | ^9.39.1 | 9.39.1 | 9.39.1 |
| eslint-plugin-react-hooks | development | ^7.0.1 | ^7.0.1 | 7.0.1 | 7.0.1 |
| eslint-plugin-react-refresh | development | ^0.4.24 | ^0.4.24 | 0.4.24 | 0.4.24 |
| fake-indexeddb | development | ^6.2.8 | ^6.2.8 | 6.2.8 | 6.2.8 |
| fflate | production | ^0.8.3 | ^0.8.3 | 0.8.3 | 0.8.3 |
| framer-motion | production | ^12.23.25 | ^12.23.25 | 12.23.25 | 12.23.25 |
| globals | development | ^16.5.0 | ^16.5.0 | 16.5.0 | 16.5.0 |
| jsdom | development | ^27.2.0 | ^27.2.0 | 27.2.0 | 27.2.0 |
| react | production | ^19.2.0 | ^19.2.0 | 19.2.0 | 19.2.0 |
| react-dom | production | ^19.2.0 | ^19.2.0 | 19.2.0 | 19.2.0 |
| react-router-dom | production | ^7.10.1 | ^7.10.1 | 7.10.1 | 7.18.5 |
| typescript | development | ~5.9.3 | ~5.9.3 | 5.9.3 | 5.9.3 |
| typescript-eslint | development | ^8.46.4 | ^8.46.4 | 8.48.0 | 8.48.0 |
| vite | development | ^7.2.4 | ^7.2.4 | 7.2.6 | 7.3.8 |
| vite-plugin-pwa | development | ^1.2.0 | ^1.2.0 | 1.2.0 | 1.3.0 |
| vitest | development | ^4.0.15 | ^4.1.12 | 4.0.15 | 4.1.12 |
| workbox-window | development | ^7.4.0 | ^7.4.0 | 7.4.0 | 7.4.1 |

### Preserved lock/root metadata

| Field | Baseline | Final |
| --- | --- | --- |
| package.json version | 1.2.0 | 1.2.0 |
| lockfileVersion | 3 | 3 |
| lock name | runawaylog | runawaylog |
| lock top version | 1.0.0 | 1.0.0 |
| lock requires | true | true |
| lock packages[empty].name | runawaylog | runawaylog |
| lock packages[empty].version | 1.0.0 | 1.0.0 |

Root dependency/devDependency ranges match the final manifest; only the two Vitest range changes above are intentional. The transient npm metadata normalization is documented, not retained.

## Every lock package version delta, addition and removal

Compared the captured clean baseline lock to the frozen candidate by exact `packages` location (including platform and nested transitive packages): **243 changed versions, 14 added locations, 37 removed locations**, plus 2 same-version metadata-only changes. A missing side means absent at that exact path; a relocation is therefore shown as removal/addition rather than hidden. Transitive major changes below come from compatible upstream direct-package updates, not forced direct majors.

| Lock package path | Old version | New version | Kind |
| --- | --- | --- | --- |
| node_modules/@babel/code-frame | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/compat-data | 7.28.5 | 7.29.7 | changed |
| node_modules/@babel/core | 7.28.5 | 7.29.13 | changed |
| node_modules/@babel/generator | 7.28.5 | 7.29.14 | changed |
| node_modules/@babel/helper-annotate-as-pure | 7.27.3 | 7.29.7 | changed |
| node_modules/@babel/helper-compilation-targets | 7.27.2 | 7.29.13 | changed |
| node_modules/@babel/helper-create-class-features-plugin | 7.28.5 | 7.29.13 | changed |
| node_modules/@babel/helper-create-regexp-features-plugin | 7.28.5 | 7.29.14 | changed |
| node_modules/@babel/helper-define-polyfill-provider | 0.6.5 | 0.6.8 | changed |
| node_modules/@babel/helper-globals | 7.28.0 | 7.29.7 | changed |
| node_modules/@babel/helper-member-expression-to-functions | 7.28.5 | 7.29.14 | changed |
| node_modules/@babel/helper-module-imports | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/helper-module-transforms | 7.28.3 | 7.29.14 | changed |
| node_modules/@babel/helper-optimise-call-expression | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/helper-plugin-utils | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/helper-remap-async-to-generator | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/helper-replace-supers | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/helper-skip-transparent-expression-wrappers | 7.27.1 | 7.29.13 | changed |
| node_modules/@babel/helper-string-parser | 7.27.1 | 7.29.14 | changed |
| node_modules/@babel/helper-validator-identifier | 7.28.5 | 7.29.7 | changed |
| node_modules/@babel/helper-validator-option | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/helper-wrap-function | 7.28.3 | 7.29.14 | changed |
| node_modules/@babel/helpers | 7.28.4 | 7.29.14 | changed |
| node_modules/@babel/parser | 7.28.5 | 7.29.14 | changed |
| node_modules/@babel/plugin-bugfix-firefox-class-in-computed-class-key | 7.28.5 | 7.29.7 | changed |
| node_modules/@babel/plugin-bugfix-safari-class-field-initializer-scope | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-bugfix-safari-id-destructuring-collision-in-function-expression | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-bugfix-safari-rest-destructuring-rhs-array | absent | 7.29.13 | added |
| node_modules/@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-bugfix-v8-static-class-fields-redefine-readonly | 7.28.3 | 7.29.7 | changed |
| node_modules/@babel/plugin-syntax-import-assertions | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-syntax-import-attributes | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-arrow-functions | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-async-generator-functions | 7.28.0 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-async-to-generator | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-block-scoped-functions | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-block-scoping | 7.28.5 | 7.29.13 | changed |
| node_modules/@babel/plugin-transform-class-properties | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-class-static-block | 7.28.3 | 7.29.14 | changed |
| node_modules/@babel/plugin-transform-classes | 7.28.4 | 7.29.11 | changed |
| node_modules/@babel/plugin-transform-computed-properties | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-destructuring | 7.28.5 | 7.29.13 | changed |
| node_modules/@babel/plugin-transform-dotall-regex | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-duplicate-keys | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-duplicate-named-capturing-groups-regex | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-dynamic-import | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-explicit-resource-management | 7.28.0 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-exponentiation-operator | 7.28.5 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-export-namespace-from | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-for-of | 7.27.1 | 7.29.13 | changed |
| node_modules/@babel/plugin-transform-function-name | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-json-strings | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-literals | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-logical-assignment-operators | 7.28.5 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-member-expression-literals | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-modules-amd | 7.27.1 | 7.29.14 | changed |
| node_modules/@babel/plugin-transform-modules-commonjs | 7.27.1 | 7.29.14 | changed |
| node_modules/@babel/plugin-transform-modules-systemjs | 7.28.5 | 7.29.8 | changed |
| node_modules/@babel/plugin-transform-modules-umd | 7.27.1 | 7.29.14 | changed |
| node_modules/@babel/plugin-transform-named-capturing-groups-regex | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-new-target | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-nullish-coalescing-operator | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-numeric-separator | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-object-rest-spread | 7.28.4 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-object-super | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-optional-catch-binding | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-optional-chaining | 7.28.5 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-parameters | 7.27.7 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-private-methods | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-private-property-in-object | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-property-literals | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-regenerator | 7.28.4 | 7.29.8 | changed |
| node_modules/@babel/plugin-transform-regexp-modifiers | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-reserved-words | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-shorthand-properties | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-spread | 7.27.1 | 7.29.11 | changed |
| node_modules/@babel/plugin-transform-sticky-regex | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-template-literals | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-typeof-symbol | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-unicode-escapes | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-unicode-property-regex | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-unicode-regex | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/plugin-transform-unicode-sets-regex | 7.27.1 | 7.29.7 | changed |
| node_modules/@babel/preset-env | 7.28.5 | 7.29.14 | changed |
| node_modules/@babel/template | 7.27.2 | 7.29.7 | changed |
| node_modules/@babel/traverse | 7.28.5 | 7.29.14 | changed |
| node_modules/@babel/types | 7.28.5 | 7.29.14 | changed |
| node_modules/@esbuild/aix-ppc64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/android-arm | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/android-arm64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/android-x64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/darwin-arm64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/darwin-x64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/freebsd-arm64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/freebsd-x64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/linux-arm | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/linux-arm64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/linux-ia32 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/linux-loong64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/linux-mips64el | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/linux-ppc64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/linux-riscv64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/linux-s390x | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/linux-x64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/netbsd-arm64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/netbsd-x64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/openbsd-arm64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/openbsd-x64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/openharmony-arm64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/sunos-x64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/win32-arm64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/win32-ia32 | 0.25.12 | 0.28.2 | changed |
| node_modules/@esbuild/win32-x64 | 0.25.12 | 0.28.2 | changed |
| node_modules/@humanfs/core | 0.19.1 | 0.19.2 | changed |
| node_modules/@humanfs/node | 0.16.7 | 0.16.8 | changed |
| node_modules/@humanfs/types | absent | 0.15.0 | added |
| node_modules/@isaacs/balanced-match | 4.0.1 | absent | removed |
| node_modules/@isaacs/brace-expansion | 5.0.0 | absent | removed |
| node_modules/@isaacs/cliui | 8.0.2 | 9.0.0 | changed |
| node_modules/@rollup/plugin-babel | absent | 6.1.0 | added |
| node_modules/@rollup/plugin-node-resolve | 15.3.1 | 16.0.3 | changed |
| node_modules/@rollup/plugin-replace | absent | 6.0.3 | added |
| node_modules/@rollup/plugin-terser | 0.4.4 | 1.0.2 | changed |
| node_modules/@rollup/pluginutils | 5.3.0 | 5.5.1 | changed |
| node_modules/@rollup/rollup-android-arm-eabi | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-android-arm64 | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-android-x64 | absent | 4.68.3 | added |
| node_modules/@rollup/rollup-darwin-arm64 | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-darwin-x64 | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-freebsd-arm64 | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-freebsd-x64 | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-linux-arm-gnueabihf | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-linux-arm-musleabihf | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-linux-arm64-gnu | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-linux-arm64-musl | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-linux-loong64-gnu | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-linux-loong64-musl | absent | 4.68.3 | added |
| node_modules/@rollup/rollup-linux-ppc64-gnu | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-linux-ppc64-musl | absent | 4.68.3 | added |
| node_modules/@rollup/rollup-linux-riscv64-gnu | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-linux-riscv64-musl | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-linux-s390x-gnu | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-linux-x64-gnu | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-linux-x64-musl | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-openbsd-x64 | absent | 4.68.3 | added |
| node_modules/@rollup/rollup-openharmony-arm64 | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-win32-arm64-msvc | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-win32-ia32-msvc | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-win32-x64-gnu | 4.53.3 | 4.68.3 | changed |
| node_modules/@rollup/rollup-win32-x64-msvc | 4.53.3 | 4.68.3 | changed |
| node_modules/@standard-schema/spec | 1.0.0 | 1.1.0 | changed |
| node_modules/@surma/rollup-plugin-off-main-thread | 2.2.3 | absent | removed |
| node_modules/@surma/rollup-plugin-off-main-thread/node_modules/magic-string | 0.25.9 | absent | removed |
| node_modules/@testing-library/dom | 10.4.1 | 10.4.2 | changed |
| node_modules/@trickfilm400/rollup-plugin-off-main-thread | absent | 3.0.0-pre1 | added |
| node_modules/@types/estree | 1.0.8 | 1.0.10 | changed |
| node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion | 2.0.2 | 2.1.8 | changed |
| node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch | 9.0.5 | 9.0.9 | changed |
| node_modules/@vitest/expect | 4.0.15 | 4.1.12 | changed |
| node_modules/@vitest/mocker | 4.0.15 | 4.1.12 | changed |
| node_modules/@vitest/pretty-format | 4.0.15 | 4.1.12 | changed |
| node_modules/@vitest/runner | 4.0.15 | 4.1.12 | changed |
| node_modules/@vitest/snapshot | 4.0.15 | 4.1.12 | changed |
| node_modules/@vitest/spy | 4.0.15 | 4.1.12 | changed |
| node_modules/@vitest/ui | 4.0.15 | 4.1.12 | changed |
| node_modules/@vitest/utils | 4.0.15 | 4.1.12 | changed |
| node_modules/ajv | 6.12.6 | 6.15.0 | changed |
| node_modules/babel-plugin-polyfill-corejs2 | 0.4.14 | 0.4.17 | changed |
| node_modules/babel-plugin-polyfill-corejs3 | 0.13.0 | 0.14.2 | changed |
| node_modules/babel-plugin-polyfill-regenerator | 0.6.5 | 0.6.8 | changed |
| node_modules/baseline-browser-mapping | 2.8.32 | 2.11.37 | changed |
| node_modules/brace-expansion | 1.1.12 | 1.1.22 | changed |
| node_modules/browserslist | 4.28.0 | 4.29.5 | changed |
| node_modules/call-bind | 1.0.8 | 1.0.9 | changed |
| node_modules/caniuse-lite | 1.0.30001757 | 1.0.30001826 | changed |
| node_modules/chai | 6.2.1 | 6.3.0 | changed |
| node_modules/core-js-compat | 3.47.0 | 3.51.0 | changed |
| node_modules/eastasianwidth | 0.2.0 | absent | removed |
| node_modules/electron-to-chromium | 1.5.262 | 1.5.486 | changed |
| node_modules/emoji-regex | 9.2.2 | absent | removed |
| node_modules/es-abstract | 1.24.0 | 1.24.2 | changed |
| node_modules/es-abstract-get | absent | 1.0.0 | added |
| node_modules/es-module-lexer | 1.7.0 | 2.3.2 | changed |
| node_modules/es-object-atoms | 1.1.1 | 1.1.2 | changed |
| node_modules/es-to-primitive | 1.3.0 | 1.3.4 | changed |
| node_modules/esbuild | 0.25.12 | 0.28.2 | changed |
| node_modules/eta | absent | 4.6.0 | added |
| node_modules/expect-type | 1.2.2 | 1.4.0 | changed |
| node_modules/fast-uri | 3.1.0 | 3.1.9 | changed |
| node_modules/filelist | 1.0.4 | 1.0.6 | changed |
| node_modules/filelist/node_modules/brace-expansion | 2.0.2 | 2.1.8 | changed |
| node_modules/filelist/node_modules/minimatch | 5.1.6 | 5.1.9 | changed |
| node_modules/flatted | 3.3.3 | 3.4.4 | changed |
| node_modules/function.prototype.name | 1.1.8 | 1.2.0 | changed |
| node_modules/glob/node_modules/balanced-match | absent | 4.0.4 | added |
| node_modules/glob/node_modules/brace-expansion | absent | 5.0.13 | added |
| node_modules/glob/node_modules/minimatch | 10.1.1 | 10.2.6 | changed |
| node_modules/graceful-fs | 4.2.11 | 4.2.12 | changed |
| node_modules/hasown | 2.0.2 | 2.0.4 | changed |
| node_modules/is-core-module | 2.16.1 | 2.18.0 | changed |
| node_modules/is-document.all | absent | 1.0.0 | added |
| node_modules/is-fullwidth-code-point | 3.0.0 | absent | removed |
| node_modules/jackspeak | 4.1.1 | 4.2.3 | changed |
| node_modules/js-yaml | 4.1.1 | 4.3.2 | changed |
| node_modules/json-schema | 0.4.0 | absent | removed |
| node_modules/jsonfile | 6.2.0 | 6.2.1 | changed |
| node_modules/lodash | 4.17.21 | absent | removed |
| node_modules/lodash.sortby | 4.7.0 | absent | removed |
| node_modules/minimatch | 3.1.2 | 3.1.5 | changed |
| node_modules/minipass | 7.1.2 | 7.1.3 | changed |
| node_modules/nanoid | 3.3.11 | 3.3.20 | changed |
| node_modules/node-releases | 2.0.27 | 2.0.64 | changed |
| node_modules/own-keys | 1.0.1 | 1.0.2 | changed |
| node_modules/path-scurry | 2.0.1 | 2.0.2 | changed |
| node_modules/path-scurry/node_modules/lru-cache | 11.2.4 | 11.5.3 | changed |
| node_modules/picomatch | 4.0.3 | 4.0.7 | changed |
| node_modules/postcss | 8.5.6 | 8.5.33 | changed |
| node_modules/randombytes | 2.1.0 | absent | removed |
| node_modules/react-router | 7.10.1 | 7.18.5 | changed |
| node_modules/react-router-dom | 7.10.1 | 7.18.5 | changed |
| node_modules/regenerate | 1.4.2 | 1.5.0 | changed |
| node_modules/regenerate-unicode-properties | 10.2.2 | 10.3.0 | changed |
| node_modules/regexpu-core | 6.4.0 | 6.5.4 | changed |
| node_modules/regjsparser | 0.13.0 | 0.14.1 | changed |
| node_modules/resolve | 1.22.11 | 1.22.14 | changed |
| node_modules/rollup | 4.53.3 | 4.68.3 | changed |
| node_modules/safe-array-concat | 1.1.3 | 1.1.4 | changed |
| node_modules/safe-buffer | 5.2.1 | absent | removed |
| node_modules/semver | 6.3.1 | 6.3.2 | changed |
| node_modules/serialize-javascript | 6.0.2 | 7.1.4 | changed |
| node_modules/set-cookie-parser | 2.7.2 | 2.7.3 | changed |
| node_modules/side-channel | 1.1.0 | 1.1.1 | changed |
| node_modules/side-channel-list | 1.0.0 | 1.0.1 | changed |
| node_modules/smob | 1.5.0 | 1.6.2 | changed |
| node_modules/source-map | 0.8.0-beta.0 | 0.8.0 | changed |
| node_modules/source-map-js | 1.2.1 | 1.2.2 | changed |
| node_modules/source-map/node_modules/tr46 | 1.0.1 | absent | removed |
| node_modules/source-map/node_modules/webidl-conversions | 4.0.2 | absent | removed |
| node_modules/source-map/node_modules/whatwg-url | 7.1.0 | absent | removed |
| node_modules/sourcemap-codec | 1.4.8 | absent | removed |
| node_modules/std-env | 3.10.0 | 4.3.0 | changed |
| node_modules/string-width | 5.1.2 | absent | removed |
| node_modules/string-width-cjs | 4.2.3 | absent | removed |
| node_modules/string-width-cjs/node_modules/emoji-regex | 8.0.0 | absent | removed |
| node_modules/string-width-cjs/node_modules/strip-ansi | 6.0.1 | absent | removed |
| node_modules/string.prototype.matchall | 4.0.12 | 4.1.0 | changed |
| node_modules/string.prototype.trim | 1.2.10 | 1.2.11 | changed |
| node_modules/string.prototype.trimend | 1.0.9 | 1.0.10 | changed |
| node_modules/strip-ansi | 7.1.2 | absent | removed |
| node_modules/strip-ansi-cjs | 6.0.1 | absent | removed |
| node_modules/strip-ansi/node_modules/ansi-regex | 6.2.2 | absent | removed |
| node_modules/terser | 5.44.1 | 5.51.2 | changed |
| node_modules/tinyrainbow | 3.0.3 | 3.2.0 | changed |
| node_modules/typed-array-byte-offset | 1.0.4 | 1.0.5 | changed |
| node_modules/typed-array-length | 1.0.7 | 1.0.8 | changed |
| node_modules/update-browserslist-db | 1.1.4 | 1.3.4 | changed |
| node_modules/vite | 7.2.6 | 7.3.8 | changed |
| node_modules/vite-plugin-pwa | 1.2.0 | 1.3.0 | changed |
| node_modules/vitest | 4.0.15 | 4.1.12 | changed |
| node_modules/which-typed-array | 1.1.19 | 1.1.24 | changed |
| node_modules/workbox-background-sync | 7.4.0 | 7.4.1 | changed |
| node_modules/workbox-broadcast-update | 7.4.0 | 7.4.1 | changed |
| node_modules/workbox-build | 7.4.0 | 7.4.1 | changed |
| node_modules/workbox-build/node_modules/@apideck/better-ajv-errors | 0.3.6 | 0.3.7 | changed |
| node_modules/workbox-build/node_modules/@rollup/plugin-babel | 5.3.1 | absent | removed |
| node_modules/workbox-build/node_modules/@rollup/plugin-replace | 2.4.2 | absent | removed |
| node_modules/workbox-build/node_modules/@rollup/pluginutils | 3.1.0 | absent | removed |
| node_modules/workbox-build/node_modules/@types/estree | 0.0.39 | absent | removed |
| node_modules/workbox-build/node_modules/ajv | 8.17.1 | 8.20.0 | changed |
| node_modules/workbox-build/node_modules/estree-walker | 1.0.1 | absent | removed |
| node_modules/workbox-build/node_modules/magic-string | 0.25.9 | absent | removed |
| node_modules/workbox-build/node_modules/picomatch | 2.3.1 | absent | removed |
| node_modules/workbox-build/node_modules/rollup | 2.79.2 | absent | removed |
| node_modules/workbox-cacheable-response | 7.4.0 | 7.4.1 | changed |
| node_modules/workbox-core | 7.4.0 | 7.4.1 | changed |
| node_modules/workbox-expiration | 7.4.0 | 7.4.1 | changed |
| node_modules/workbox-google-analytics | 7.4.0 | 7.4.1 | changed |
| node_modules/workbox-navigation-preload | 7.4.0 | 7.4.1 | changed |
| node_modules/workbox-precaching | 7.4.0 | 7.4.1 | changed |
| node_modules/workbox-range-requests | 7.4.0 | 7.4.1 | changed |
| node_modules/workbox-recipes | 7.4.0 | 7.4.1 | changed |
| node_modules/workbox-routing | 7.4.0 | 7.4.1 | changed |
| node_modules/workbox-strategies | 7.4.0 | 7.4.1 | changed |
| node_modules/workbox-streams | 7.4.0 | 7.4.1 | changed |
| node_modules/workbox-sw | 7.4.0 | 7.4.1 | changed |
| node_modules/workbox-window | 7.4.0 | 7.4.1 | changed |
| node_modules/wrap-ansi | 8.1.0 | absent | removed |
| node_modules/wrap-ansi-cjs | 7.0.0 | absent | removed |
| node_modules/wrap-ansi-cjs/node_modules/emoji-regex | 8.0.0 | absent | removed |
| node_modules/wrap-ansi-cjs/node_modules/string-width | 4.2.3 | absent | removed |
| node_modules/wrap-ansi-cjs/node_modules/strip-ansi | 6.0.1 | absent | removed |
| node_modules/wrap-ansi/node_modules/ansi-styles | 6.2.3 | absent | removed |
| node_modules/ws | 8.18.3 | 8.23.0 | changed |
| node_modules/zod | 4.1.13 | 4.6.7 | changed |

### Same-version metadata-only changes

#### node_modules/ansi-regex@5.0.1

| Field | Old | New |
| --- | --- | --- |
| peer | absent | true |

#### node_modules/glob@11.1.0

| Field | Old | New |
| --- | --- | --- |
| deprecated | absent | "Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me" |

## Remaining advisories, exact fixes and deferrals

The final audit has **three unique advisory IDs**, propagated through the 12 affected-package entries below. npm severity is preserved even when its CVSS value might suggest a different label. `fixAvailable: true` is a boolean hint with **no exact target/version or isSemVerMajor supplied**; it must not be fabricated as a named available fix. Object-valued fix suggestions below are copied exactly. npm's `isSemVerMajor: true` marks a range-breaking resolution here even though the suggested numerical version is a downgrade, not a higher major number.

| npm source ID | Advisory ID | Package | Severity | Exact title | Affected advisory range | npm fixAvailable |
| --- | --- | --- | --- | --- | --- | --- |
| 1243505 | GHSA-gcqx-w48m-w2h4 | deepmerge | low | deepmerge mergeObject() allows prototype poisoning of returned objects | >=4.2.0 <=4.3.1 | {"name":"vite-plugin-pwa","version":"1.1.0","isSemVerMajor":true} |
| 1244013 | GHSA-3g3m-2fjr-6pw4 | glob | moderate | Glob: AbortSignal cancellation bypass allows post-timeout filesystem traversal | >=9.0.0 <=14.0.1 | {"name":"vite-plugin-pwa","version":"1.1.0","isSemVerMajor":true} |
| 1244623 | GHSA-g3hv-75wg-m249 | minimatch | moderate | minimatch has potential denial of service via globparts amplification | >=7.0.0 <11.0.1 | {"name":"typescript-eslint","version":"8.36.0","isSemVerMajor":true} |

| Affected package | Exact installed lock path/version | Aggregate severity | Inherited/direct advisory IDs | Exact npm fixAvailable target / isSemVerMajor | Why deferred |
| --- | --- | --- | --- | --- | --- |
| @rollup/plugin-node-resolve | node_modules/@rollup/plugin-node-resolve@16.0.3 | low | GHSA-gcqx-w48m-w2h4 | {"name":"vite-plugin-pwa","version":"1.1.0","isSemVerMajor":true} | PWA downgrade not a demonstrated fix; same Workbox range permits affected build chain; no force/overrides/source edits. |
| @typescript-eslint/eslint-plugin | node_modules/@typescript-eslint/eslint-plugin@8.48.0 | moderate | GHSA-g3hv-75wg-m249 | true | Lint tooling chain inherits minimatch; proposed 8.36.0 is outside ^8.46.4, while current registry latest 8.72.2 remains in reported affected range. No overrides/unauthorized downgrade. |
| @typescript-eslint/parser | node_modules/@typescript-eslint/parser@8.48.0 | moderate | GHSA-g3hv-75wg-m249 | {"name":"typescript-eslint","version":"8.36.0","isSemVerMajor":true} | Lint tooling chain inherits minimatch; proposed 8.36.0 is outside ^8.46.4, while current registry latest 8.72.2 remains in reported affected range. No overrides/unauthorized downgrade. |
| @typescript-eslint/type-utils | node_modules/@typescript-eslint/type-utils@8.48.0 | moderate | GHSA-g3hv-75wg-m249 | true | Lint tooling chain inherits minimatch; proposed 8.36.0 is outside ^8.46.4, while current registry latest 8.72.2 remains in reported affected range. No overrides/unauthorized downgrade. |
| @typescript-eslint/typescript-estree | node_modules/@typescript-eslint/typescript-estree@8.48.0 | moderate | GHSA-g3hv-75wg-m249 | {"name":"typescript-eslint","version":"8.36.0","isSemVerMajor":true} | Lint tooling chain inherits minimatch; proposed 8.36.0 is outside ^8.46.4, while current registry latest 8.72.2 remains in reported affected range. No overrides/unauthorized downgrade. |
| @typescript-eslint/utils | node_modules/@typescript-eslint/utils@8.48.0 | moderate | GHSA-g3hv-75wg-m249 | {"name":"typescript-eslint","version":"8.36.0","isSemVerMajor":true} | Lint tooling chain inherits minimatch; proposed 8.36.0 is outside ^8.46.4, while current registry latest 8.72.2 remains in reported affected range. No overrides/unauthorized downgrade. |
| deepmerge | node_modules/deepmerge@4.3.1 | low | GHSA-gcqx-w48m-w2h4 | {"name":"vite-plugin-pwa","version":"1.1.0","isSemVerMajor":true} | PWA downgrade not a demonstrated fix; same Workbox range permits affected build chain; no force/overrides/source edits. |
| glob | node_modules/glob@11.1.0 | moderate | GHSA-3g3m-2fjr-6pw4, GHSA-g3hv-75wg-m249 | {"name":"vite-plugin-pwa","version":"1.1.0","isSemVerMajor":true} | PWA downgrade not a demonstrated fix; same Workbox range permits affected build chain; no force/overrides/source edits. |
| minimatch | node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch@9.0.9; node_modules/glob/node_modules/minimatch@10.2.6 | moderate | GHSA-g3hv-75wg-m249 | {"name":"typescript-eslint","version":"8.36.0","isSemVerMajor":true} | Fixed target 11.0.1 is outside parent ranges ^9.0.4 and ^10.1.1; proposed typescript-eslint 8.36.0 is outside declared range and not authorized. |
| typescript-eslint | node_modules/typescript-eslint@8.48.0 | moderate | GHSA-g3hv-75wg-m249 | {"name":"typescript-eslint","version":"8.36.0","isSemVerMajor":true} | Lint tooling chain inherits minimatch; proposed 8.36.0 is outside ^8.46.4, while current registry latest 8.72.2 remains in reported affected range. No overrides/unauthorized downgrade. |
| vite-plugin-pwa | node_modules/vite-plugin-pwa@1.3.0 | moderate | GHSA-gcqx-w48m-w2h4, GHSA-3g3m-2fjr-6pw4, GHSA-g3hv-75wg-m249 | {"name":"vite-plugin-pwa","version":"1.1.0","isSemVerMajor":true} | PWA downgrade not a demonstrated fix; same Workbox range permits affected build chain; no force/overrides/source edits. |
| workbox-build | node_modules/workbox-build@7.4.1 | moderate | GHSA-gcqx-w48m-w2h4, GHSA-3g3m-2fjr-6pw4, GHSA-g3hv-75wg-m249 | {"name":"vite-plugin-pwa","version":"1.1.0","isSemVerMajor":true} | PWA downgrade not a demonstrated fix; same Workbox range permits affected build chain; no force/overrides/source edits. |

### Remediation limits by touched area

- **PWA generation/build tooling:** `vite-plugin-pwa`, `workbox-build`, `@rollup/plugin-node-resolve`, `deepmerge`, and `glob` are linked through the Node-side worker generation graph. npm proposes `vite-plugin-pwa@1.1.0`, `isSemVerMajor: true`, for the low/moderate inherited findings. The baseline actually declared ^1.2.0 and locked 1.2.0. The non-forced fix selected 1.3.0. Registry evidence for 1.1.0 declares **workbox-build ^7.3.0**, which still permits the same affected current 7.4.1; current 1.3.0 requests ^7.4.1. Blindly downgrading the plugin therefore is not a demonstrated remediation. No downgrade was attempted or retained; no forced pin/override to Workbox or its graph was authorized. The updated non-breaking graph did clear the baseline serialize-javascript/@rollup/plugin-terser advisory entries.
- **Lint/parser tooling:** `minimatch` is 9.0.9 under typescript-estree (^9.0.4 parent constraint) and 10.2.6 under glob (^10.1.1 parent constraint). Advisory GHSA-g3hv-75wg-m249 reports versions >=7.0.0 <11.0.1 as affected; registry confirms 11.0.1, outside both parent ranges. npm proposes `typescript-eslint@8.36.0`, `isSemVerMajor: true`, outside the declared ^8.46.4. That downgrade is not authorized; no broad override or unrelated dependency churn was used. Registry latest typescript-eslint was 8.72.2, also inside the reported aggregate affected range, so a blind current-version upgrade is not asserted to fix it. Boolean fix hints for type-utils/eslint-plugin have no exact target in the final JSON and remain deferred with their inherited chain.

## Runtime exposure: possible reachability versus established exploitation

- **Direct runtime-reachable baseline advisory:** application routing imports `react-router-dom` in `src/app/App.tsx:2` (BrowserRouter), `src/app/routes.tsx:2` (Routes/Route/Navigate), and Link/useNavigate/NavLink in UI/features. Baseline react-router/react-router-dom 7.10.1 were therefore in a browser-executed dependency, not merely tooling. In particular **GHSA-wrjc-x8rr-h8h6 — React Router: Open redirect via backslash in <Link> and useNavigate (CVE-2025-68470 bypass)** (moderate; npm source 1124268) concerns APIs used by this application. **GHSA-chx6-hx7r-mcp5 — React Router: Unauthenticated Denial of Service via Inefficient Route Matching** (high; source 1124276) is also relevant to the route-matching surface. This establishes package/API-level possible reachability, **not attacker-controlled input or a working exploit**; no exploit was attempted. Both router packages are now 7.18.5 and absent from the final audit.
- Other baseline router advisories include SSR/RSC, server actions, single-fetch, turbo-stream and __manifest behaviors. This source uses a client-side declarative BrowserRouter; the investigation did not find createBrowserRouter/RouterProvider/loader/action setup. No assertion is made that server/SSR/cookie advisory paths were exercised merely because they existed in the production dependency graph. Baseline raw audit contains every exact router advisory.
- **Unresolved findings are in Node-side lint/build graphs:** deepmerge/plugin-node-resolve in Workbox generation; glob/minimatch in filesystem precache traversal and lint parser tooling. Potential exposure is a developer/CI process handling hostile configuration, merge objects, source tree or patterns; this is not evidence of a malicious input path in this repo and not an established exploit. The configured precache glob is a constant in `vite.config.ts:44`; no browser import of deepmerge, glob or minimatch was identified. Do not expose build/dev tools to untrusted users or build untrusted changes with secrets.
- **dev flags do not mean browser-impossible:** generated `sw.js` and its Workbox chunk do execute in production browsers, including precaching, navigation fallback, CacheFirst fonts caching/expiration. The emitted worker was inspected and structurally verified. The unresolved advisories name the Node build helpers above, not an advisory on the emitted Workbox runtime modules; no browser runtime path to those affected Node APIs was established.
- **Vitest critical baseline finding was tooling exposure:** GHSA-5xrq-8626-4rwp concerns a listening Vitest UI server; the mocker advisories concern test tooling endpoints. `test:ui` exists but the final command was non-server `vitest --run`, not a deployed browser app or publicly bound UI. Matching 4.1.12 fixes cleared these entries. No public UI server was started.
- Vite baseline server findings likewise concern tooling/dev server exposure (the config defaults to 0.0.0.0); the audit update to 7.3.8 removed its entry. No dev/preview server was started and no deployment was made.
- **No unresolved production-browser-reachable advisory was established in this audit.** That is a bounded source/graph finding, not a guarantee of zero runtime risk and not independent security acceptance.

## PWA choice, existing checks and actual emitted artifacts

- Retained only the non-breaking plugin 1.2.0 → 1.3.0 update, with ^1.2.0 manifest range unchanged; Workbox moved 7.4.0 → 7.4.1. The only conditionally permitted range-breaking plugin target, 1.1.0, was **not taken**, for the remediation-range reason above. No PWA source/configuration changes were necessary for the retained dependency update.
- Configuration: `vite.config.ts:18-61` autoUpdate, generateSW defaults, JS/CSS/HTML/image/font precaching, Google Fonts CacheFirst cache with maxEntries 10 / one-year expiration / statuses 0 and 200.
- No dedicated existing PWA lifecycle/offline/installability tests were found. Do not relabel generic app tests as dedicated PWA tests. Three existing PWA-adjacent artifact helper tests in `.github/tests/ci.checks.mjs` were targeted before freeze and passed (3/3, exit 0):
  1. artifact walk includes transitive/lazy chunks, nested CSS and workers
  2. missing locally referenced chunks and shell fail instead of being skipped
  3. served mismatch and missing transitive asset both fail
- Those tests use local fixtures and mock responses, not a real deployed site or browser worker. The final build and a read-only local artifact inventory verified actual output; no second build or full gate run occurred.
- Structural checks on generated bytes: HTML references registerSW.js; registration targets /sw.js with scope /; worker references the emitted Workbox chunk; precacheAndRoute, Google Fonts cache, skipWaiting and clientsClaim are present. Existing artifact inventory validates locally referenced JS/CSS/HTML; it selected 6 files.
- Verification helper attempts are disclosed: first failed to resolve its own too-deep relative import; second incorrectly expected the .js suffix inside an AMD Workbox module reference. Corrected **only the ignored evidence helper**, read actual output, then all structural checks passed, exit 0. These were evidence-script errors, not failed builds, dependency modifications, or repeated final gates. All three raw attempts are retained.
- Existing bounded limitations: built HTML links both static manifest.json and generated manifest.webmanifest; generated manifest names icon-192.png/icon-512.png while actual built icon files are SVG (configured PNG/ICO files are absent). No installability/offline/lifecycle acceptance is claimed and no source fixes were authorized or attempted.

| Built artifact | Bytes | SHA-256 |
| --- | --- | --- |
| dist/assets/index-Cv67iWLg.js | 473111 | 07e48f4bfe507620f931ce1987feaf918da279de7b4cf81286e35a68b1b7d1f9 |
| dist/assets/index-g06rwGX2.css | 48848 | 29e7ee3faf1e8bde74933ffc44d2ffda9a3a9716a05f7ceed9039a215e6bee70 |
| dist/favicon.svg | 112 | d8ae38126d734da4750686bfb35fd8d2900333b71bfbc9c8078a24ee9b93d11b |
| dist/icon.svg | 217 | 22cfe3bb9da228373f9bf47072cd66e17f794a5a8e6f619529f06b4e8b8da9dc |
| dist/index.html | 1037 | 309e9dc33e36a4fe7e7ca2879dd5bbc3b93a0c954074ea27d15027768997198c |
| dist/manifest.json | 591 | 574dcbb0d670edf6b280c748e801783df6902b189426c3313e54d747392481a4 |
| dist/manifest.webmanifest | 404 | 6376c63109625dc8da01666dcd2de5a63140c1a16d6fcee1049e1d9f518e02e0 |
| dist/registerSW.js | 134 | 9742073ef7fc795e7673d98f272992843298426a0ffd8cb3507784df5143608b |
| dist/sw.js | 1456 | ac2e3f316dc5b6be05e8fd7c72ba90650aeaa4ef1213f2179b5a8a9b552738d7 |
| dist/workbox-835c8c05.js | 21863 | 09fac2e643b2b4eb60ec4b0a4281c196c5942051e2229aec09fb99df59424315 |

Final build: 190 modules transformed, 7 precache entries (511.19 KiB), 10 actual artifact files; two files under dist/assets.

## Frozen final gates — single sequential execution

| Order | Exact command | Start UTC | Finish UTC | Child exit | Counts/results |
| --- | --- | --- | --- | --- | --- |
| 1 | npx eslint . | 2026-11-16T06:44:15.928Z | 2026-11-16T06:44:18.711Z | 0 | No diagnostics; no file count emitted by this exact command. |
| 2 | npx tsc -b | 2026-11-16T06:44:18.712Z | 2026-11-16T06:44:20.575Z | 0 | No diagnostics; no file count emitted by this exact command. |
| 3 | npm test -- --run | 2026-11-16T06:44:20.575Z | 2026-11-16T06:44:34.749Z | 0 | 46 test files passed; 492 tests passed. |
| 4 | npm run build | 2026-11-16T06:44:34.749Z | 2026-11-16T06:44:38.370Z | 0 | 190 modules; 7 precache entries; sw/register/assets emitted. |

All four actual child exits are **0**. Their runner's own exit is not used as a substitute. Dependencies remained byte-identical to freeze (validated after build and before candidate commit):

| Frozen file | SHA-256 |
| --- | --- |
| package.json | 1f81a3b388ffbd632288eca31b277581668d8c59a75b8fb358be7f2a0a7f70ae |
| package-lock.json | 0ec244d4b0e848af3e454de4bd5f99f8430b1abd9292c30c74daafdb2a063ba6 |

Raw diagnostics are retained: tests emitted three jsdom “Not implemented: navigation to another Document” messages; build emitted five static/dynamic import chunking warnings in storage modules. These did not produce nonzero child exits and were not source-fixed. No gate was rerun. The build script itself includes tsc -b, as originally defined; the prescribed separate TypeScript gate was still run once before tests.


### npx eslint . — metadata

```text
{
  "command": [
    "npx",
    "eslint",
    "."
  ],
  "started": "2026-11-16T06:44:15.928Z",
  "finished": "2026-11-16T06:44:18.711Z",
  "exit": 0,
  "signal": null,
  "error": null
}
```

### gate-1-eslint — complete stdout (empty)

```text

```

### gate-1-eslint — complete stderr (empty)

```text

```

### npx tsc -b — metadata

```text
{
  "command": [
    "npx",
    "tsc",
    "-b"
  ],
  "started": "2026-11-16T06:44:18.712Z",
  "finished": "2026-11-16T06:44:20.575Z",
  "exit": 0,
  "signal": null,
  "error": null
}
```

### gate-2-tsc — complete stdout (empty)

```text

```

### gate-2-tsc — complete stderr (empty)

```text

```

### npm test -- --run — metadata

```text
{
  "command": [
    "npm",
    "test",
    "--",
    "--run"
  ],
  "started": "2026-11-16T06:44:20.575Z",
  "finished": "2026-11-16T06:44:34.749Z",
  "exit": 0,
  "signal": null,
  "error": null
}
```

### gate-3-test — complete stdout

```text

> runawaylog@1.2.0 test
> vitest --run


 RUN  v4.1.12 /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a


 Test Files  46 passed (46)
      Tests  492 passed (492)
   Start at  14:44:20
   Duration  13.75s (transform 2.71s, setup 8.49s, import 3.68s, tests 54.82s, environment 12.64s)

```

### gate-3-test — complete stderr

```text
Not implemented: navigation to another Document
Not implemented: navigation to another Document
Not implemented: navigation to another Document
```

### npm run build — metadata

```text
{
  "command": [
    "npm",
    "run",
    "build"
  ],
  "started": "2026-11-16T06:44:34.749Z",
  "finished": "2026-11-16T06:44:38.370Z",
  "exit": 0,
  "signal": null,
  "error": null
}
```

### gate-4-build — complete stdout

```text

> runawaylog@1.2.0 build
> tsc -b && vite build

vite v7.3.8 building client environment for production...
transforming...
✓ 190 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                0.13 kB
dist/manifest.webmanifest         0.40 kB
dist/index.html                   1.04 kB │ gzip:   0.50 kB
dist/assets/index-g06rwGX2.css   48.85 kB │ gzip:   8.46 kB
dist/assets/index-Cv67iWLg.js   473.11 kB │ gzip: 154.51 kB
✓ built in 694ms

PWA v1.3.0
mode      generateSW
precache  7 entries (511.19 KiB)
files generated
  dist/sw.js
  dist/workbox-835c8c05.js
```

### gate-4-build — complete stderr

```text
[plugin vite:reporter] 
(!) /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/files.ts is dynamically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts but also statically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/chunks.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commands.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/envelope-validation.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/imports.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/recovery.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/restore.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/runtime.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/snapshot.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/tree-validation.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter] 
(!) /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/chunks.ts is dynamically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts but also statically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commands.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/imports.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/snapshot.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/tree-validation.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter] 
(!) /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/snapshot.ts is dynamically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts but also statically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commands.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/imports.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/index.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/recovery.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/restore.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/runtime.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter] 
(!) /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/tree-validation.ts is dynamically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/files.ts but also statically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/index.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/recovery.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter] 
(!) /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/recovery.ts is dynamically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commands.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/imports.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/runtime.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/runtime.ts but also statically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/index.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/restore.ts, dynamic import will not move module into another chunk.

```

## Relevant command ledger — actual child exits

Commands are captured by the ignored evidence runner with separate complete stdout/stderr and metadata files. A runner may return 0 while a child returns 1; the table below reports the **child**, including failed resolver and helper attempts. The first broad registry view command only expanded Vitest metadata; exact PWA/UI queries were then made separately, as shown. Read-only inspections and git diff checks were also performed; diff --check returned 0.

| Evidence label | Command | Start UTC | Finish UTC | Child exit |
| --- | --- | --- | --- | --- |
| baseline-head | git rev-parse HEAD | 2026-11-16T06:34:58.381Z | 2026-11-16T06:34:58.389Z | 0 |
| baseline-branch | git branch --show-current | 2026-11-16T06:34:58.390Z | 2026-11-16T06:34:58.396Z | 0 |
| baseline-status | git status --porcelain | 2026-11-16T06:34:58.396Z | 2026-11-16T06:34:58.404Z | 0 |
| baseline-remotes | git remote -v | 2026-11-16T06:34:58.405Z | 2026-11-16T06:34:58.411Z | 0 |
| node-version | node --version | 2026-11-16T06:34:58.411Z | 2026-11-16T06:34:58.424Z | 0 |
| npm-version | npm --version | 2026-11-16T06:34:58.424Z | 2026-11-16T06:34:58.480Z | 0 |
| baseline-audit | npm audit --json | 2026-11-16T06:34:58.480Z | 2026-11-16T06:35:08.488Z | 1 |
| npm-audit-fix | npm audit fix | 2026-11-16T06:35:17.974Z | 2026-11-16T06:36:18.372Z | 1 |
| post-audit | npm audit --json | 2026-11-16T06:36:18.373Z | 2026-11-16T06:36:21.662Z | 1 |
| registry-remediation | npm view vitest@4 @vitest/ui@4 vite-plugin-pwa@1.1.0 version dependencies peerDependencies --json | 2026-11-16T06:38:42.083Z | 2026-11-16T06:38:43.589Z | 0 |
| registry-pwa-1.1.0 | npm view vite-plugin-pwa@1.1.0 version dependencies peerDependencies --json | 2026-11-16T06:39:04.299Z | 2026-11-16T06:39:05.789Z | 0 |
| registry-vitest-fixed | npm view vitest@4.1.12 version dependencies peerDependencies engines --json | 2026-11-16T06:39:05.830Z | 2026-11-16T06:39:07.336Z | 0 |
| registry-ui-fixed | npm view @vitest/ui@4.1.12 version dependencies peerDependencies --json | 2026-11-16T06:39:07.371Z | 2026-11-16T06:39:08.926Z | 0 |
| targeted-nonbreaking-vitest | npm update vitest @vitest/ui | 2026-11-16T06:39:31.579Z | 2026-11-16T06:39:33.975Z | 0 |
| audit-after-vitest | npm audit --json | 2026-11-16T06:39:33.999Z | 2026-11-16T06:39:36.070Z | 1 |
| registry-workbox-current | npm view workbox-build@7.4.1 version dependencies --json | 2026-11-16T06:39:36.092Z | 2026-11-16T06:39:37.507Z | 0 |
| install-fixed-vitest | npm install --save-dev vitest@^4.1.12 @vitest/ui@^4.1.12 | 2026-11-16T06:39:48.576Z | 2026-11-16T06:39:53.307Z | 1 |
| registry-typescript-eslint | npm view typescript-eslint version --json | 2026-11-16T06:39:53.331Z | 2026-11-16T06:39:55.822Z | 0 |
| registry-minimatch | npm view minimatch@11.0.1 version engines --json | 2026-11-16T06:39:55.850Z | 2026-11-16T06:39:57.298Z | 0 |
| install-manifest-vitest | npm install | 2026-11-16T06:40:44.677Z | 2026-11-16T06:40:53.481Z | 1 |
| resolve-vitest-lock-only | npm install --package-lock-only | 2026-11-16T06:41:01.982Z | 2026-11-16T06:41:02.637Z | 1 |
| strict-vitest-resolution | npm install --package-lock-only --strict-peer-deps | 2026-11-16T06:41:19.262Z | 2026-11-16T06:41:19.986Z | 1 |
| vitest-peer-cycle-resolution | npm install --package-lock-only --legacy-peer-deps | 2026-11-16T06:41:34.937Z | 2026-11-16T06:41:40.171Z | 0 |
| install-resolved-lock | npm install | 2026-11-16T06:41:55.483Z | 2026-11-16T06:42:01.756Z | 0 |
| audit-resolved-vitest | npm audit --json | 2026-11-16T06:42:01.779Z | 2026-11-16T06:42:03.959Z | 1 |
| dependency-tree | npm ls --depth=0 | 2026-11-16T06:42:41.820Z | 2026-11-16T06:42:41.999Z | 0 |
| remaining-minimatch-path | npm explain minimatch | 2026-11-16T06:42:42.022Z | 2026-11-16T06:42:42.184Z | 0 |
| pwa-adjacent-tests | node --test --test-name-pattern=artifact walk\|missing locally referenced\|served mismatch .github/tests/ci.checks.mjs | 2026-11-16T06:42:42.206Z | 2026-11-16T06:42:42.284Z | 0 |
| final-audit | npm audit --json | 2026-11-16T06:43:33.577Z | 2026-11-16T06:43:35.786Z | 1 |
| final-dependency-tree | npm ls --all | 2026-11-16T06:43:35.810Z | 2026-11-16T06:43:36.018Z | 0 |
| gate-1-eslint | npx eslint . | 2026-11-16T06:44:15.928Z | 2026-11-16T06:44:18.711Z | 0 |
| gate-2-tsc | npx tsc -b | 2026-11-16T06:44:18.712Z | 2026-11-16T06:44:20.575Z | 0 |
| gate-3-test | npm test -- --run | 2026-11-16T06:44:20.575Z | 2026-11-16T06:44:34.749Z | 0 |
| gate-4-build | npm run build | 2026-11-16T06:44:34.749Z | 2026-11-16T06:44:38.370Z | 0 |
| artifact-verification | node node_modules/.cache/audit-only-evidence/verify-artifacts.mjs | 2026-11-16T06:46:18.889Z | 2026-11-16T06:46:18.918Z | 1 |
| artifact-verification-corrected | node node_modules/.cache/audit-only-evidence/verify-artifacts.mjs | 2026-11-16T06:46:40.774Z | 2026-11-16T06:46:40.811Z | 1 |
| artifact-verification-final | node node_modules/.cache/audit-only-evidence/verify-artifacts.mjs | 2026-11-16T06:47:19.005Z | 2026-11-16T06:47:19.060Z | 0 |
| precommit-validation | node node_modules/.cache/audit-only-evidence/precommit.mjs | 2026-11-16T06:48:38.706Z | 2026-11-16T06:48:38.758Z | 0 |
| dependency-candidate-head | git rev-parse HEAD | 2026-11-16T06:50:18.877Z | 2026-11-16T06:50:18.887Z | 0 |
| dependency-candidate-show | git show --format=fuller --stat HEAD | 2026-11-16T06:50:18.917Z | 2026-11-16T06:50:18.927Z | 0 |
| dependency-candidate-status | git status --porcelain | 2026-11-16T06:50:18.953Z | 2026-11-16T06:50:18.963Z | 0 |

### Selected raw remediation and verification command outputs


### npm-audit-fix — complete stdout

```text

added 10 packages, removed 37 packages, changed 181 packages, and audited 554 packages in 1m

158 packages are looking for funding
  run `npm fund` for details

# npm audit report

@vitest/mocker  <=4.1.11
Severity: moderate
Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock - https://github.com/advisories/GHSA-82fw-gwwq-j7x9
Vitest: Code injection via unauthenticated manual mock registration - https://github.com/advisories/GHSA-qxg6-89mg-rqv8
fix available via `npm audit fix`
node_modules/@vitest/mocker
  vitest  2.1.0-beta.1 - 4.1.10
  Depends on vulnerable versions of @vitest/mocker
  Depends on vulnerable versions of @vitest/ui
  node_modules/vitest
    @vitest/ui  4.0.0-beta.1 - 4.1.0-beta.6
    Depends on vulnerable versions of vitest
    node_modules/@vitest/ui

deepmerge  >=4.2.0
deepmerge mergeObject() allows prototype poisoning of returned objects - https://github.com/advisories/GHSA-gcqx-w48m-w2h4
fix available via `npm audit fix --force`
Will install vite-plugin-pwa@1.1.0, which is a breaking change
node_modules/deepmerge
  @rollup/plugin-node-resolve  >=8.0.0
  Depends on vulnerable versions of deepmerge
  node_modules/@rollup/plugin-node-resolve
    workbox-build  >=6.0.0-alpha.0
    Depends on vulnerable versions of @rollup/plugin-node-resolve
    Depends on vulnerable versions of glob
    node_modules/workbox-build
      vite-plugin-pwa  >=1.2.0
      Depends on vulnerable versions of workbox-build
      node_modules/vite-plugin-pwa

glob  9.0.0 - 14.0.1
Severity: moderate
Glob: AbortSignal cancellation bypass allows post-timeout filesystem traversal - https://github.com/advisories/GHSA-3g3m-2fjr-6pw4
Depends on vulnerable versions of minimatch
fix available via `npm audit fix --force`
Will install vite-plugin-pwa@1.1.0, which is a breaking change
node_modules/glob

minimatch  7.0.0 - 11.0.0
Severity: moderate
minimatch has potential denial of service via globparts amplification - https://github.com/advisories/GHSA-g3hv-75wg-m249
fix available via `npm audit fix --force`
Will install typescript-eslint@8.36.0, which is a breaking change
node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch
node_modules/glob/node_modules/minimatch
  @typescript-eslint/typescript-estree  6.16.0 - 8.72.2
  Depends on vulnerable versions of minimatch
  node_modules/@typescript-eslint/typescript-estree
    @typescript-eslint/parser  6.16.0 - 8.72.2
    Depends on vulnerable versions of @typescript-eslint/typescript-estree
    node_modules/@typescript-eslint/parser
      @typescript-eslint/eslint-plugin  6.16.0 - 8.72.2
      Depends on vulnerable versions of @typescript-eslint/parser
      Depends on vulnerable versions of @typescript-eslint/type-utils
      Depends on vulnerable versions of @typescript-eslint/utils
      node_modules/@typescript-eslint/eslint-plugin
      typescript-eslint  <=8.72.2
      Depends on vulnerable versions of @typescript-eslint/eslint-plugin
      Depends on vulnerable versions of @typescript-eslint/parser
      Depends on vulnerable versions of @typescript-eslint/typescript-estree
      Depends on vulnerable versions of @typescript-eslint/utils
      node_modules/typescript-eslint
    @typescript-eslint/type-utils  6.16.0 - 8.72.2
    Depends on vulnerable versions of @typescript-eslint/typescript-estree
    Depends on vulnerable versions of @typescript-eslint/utils
    node_modules/@typescript-eslint/type-utils
    @typescript-eslint/utils  6.16.0 - 8.72.2
    Depends on vulnerable versions of @typescript-eslint/typescript-estree
    node_modules/@typescript-eslint/utils


15 vulnerabilities (2 low, 11 moderate, 2 critical)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force
```

### npm-audit-fix — complete stderr

```text

```

### targeted-nonbreaking-vitest — complete stdout

```text

up to date, audited 554 packages in 2s

158 packages are looking for funding
  run `npm fund` for details

15 vulnerabilities (2 low, 11 moderate, 2 critical)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

### targeted-nonbreaking-vitest — complete stderr

```text

```

### install-fixed-vitest — complete stdout

```text

```

### install-fixed-vitest — complete stderr

```text
npm error Cannot read properties of null (reading 'edgesOut')
npm error A complete log of this run can be found in: /Users/emmett/.npm/_logs/2026-11-16T06_39_48_620Z-debug-0.log
```

### install-manifest-vitest — complete stdout

```text

```

### install-manifest-vitest — complete stderr

```text
npm error Cannot read properties of null (reading 'edgesOut')
npm error A complete log of this run can be found in: /Users/emmett/.npm/_logs/2026-11-16T06_40_44_720Z-debug-0.log
```

### resolve-vitest-lock-only — complete stdout

```text

```

### resolve-vitest-lock-only — complete stderr

```text
npm error Cannot read properties of null (reading 'edgesOut')
npm error A complete log of this run can be found in: /Users/emmett/.npm/_logs/2026-11-16T06_41_02_028Z-debug-0.log
```

### strict-vitest-resolution — complete stdout

```text

```

### strict-vitest-resolution — complete stderr

```text
npm error Cannot read properties of null (reading 'edgesOut')
npm error A complete log of this run can be found in: /Users/emmett/.npm/_logs/2026-11-16T06_41_19_326Z-debug-0.log
```

### vitest-peer-cycle-resolution — complete stdout

```text

up to date, audited 596 packages in 5s

157 packages are looking for funding
  run `npm fund` for details

12 vulnerabilities (2 low, 10 moderate)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

### vitest-peer-cycle-resolution — complete stderr

```text

```

### install-resolved-lock — complete stdout

```text

changed 23 packages, and audited 554 packages in 6s

158 packages are looking for funding
  run `npm fund` for details

12 vulnerabilities (2 low, 10 moderate)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

### install-resolved-lock — complete stderr

```text

```

### registry-pwa-1.1.0 — complete stdout

```text
{
  "version": "1.1.0",
  "dependencies": {
    "debug": "^4.3.6",
    "tinyglobby": "^0.2.10",
    "pretty-bytes": "^6.1.1",
    "workbox-build": "^7.3.0",
    "workbox-window": "^7.3.0"
  },
  "peerDependencies": {
    "vite": "^3.1.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0",
    "workbox-build": "^7.3.0",
    "workbox-window": "^7.3.0",
    "@vite-pwa/assets-generator": "^1.0.0"
  }
}
```

### registry-pwa-1.1.0 — complete stderr

```text

```

### registry-typescript-eslint — complete stdout

```text
"8.72.2"
```

### registry-typescript-eslint — complete stderr

```text

```

### registry-minimatch — complete stdout

```text
{
  "version": "11.0.1",
  "engines": {
    "node": "18 || 20 || >=22"
  }
}
```

### registry-minimatch — complete stderr

```text

```

### pwa-adjacent-tests — complete stdout

```text
TAP version 13
# Subtest: artifact walk includes transitive/lazy chunks, nested CSS and workers
ok 1 - artifact walk includes transitive/lazy chunks, nested CSS and workers
  ---
  duration_ms: 4.29475
  type: 'test'
  ...
# Subtest: missing locally referenced chunks and shell fail instead of being skipped
ok 2 - missing locally referenced chunks and shell fail instead of being skipped
  ---
  duration_ms: 3.096541
  type: 'test'
  ...
# https://example.test/assets/lazy/second.css expected=7ada5a1234b13c6cafa63c438ae59e1a35173601906230c4b7508722aa1597f6 served=7ada5a1234b13c6cafa63c438ae59e1a35173601906230c4b7508722aa1597f6
# https://example.test/assets/lazy/second.js expected=f2ed650f15f224fa0836d26fabb81f0e219e1e3515d41640040073b222ffcbfd served=f2ed650f15f224fa0836d26fabb81f0e219e1e3515d41640040073b222ffcbfd
# https://example.test/assets/main.css expected=afb651b56498a678200c6287bfd1b127a2aba24a5751f57c4c2778d5ec4a67ac served=afb651b56498a678200c6287bfd1b127a2aba24a5751f57c4c2778d5ec4a67ac
# https://example.test/assets/main.js expected=b617668b5bddaed458ee30dbc359b80ae9f7a6d3f2229afc5567e15dbc4f747a served=b617668b5bddaed458ee30dbc359b80ae9f7a6d3f2229afc5567e15dbc4f747a
# https://example.test/ expected=166b04feb0a589710f1e33dd6fabc66fbce9504a29c6fcff577a7d30e4130eb4 served=166b04feb0a589710f1e33dd6fabc66fbce9504a29c6fcff577a7d30e4130eb4
# https://example.test/sw.js expected=7e2191258968e64e365b9f6d55434091c16c63a975cf437cb4d81a8818d0f4f3 served=7e2191258968e64e365b9f6d55434091c16c63a975cf437cb4d81a8818d0f4f3
# https://example.test/assets/lazy/second.css expected=7ada5a1234b13c6cafa63c438ae59e1a35173601906230c4b7508722aa1597f6 served=8810ad581e59f2bc3928b261707a71308f7e139eb04820366dc4d5c18d980225
# https://example.test/assets/lazy/second.css expected=7ada5a1234b13c6cafa63c438ae59e1a35173601906230c4b7508722aa1597f6 served=7ada5a1234b13c6cafa63c438ae59e1a35173601906230c4b7508722aa1597f6
# Subtest: served mismatch and missing transitive asset both fail
ok 3 - served mismatch and missing transitive asset both fail
  ---
  duration_ms: 10.248
  type: 'test'
  ...
1..3
# tests 3
# suites 0
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 51.447459
```

### pwa-adjacent-tests — complete stderr

```text

```

### artifact-verification — complete stdout

```text

```

### artifact-verification — complete stderr

```text
node:internal/modules/esm/resolve:275
    throw new ERR_MODULE_NOT_FOUND(
          ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/emmett/workspace/macacloud/.aside-work/soren//.github/scripts/verify-production.mjs' imported from /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/node_modules/.cache/audit-only-evidence/verify-artifacts.mjs
    at finalizeResolution (node:internal/modules/esm/resolve:275:11)
    at moduleResolve (node:internal/modules/esm/resolve:861:10)
    at defaultResolve (node:internal/modules/esm/resolve:985:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:747:20)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:724:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:320:38)
    at ModuleJob._link (node:internal/modules/esm/module_job:182:49) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///Users/emmett/workspace/macacloud/.aside-work/soren//.github/scripts/verify-production.mjs'
}

Node.js v22.23.2
```

### artifact-verification-corrected — complete stdout

```text

```

### artifact-verification-corrected — complete stderr

```text
file:///Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/node_modules/.cache/audit-only-evidence/verify-artifacts.mjs:28
if(Object.values(contracts).some(v=>!v)) throw new Error('Generated structural contract missing');
                                               ^

Error: Generated structural contract missing
    at file:///Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/node_modules/.cache/audit-only-evidence/verify-artifacts.mjs:28:48

Node.js v22.23.2
```

### artifact-verification-final — complete stdout

```text
{
  "time": "2026-11-16T06:47:19.057Z",
  "dependencyHashesUnchanged": true,
  "files": [
    {
      "path": "dist/assets/index-Cv67iWLg.js",
      "bytes": 473111,
      "sha256": "07e48f4bfe507620f931ce1987feaf918da279de7b4cf81286e35a68b1b7d1f9"
    },
    {
      "path": "dist/assets/index-g06rwGX2.css",
      "bytes": 48848,
      "sha256": "29e7ee3faf1e8bde74933ffc44d2ffda9a3a9716a05f7ceed9039a215e6bee70"
    },
    {
      "path": "dist/favicon.svg",
      "bytes": 112,
      "sha256": "d8ae38126d734da4750686bfb35fd8d2900333b71bfbc9c8078a24ee9b93d11b"
    },
    {
      "path": "dist/icon.svg",
      "bytes": 217,
      "sha256": "22cfe3bb9da228373f9bf47072cd66e17f794a5a8e6f619529f06b4e8b8da9dc"
    },
    {
      "path": "dist/index.html",
      "bytes": 1037,
      "sha256": "309e9dc33e36a4fe7e7ca2879dd5bbc3b93a0c954074ea27d15027768997198c"
    },
    {
      "path": "dist/manifest.json",
      "bytes": 591,
      "sha256": "574dcbb0d670edf6b280c748e801783df6902b189426c3313e54d747392481a4"
    },
    {
      "path": "dist/manifest.webmanifest",
      "bytes": 404,
      "sha256": "6376c63109625dc8da01666dcd2de5a63140c1a16d6fcee1049e1d9f518e02e0"
    },
    {
      "path": "dist/registerSW.js",
      "bytes": 134,
      "sha256": "9742073ef7fc795e7673d98f272992843298426a0ffd8cb3507784df5143608b"
    },
    {
      "path": "dist/sw.js",
      "bytes": 1456,
      "sha256": "ac2e3f316dc5b6be05e8fd7c72ba90650aeaa4ef1213f2179b5a8a9b552738d7"
    },
    {
      "path": "dist/workbox-835c8c05.js",
      "bytes": 21863,
      "sha256": "09fac2e643b2b4eb60ec4b0a4281c196c5942051e2229aec09fb99df59424315"
    }
  ],
  "existingArtifactInventorySelectedCount": 6,
  "contracts": {
    "registrationTargetsSW": true,
    "htmlLinksRegistration": true,
    "workerImportsWorkbox": true,
    "workerHasPrecache": true,
    "workerHasGoogleFontsCache": true,
    "workerHasAutoUpdate": true
  },
  "note": "Local generated-file existence, bytes and structural validation only. No browser, offline, update lifecycle, installability, deployment, or exploit verification performed."
}
```

### artifact-verification-final — complete stderr

```text

```

### dependency-candidate-show — complete stdout

```text
commit 2f57b1fd7776ca85cd2a09f875002dde3b107601
Author:     Emmett <emmett@initialize.in>
AuthorDate: Mon Nov 16 14:49:58 2026 +0800
Commit:     Emmett <emmett@initialize.in>
CommitDate: Mon Nov 16 14:49:58 2026 +0800

    chore: apply non-breaking dependency security updates
    
    Co-Authored-By: Claude Code <noreply@anthropic.com>

 package-lock.json | 3094 +++++++++++++++++++++++++----------------------------
 package.json      |    4 +-
 2 files changed, 1455 insertions(+), 1643 deletions(-)
```

### dependency-candidate-show — complete stderr

```text

```

## Complete audit JSON snapshots

Full baseline and final audit JSON is embedded below for an enduring local report in addition to the ignored evidence. The immediate post-fix JSON is also included because it establishes the unresolved critical state before explicit same-major Vitest remediation. stderr and metadata are included verbatim.

### baseline-audit — metadata

```text
{
  "command": [
    "npm",
    "audit",
    "--json"
  ],
  "started": "2026-11-16T06:34:58.480Z",
  "finished": "2026-11-16T06:35:08.488Z",
  "exit": 1,
  "signal": null,
  "error": null
}
```

### baseline-audit — complete stdout JSON

```text
{
  "auditReportVersion": 2,
  "vulnerabilities": {
    "@babel/core": {
      "name": "@babel/core",
      "severity": "low",
      "isDirect": false,
      "via": [
        {
          "source": 1123528,
          "name": "@babel/core",
          "dependency": "@babel/core",
          "title": "@babel/core: Arbitrary File Read via sourceMappingURL Comment",
          "url": "https://github.com/advisories/GHSA-4x5r-pxfx-6jf8",
          "severity": "low",
          "cwe": [
            "CWE-22",
            "CWE-200"
          ],
          "cvss": {
            "score": 3.2,
            "vectorString": "CVSS:3.1/AV:L/AC:H/PR:N/UI:N/S:C/C:L/I:N/A:N"
          },
          "range": "<=7.29.0"
        }
      ],
      "effects": [],
      "range": "<=7.29.0",
      "nodes": [
        "node_modules/@babel/core"
      ],
      "fixAvailable": true
    },
    "@babel/plugin-transform-modules-systemjs": {
      "name": "@babel/plugin-transform-modules-systemjs",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1120258,
          "name": "@babel/plugin-transform-modules-systemjs",
          "dependency": "@babel/plugin-transform-modules-systemjs",
          "title": "@babel/plugin-transform-modules-systemjs generates arbitrary code when compiling malicious input",
          "url": "https://github.com/advisories/GHSA-fv7c-fp4j-7gwp",
          "severity": "high",
          "cwe": [
            "CWE-94",
            "CWE-843"
          ],
          "cvss": {
            "score": 8.2,
            "vectorString": "CVSS:3.1/AV:L/AC:L/PR:L/UI:R/S:C/C:H/I:H/A:H"
          },
          "range": ">=7.12.0 <=7.29.3"
        }
      ],
      "effects": [],
      "range": "7.12.0 - 7.29.0",
      "nodes": [
        "node_modules/@babel/plugin-transform-modules-systemjs"
      ],
      "fixAvailable": true
    },
    "@humanfs/node": {
      "name": "@humanfs/node",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        {
          "source": 1158499,
          "name": "@humanfs/node",
          "dependency": "@humanfs/node",
          "title": "humanfs: Recursive copy follows symlinked files and copies data from outside the source tree",
          "url": "https://github.com/advisories/GHSA-p498-v437-472g",
          "severity": "moderate",
          "cwe": [
            "CWE-22"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": "<0.16.8"
        }
      ],
      "effects": [],
      "range": "<0.16.8",
      "nodes": [
        "node_modules/@humanfs/node"
      ],
      "fixAvailable": true
    },
    "@isaacs/brace-expansion": {
      "name": "@isaacs/brace-expansion",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1112954,
          "name": "@isaacs/brace-expansion",
          "dependency": "@isaacs/brace-expansion",
          "title": "@isaacs/brace-expansion has Uncontrolled Resource Consumption",
          "url": "https://github.com/advisories/GHSA-7h2j-956f-4vf2",
          "severity": "high",
          "cwe": [
            "CWE-1333"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": "<=5.0.0"
        }
      ],
      "effects": [],
      "range": "5.0.0",
      "nodes": [
        "node_modules/@isaacs/brace-expansion"
      ],
      "fixAvailable": true
    },
    "@rollup/plugin-node-resolve": {
      "name": "@rollup/plugin-node-resolve",
      "severity": "low",
      "isDirect": false,
      "via": [
        "deepmerge"
      ],
      "effects": [
        "workbox-build"
      ],
      "range": ">=8.0.0",
      "nodes": [
        "node_modules/@rollup/plugin-node-resolve"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    },
    "@rollup/plugin-terser": {
      "name": "@rollup/plugin-terser",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        "serialize-javascript"
      ],
      "effects": [
        "workbox-build"
      ],
      "range": "0.2.0 - 0.4.4",
      "nodes": [
        "node_modules/@rollup/plugin-terser"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    },
    "@vitest/mocker": {
      "name": "@vitest/mocker",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        {
          "source": 1193684,
          "name": "@vitest/mocker",
          "dependency": "@vitest/mocker",
          "title": "Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock",
          "url": "https://github.com/advisories/GHSA-82fw-gwwq-j7x9",
          "severity": "moderate",
          "cwe": [
            "CWE-22"
          ],
          "cvss": {
            "score": 5.9,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N"
          },
          "range": ">=2.1.0 <4.1.11"
        },
        {
          "source": 1242767,
          "name": "@vitest/mocker",
          "dependency": "@vitest/mocker",
          "title": "Vitest: Code injection via unauthenticated manual mock registration",
          "url": "https://github.com/advisories/GHSA-qxg6-89mg-rqv8",
          "severity": "moderate",
          "cwe": [
            "CWE-94",
            "CWE-116",
            "CWE-306"
          ],
          "cvss": {
            "score": 4.7,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:C/C:L/I:L/A:N"
          },
          "range": ">=2.1.0-beta.7 <4.1.12"
        }
      ],
      "effects": [
        "vitest"
      ],
      "range": "<=4.1.11",
      "nodes": [
        "node_modules/@vitest/mocker"
      ],
      "fixAvailable": true
    },
    "@vitest/ui": {
      "name": "@vitest/ui",
      "severity": "critical",
      "isDirect": true,
      "via": [
        "vitest"
      ],
      "effects": [
        "vitest"
      ],
      "range": "4.0.0-beta.1 - 4.1.0-beta.6",
      "nodes": [
        "node_modules/@vitest/ui"
      ],
      "fixAvailable": true
    },
    "ajv": {
      "name": "ajv",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        {
          "source": 1113714,
          "name": "ajv",
          "dependency": "ajv",
          "title": "ajv has ReDoS when using `$data` option",
          "url": "https://github.com/advisories/GHSA-2g4f-4pwh-qvx6",
          "severity": "moderate",
          "cwe": [
            "CWE-400",
            "CWE-1333"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": "<6.14.0"
        },
        {
          "source": 1113715,
          "name": "ajv",
          "dependency": "ajv",
          "title": "ajv has ReDoS when using `$data` option",
          "url": "https://github.com/advisories/GHSA-2g4f-4pwh-qvx6",
          "severity": "moderate",
          "cwe": [
            "CWE-400",
            "CWE-1333"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=7.0.0-alpha.0 <8.18.0"
        }
      ],
      "effects": [],
      "range": "<6.14.0 || >=7.0.0-alpha.0 <8.18.0",
      "nodes": [
        "node_modules/ajv",
        "node_modules/workbox-build/node_modules/ajv"
      ],
      "fixAvailable": true
    },
    "baseline-browser-mapping": {
      "name": "baseline-browser-mapping",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        {
          "source": 1193686,
          "name": "baseline-browser-mapping",
          "dependency": "baseline-browser-mapping",
          "title": "baseline-browser-mapping process termination on invalid input causes denial of service",
          "url": "https://github.com/advisories/GHSA-w5vr-8v7q-w6rv",
          "severity": "moderate",
          "cwe": [
            "CWE-705"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=2.0.0 <2.11.0"
        }
      ],
      "effects": [],
      "range": ">=2.0.0 <2.11.0",
      "nodes": [
        "node_modules/baseline-browser-mapping"
      ],
      "fixAvailable": true
    },
    "brace-expansion": {
      "name": "brace-expansion",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1115540,
          "name": "brace-expansion",
          "dependency": "brace-expansion",
          "title": "brace-expansion: Zero-step sequence causes process hang and memory exhaustion",
          "url": "https://github.com/advisories/GHSA-f886-m6hf-6m8v",
          "severity": "moderate",
          "cwe": [
            "CWE-400"
          ],
          "cvss": {
            "score": 6.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:N/A:H"
          },
          "range": "<1.1.13"
        },
        {
          "source": 1115541,
          "name": "brace-expansion",
          "dependency": "brace-expansion",
          "title": "brace-expansion: Zero-step sequence causes process hang and memory exhaustion",
          "url": "https://github.com/advisories/GHSA-f886-m6hf-6m8v",
          "severity": "moderate",
          "cwe": [
            "CWE-400"
          ],
          "cvss": {
            "score": 6.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:N/A:H"
          },
          "range": ">=2.0.0 <2.0.3"
        },
        {
          "source": 1123896,
          "name": "brace-expansion",
          "dependency": "brace-expansion",
          "title": "brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups",
          "url": "https://github.com/advisories/GHSA-3jxr-9vmj-r5cp",
          "severity": "high",
          "cwe": [
            "CWE-400",
            "CWE-407"
          ],
          "cvss": {
            "score": 5.3,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"
          },
          "range": ">=2.0.0 <2.1.2"
        },
        {
          "source": 1123897,
          "name": "brace-expansion",
          "dependency": "brace-expansion",
          "title": "brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups",
          "url": "https://github.com/advisories/GHSA-3jxr-9vmj-r5cp",
          "severity": "high",
          "cwe": [
            "CWE-400",
            "CWE-407"
          ],
          "cvss": {
            "score": 5.3,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"
          },
          "range": "<1.1.16"
        },
        {
          "source": 1130588,
          "name": "brace-expansion",
          "dependency": "brace-expansion",
          "title": "brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash",
          "url": "https://github.com/advisories/GHSA-mh99-v99m-4gvg",
          "severity": "high",
          "cwe": [
            "CWE-400",
            "CWE-770"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": "<1.1.17"
        },
        {
          "source": 1130589,
          "name": "brace-expansion",
          "dependency": "brace-expansion",
          "title": "brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash",
          "url": "https://github.com/advisories/GHSA-mh99-v99m-4gvg",
          "severity": "high",
          "cwe": [
            "CWE-400",
            "CWE-770"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=2.0.0 <2.1.3"
        },
        {
          "source": 1130736,
          "name": "brace-expansion",
          "dependency": "brace-expansion",
          "title": "brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation",
          "url": "https://github.com/advisories/GHSA-rgw5-rvv9-x895",
          "severity": "high",
          "cwe": [
            "CWE-400",
            "CWE-770"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=2.0.0 <2.1.4"
        },
        {
          "source": 1130737,
          "name": "brace-expansion",
          "dependency": "brace-expansion",
          "title": "brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation",
          "url": "https://github.com/advisories/GHSA-rgw5-rvv9-x895",
          "severity": "high",
          "cwe": [
            "CWE-400",
            "CWE-770"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": "<1.1.18"
        },
        {
          "source": 1240100,
          "name": "brace-expansion",
          "dependency": "brace-expansion",
          "title": "brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service",
          "url": "https://github.com/advisories/GHSA-q2hr-2g5m-vwhr",
          "severity": "moderate",
          "cwe": [
            "CWE-400",
            "CWE-407"
          ],
          "cvss": {
            "score": 5.3,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"
          },
          "range": "<1.1.21"
        },
        {
          "source": 1240101,
          "name": "brace-expansion",
          "dependency": "brace-expansion",
          "title": "brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service",
          "url": "https://github.com/advisories/GHSA-q2hr-2g5m-vwhr",
          "severity": "moderate",
          "cwe": [
            "CWE-400",
            "CWE-407"
          ],
          "cvss": {
            "score": 5.3,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"
          },
          "range": ">=2.0.0 <2.1.7"
        },
        {
          "source": 1240104,
          "name": "brace-expansion",
          "dependency": "brace-expansion",
          "title": "brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion",
          "url": "https://github.com/advisories/GHSA-qhr7-859c-m2p7",
          "severity": "high",
          "cwe": [
            "CWE-400",
            "CWE-674"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": "<1.1.20"
        },
        {
          "source": 1240105,
          "name": "brace-expansion",
          "dependency": "brace-expansion",
          "title": "brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion",
          "url": "https://github.com/advisories/GHSA-qhr7-859c-m2p7",
          "severity": "high",
          "cwe": [
            "CWE-400",
            "CWE-674"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=2.0.0 <2.1.6"
        },
        {
          "source": 1240108,
          "name": "brace-expansion",
          "dependency": "brace-expansion",
          "title": "brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion",
          "url": "https://github.com/advisories/GHSA-6j4f-fj2g-mc7p",
          "severity": "high",
          "cwe": [
            "CWE-400",
            "CWE-674"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": "<1.1.19"
        },
        {
          "source": 1240109,
          "name": "brace-expansion",
          "dependency": "brace-expansion",
          "title": "brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion",
          "url": "https://github.com/advisories/GHSA-6j4f-fj2g-mc7p",
          "severity": "high",
          "cwe": [
            "CWE-400",
            "CWE-674"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=2.0.0 <2.1.5"
        }
      ],
      "effects": [],
      "range": "<=1.1.20 || 2.0.0 - 2.1.6",
      "nodes": [
        "node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion",
        "node_modules/brace-expansion",
        "node_modules/filelist/node_modules/brace-expansion"
      ],
      "fixAvailable": true
    },
    "browserslist": {
      "name": "browserslist",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1153171,
          "name": "browserslist",
          "dependency": "browserslist",
          "title": "Browserslist: Unbounded memory growth (no cache eviction) via distinct query results, leading to eventual OOM",
          "url": "https://github.com/advisories/GHSA-c83g-rgw3-j3cx",
          "severity": "high",
          "cwe": [
            "CWE-770"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": "<=4.28.6"
        },
        {
          "source": 1153172,
          "name": "browserslist",
          "dependency": "browserslist",
          "title": "Browserslist: Uncaught crash / prototype write via untrusted browserslist-stats.json custom stats (normalizeStats)",
          "url": "https://github.com/advisories/GHSA-73wf-gq98-2v4g",
          "severity": "high",
          "cwe": [
            "CWE-248",
            "CWE-1321"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": "<=4.28.6"
        }
      ],
      "effects": [],
      "range": "<=4.28.6",
      "nodes": [
        "node_modules/browserslist"
      ],
      "fixAvailable": true
    },
    "deepmerge": {
      "name": "deepmerge",
      "severity": "low",
      "isDirect": false,
      "via": [
        {
          "source": 1243505,
          "name": "deepmerge",
          "dependency": "deepmerge",
          "title": "deepmerge mergeObject() allows prototype poisoning of returned objects",
          "url": "https://github.com/advisories/GHSA-gcqx-w48m-w2h4",
          "severity": "low",
          "cwe": [
            "CWE-1321"
          ],
          "cvss": {
            "score": 5.3,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N"
          },
          "range": ">=4.2.0 <=4.3.1"
        }
      ],
      "effects": [
        "@rollup/plugin-node-resolve"
      ],
      "range": ">=4.2.0",
      "nodes": [
        "node_modules/deepmerge"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    },
    "fast-uri": {
      "name": "fast-uri",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1124064,
          "name": "fast-uri",
          "dependency": "fast-uri",
          "title": "fast-uri vulnerable to host confusion via literal backslash authority delimiter",
          "url": "https://github.com/advisories/GHSA-v2hh-gcrm-f6hx",
          "severity": "high",
          "cwe": [
            "CWE-436"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N"
          },
          "range": ">=3.0.0 <=3.1.3"
        },
        {
          "source": 1130720,
          "name": "fast-uri",
          "dependency": "fast-uri",
          "title": "fast-uri vulnerable to host confusion via backslash authority introducer",
          "url": "https://github.com/advisories/GHSA-7p8r-x3mc-p8w7",
          "severity": "high",
          "cwe": [
            "CWE-436"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N"
          },
          "range": ">=3.0.0 <3.1.5"
        },
        {
          "source": 1145559,
          "name": "fast-uri",
          "dependency": "fast-uri",
          "title": "fast-uri vulnerable to path traversal via percent-encoded dot segments",
          "url": "https://github.com/advisories/GHSA-q3j6-qgpj-74h6",
          "severity": "high",
          "cwe": [
            "CWE-22"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N"
          },
          "range": ">=3.0.0 <=3.1.0"
        },
        {
          "source": 1153168,
          "name": "fast-uri",
          "dependency": "fast-uri",
          "title": "fast-uri vulnerable to host confusion via percent-encoded authority delimiters",
          "url": "https://github.com/advisories/GHSA-v39h-62p7-jpjc",
          "severity": "high",
          "cwe": [
            "CWE-140",
            "CWE-436"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N"
          },
          "range": ">=3.0.0 <=3.1.1"
        },
        {
          "source": 1158524,
          "name": "fast-uri",
          "dependency": "fast-uri",
          "title": "fast-uri vulnerable to server-side request forgery via malformed IPv6 normalization",
          "url": "https://github.com/advisories/GHSA-f65p-4m7j-42xc",
          "severity": "high",
          "cwe": [
            "CWE-20",
            "CWE-918"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N"
          },
          "range": ">=3.0.0 <3.1.6"
        },
        {
          "source": 1158530,
          "name": "fast-uri",
          "dependency": "fast-uri",
          "title": "fast-uri vulnerable to host confusion via percent-encoded scheme normalization",
          "url": "https://github.com/advisories/GHSA-jqff-g426-hqxp",
          "severity": "high",
          "cwe": [
            "CWE-177"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N"
          },
          "range": ">=3.0.0 <3.1.6"
        },
        {
          "source": 1204921,
          "name": "fast-uri",
          "dependency": "fast-uri",
          "title": "fast-uri vulnerable to host confusion via failed IDN canonicalization",
          "url": "https://github.com/advisories/GHSA-4c8g-83qw-93j6",
          "severity": "high",
          "cwe": [
            "CWE-436",
            "CWE-551"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N"
          },
          "range": ">=3.0.0 <3.1.3"
        },
        {
          "source": 1239943,
          "name": "fast-uri",
          "dependency": "fast-uri",
          "title": "fast-uri vulnerable to authority injection via an unvalidated port in serialize",
          "url": "https://github.com/advisories/GHSA-qw65-cvwx-89v3",
          "severity": "high",
          "cwe": [
            "CWE-116"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N"
          },
          "range": ">=3.0.0 <3.1.7"
        },
        {
          "source": 1240091,
          "name": "fast-uri",
          "dependency": "fast-uri",
          "title": "fast-uri vulnerable to inconsistent host case normalization via percent-encoded octets",
          "url": "https://github.com/advisories/GHSA-hrr3-gc8f-f4qj",
          "severity": "moderate",
          "cwe": [
            "CWE-178"
          ],
          "cvss": {
            "score": 4.8,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N"
          },
          "range": ">=3.0.0 <3.1.8"
        },
        {
          "source": 1243098,
          "name": "fast-uri",
          "dependency": "fast-uri",
          "title": "fast-uri vulnerable to URI scheme spoofing via percent-encoded scheme decoding",
          "url": "https://github.com/advisories/GHSA-w74x-v6f9-j3xg",
          "severity": "moderate",
          "cwe": [
            "CWE-172",
            "CWE-180"
          ],
          "cvss": {
            "score": 6.1,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N"
          },
          "range": ">=3.0.0 <3.1.9"
        },
        {
          "source": 1243101,
          "name": "fast-uri",
          "dependency": "fast-uri",
          "title": "fast-uri vulnerable to improper path equivalence in relative reference normalization",
          "url": "https://github.com/advisories/GHSA-xhq7-xmqj-769h",
          "severity": "low",
          "cwe": [
            "CWE-41"
          ],
          "cvss": {
            "score": 3.7,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N"
          },
          "range": ">=3.0.0 <3.1.9"
        },
        {
          "source": 1243107,
          "name": "fast-uri",
          "dependency": "fast-uri",
          "title": "fast-uri vulnerable to scheme injection via an unescaped first-segment colon in suffix references",
          "url": "https://github.com/advisories/GHSA-333x-w4r6-6crp",
          "severity": "low",
          "cwe": [
            "CWE-41",
            "CWE-116"
          ],
          "cvss": {
            "score": 3.7,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N"
          },
          "range": ">=3.0.0 <3.1.9"
        }
      ],
      "effects": [],
      "range": "3.0.0 - 3.1.8",
      "nodes": [
        "node_modules/fast-uri"
      ],
      "fixAvailable": true
    },
    "flatted": {
      "name": "flatted",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1114526,
          "name": "flatted",
          "dependency": "flatted",
          "title": "flatted vulnerable to unbounded recursion DoS in parse() revive phase",
          "url": "https://github.com/advisories/GHSA-25h7-pfq9-p65f",
          "severity": "high",
          "cwe": [
            "CWE-674"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": "<3.4.0"
        },
        {
          "source": 1241196,
          "name": "flatted",
          "dependency": "flatted",
          "title": "Prototype Pollution via parse() in NodeJS flatted",
          "url": "https://github.com/advisories/GHSA-rf6f-7fwh-wjgh",
          "severity": "high",
          "cwe": [
            "CWE-915",
            "CWE-1321"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": "<=3.4.1"
        }
      ],
      "effects": [],
      "range": "<=3.4.1",
      "nodes": [
        "node_modules/flatted"
      ],
      "fixAvailable": true
    },
    "glob": {
      "name": "glob",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        {
          "source": 1244013,
          "name": "glob",
          "dependency": "glob",
          "title": "Glob: AbortSignal cancellation bypass allows post-timeout filesystem traversal",
          "url": "https://github.com/advisories/GHSA-3g3m-2fjr-6pw4",
          "severity": "moderate",
          "cwe": [
            "CWE-400"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=9.0.0 <=14.0.1"
        }
      ],
      "effects": [
        "workbox-build"
      ],
      "range": "9.0.0 - 14.0.1",
      "nodes": [
        "node_modules/glob"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    },
    "js-yaml": {
      "name": "js-yaml",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1121860,
          "name": "js-yaml",
          "dependency": "js-yaml",
          "title": "JS-YAML: Quadratic-complexity DoS in merge key handling via repeated aliases",
          "url": "https://github.com/advisories/GHSA-h67p-54hq-rp68",
          "severity": "moderate",
          "cwe": [
            "CWE-407"
          ],
          "cvss": {
            "score": 5.3,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"
          },
          "range": ">=4.0.0 <=4.1.1"
        },
        {
          "source": 1123911,
          "name": "js-yaml",
          "dependency": "js-yaml",
          "title": "js-yaml: YAML merge-key chains can force quadratic CPU consumption",
          "url": "https://github.com/advisories/GHSA-52cp-r559-cp3m",
          "severity": "high",
          "cwe": [
            "CWE-400",
            "CWE-407"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=4.0.0 <4.3.0"
        },
        {
          "source": 1138115,
          "name": "js-yaml",
          "dependency": "js-yaml",
          "title": "JS-YAML: Quadratic CPU consumption in !!omap resolution (3.x and 4.x) — CVE-2026-59870 fix not backported",
          "url": "https://github.com/advisories/GHSA-5p4m-2wfm-xmqj",
          "severity": "high",
          "cwe": [
            "CWE-407"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=4.0.0 <4.3.1"
        },
        {
          "source": 1193727,
          "name": "js-yaml",
          "dependency": "js-yaml",
          "title": "js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources",
          "url": "https://github.com/advisories/GHSA-2883-xcg3-v3hh",
          "severity": "high",
          "cwe": [
            "CWE-400",
            "CWE-407"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=4.0.0 <4.3.2"
        }
      ],
      "effects": [],
      "range": "4.0.0 - 4.3.1",
      "nodes": [
        "node_modules/js-yaml"
      ],
      "fixAvailable": true
    },
    "lodash": {
      "name": "lodash",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1115806,
          "name": "lodash",
          "dependency": "lodash",
          "title": "lodash vulnerable to Code Injection via `_.template` imports key names",
          "url": "https://github.com/advisories/GHSA-r5fr-rjxr-66jc",
          "severity": "high",
          "cwe": [
            "CWE-94"
          ],
          "cvss": {
            "score": 8.1,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H"
          },
          "range": ">=4.0.0 <=4.17.23"
        },
        {
          "source": 1244531,
          "name": "lodash",
          "dependency": "lodash",
          "title": "Lodash has Prototype Pollution Vulnerability in `_.unset`, `_.omit`, and `_.pullAt` functions",
          "url": "https://github.com/advisories/GHSA-xxjr-mmjv-4gpg",
          "severity": "moderate",
          "cwe": [
            "CWE-1321"
          ],
          "cvss": {
            "score": 6.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L"
          },
          "range": ">=4.0.0 <=4.17.22"
        }
      ],
      "effects": [],
      "range": "4.0.0 - 4.17.23",
      "nodes": [
        "node_modules/lodash"
      ],
      "fixAvailable": true
    },
    "minimatch": {
      "name": "minimatch",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1113459,
          "name": "minimatch",
          "dependency": "minimatch",
          "title": "minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern",
          "url": "https://github.com/advisories/GHSA-3ppc-4f35-3m26",
          "severity": "high",
          "cwe": [
            "CWE-1333"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": "<3.1.3"
        },
        {
          "source": 1113461,
          "name": "minimatch",
          "dependency": "minimatch",
          "title": "minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern",
          "url": "https://github.com/advisories/GHSA-3ppc-4f35-3m26",
          "severity": "high",
          "cwe": [
            "CWE-1333"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=5.0.0 <5.1.7"
        },
        {
          "source": 1113465,
          "name": "minimatch",
          "dependency": "minimatch",
          "title": "minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern",
          "url": "https://github.com/advisories/GHSA-3ppc-4f35-3m26",
          "severity": "high",
          "cwe": [
            "CWE-1333"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=9.0.0 <9.0.6"
        },
        {
          "source": 1113466,
          "name": "minimatch",
          "dependency": "minimatch",
          "title": "minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern",
          "url": "https://github.com/advisories/GHSA-3ppc-4f35-3m26",
          "severity": "high",
          "cwe": [
            "CWE-1333"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=10.0.0 <10.2.1"
        },
        {
          "source": 1113538,
          "name": "minimatch",
          "dependency": "minimatch",
          "title": "minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments",
          "url": "https://github.com/advisories/GHSA-7r86-cg39-jmmj",
          "severity": "high",
          "cwe": [
            "CWE-407"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": "<3.1.3"
        },
        {
          "source": 1113540,
          "name": "minimatch",
          "dependency": "minimatch",
          "title": "minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments",
          "url": "https://github.com/advisories/GHSA-7r86-cg39-jmmj",
          "severity": "high",
          "cwe": [
            "CWE-407"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=5.0.0 <5.1.8"
        },
        {
          "source": 1113544,
          "name": "minimatch",
          "dependency": "minimatch",
          "title": "minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments",
          "url": "https://github.com/advisories/GHSA-7r86-cg39-jmmj",
          "severity": "high",
          "cwe": [
            "CWE-407"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=9.0.0 <9.0.7"
        },
        {
          "source": 1113545,
          "name": "minimatch",
          "dependency": "minimatch",
          "title": "minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments",
          "url": "https://github.com/advisories/GHSA-7r86-cg39-jmmj",
          "severity": "high",
          "cwe": [
            "CWE-407"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=10.0.0 <10.2.3"
        },
        {
          "source": 1113546,
          "name": "minimatch",
          "dependency": "minimatch",
          "title": "minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions",
          "url": "https://github.com/advisories/GHSA-23c5-xmqv-rm74",
          "severity": "high",
          "cwe": [
            "CWE-1333"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": "<3.1.4"
        },
        {
          "source": 1113548,
          "name": "minimatch",
          "dependency": "minimatch",
          "title": "minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions",
          "url": "https://github.com/advisories/GHSA-23c5-xmqv-rm74",
          "severity": "high",
          "cwe": [
            "CWE-1333"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=5.0.0 <5.1.8"
        },
        {
          "source": 1113552,
          "name": "minimatch",
          "dependency": "minimatch",
          "title": "minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions",
          "url": "https://github.com/advisories/GHSA-23c5-xmqv-rm74",
          "severity": "high",
          "cwe": [
            "CWE-1333"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=9.0.0 <9.0.7"
        },
        {
          "source": 1113553,
          "name": "minimatch",
          "dependency": "minimatch",
          "title": "minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions",
          "url": "https://github.com/advisories/GHSA-23c5-xmqv-rm74",
          "severity": "high",
          "cwe": [
            "CWE-1333"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=10.0.0 <10.2.3"
        },
        {
          "source": 1244623,
          "name": "minimatch",
          "dependency": "minimatch",
          "title": "minimatch has potential denial of service via globparts amplification",
          "url": "https://github.com/advisories/GHSA-g3hv-75wg-m249",
          "severity": "moderate",
          "cwe": [
            "CWE-405"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=7.0.0 <11.0.1"
        }
      ],
      "effects": [],
      "range": "<=3.1.3 || 5.0.0 - 5.1.7 || 7.0.0 - 11.0.0",
      "nodes": [
        "node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch",
        "node_modules/filelist/node_modules/minimatch",
        "node_modules/glob/node_modules/minimatch",
        "node_modules/minimatch"
      ],
      "fixAvailable": true
    },
    "nanoid": {
      "name": "nanoid",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1138811,
          "name": "nanoid",
          "dependency": "nanoid",
          "title": "nanoid: non-secure generators can loop indefinitely with negative size",
          "url": "https://github.com/advisories/GHSA-28wg-ghj8-5hjv",
          "severity": "high",
          "cwe": [
            "CWE-835"
          ],
          "cvss": {
            "score": 5.9,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": "<3.3.16"
        },
        {
          "source": 1139427,
          "name": "nanoid",
          "dependency": "nanoid",
          "title": "nanoid: custom generators can loop indefinitely when size is zero",
          "url": "https://github.com/advisories/GHSA-2v37-7h3g-55p8",
          "severity": "high",
          "cwe": [
            "CWE-835"
          ],
          "cvss": {
            "score": 5.9,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": "<3.3.18"
        },
        {
          "source": 1153189,
          "name": "nanoid",
          "dependency": "nanoid",
          "title": "nanoid: Integer Overflow or Wraparound",
          "url": "https://github.com/advisories/GHSA-xwg4-73v4-xw9w",
          "severity": "high",
          "cwe": [
            "CWE-190"
          ],
          "cvss": {
            "score": 7.4,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N"
          },
          "range": "<3.3.12"
        }
      ],
      "effects": [],
      "range": "<=3.3.17",
      "nodes": [
        "node_modules/nanoid"
      ],
      "fixAvailable": true
    },
    "picomatch": {
      "name": "picomatch",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1115549,
          "name": "picomatch",
          "dependency": "picomatch",
          "title": "Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching",
          "url": "https://github.com/advisories/GHSA-3v7f-55p6-f55p",
          "severity": "moderate",
          "cwe": [
            "CWE-1321"
          ],
          "cvss": {
            "score": 5.3,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N"
          },
          "range": "<2.3.2"
        },
        {
          "source": 1115551,
          "name": "picomatch",
          "dependency": "picomatch",
          "title": "Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching",
          "url": "https://github.com/advisories/GHSA-3v7f-55p6-f55p",
          "severity": "moderate",
          "cwe": [
            "CWE-1321"
          ],
          "cvss": {
            "score": 5.3,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N"
          },
          "range": ">=4.0.0 <4.0.4"
        },
        {
          "source": 1115552,
          "name": "picomatch",
          "dependency": "picomatch",
          "title": "Picomatch has a ReDoS vulnerability via extglob quantifiers",
          "url": "https://github.com/advisories/GHSA-c2c7-rcm5-vvqj",
          "severity": "high",
          "cwe": [
            "CWE-1333"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": "<2.3.2"
        },
        {
          "source": 1115554,
          "name": "picomatch",
          "dependency": "picomatch",
          "title": "Picomatch has a ReDoS vulnerability via extglob quantifiers",
          "url": "https://github.com/advisories/GHSA-c2c7-rcm5-vvqj",
          "severity": "high",
          "cwe": [
            "CWE-1333"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=4.0.0 <4.0.4"
        }
      ],
      "effects": [],
      "range": "<=2.3.1 || 4.0.0 - 4.0.3",
      "nodes": [
        "node_modules/picomatch",
        "node_modules/workbox-build/node_modules/picomatch"
      ],
      "fixAvailable": true
    },
    "postcss": {
      "name": "postcss",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1117015,
          "name": "postcss",
          "dependency": "postcss",
          "title": "PostCSS has XSS via Unescaped </style> in its CSS Stringify Output",
          "url": "https://github.com/advisories/GHSA-qx2v-qp2m-jg93",
          "severity": "moderate",
          "cwe": [
            "CWE-79"
          ],
          "cvss": {
            "score": 6.1,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N"
          },
          "range": "<8.5.10"
        },
        {
          "source": 1124252,
          "name": "postcss",
          "dependency": "postcss",
          "title": "PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments",
          "url": "https://github.com/advisories/GHSA-6g55-p6wh-862q",
          "severity": "high",
          "cwe": [
            "CWE-22",
            "CWE-200"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N"
          },
          "range": "<=8.5.11"
        },
        {
          "source": 1130709,
          "name": "postcss",
          "dependency": "postcss",
          "title": "PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset",
          "url": "https://github.com/advisories/GHSA-fxqj-rqcc-2cmp",
          "severity": "moderate",
          "cwe": [
            "CWE-22",
            "CWE-200"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": "<=8.5.22"
        },
        {
          "source": 1139510,
          "name": "postcss",
          "dependency": "postcss",
          "title": "PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure",
          "url": "https://github.com/advisories/GHSA-r28c-9q8g-f849",
          "severity": "high",
          "cwe": [
            "CWE-22"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N"
          },
          "range": "<=8.5.17"
        }
      ],
      "effects": [],
      "range": "<=8.5.22",
      "nodes": [
        "node_modules/postcss"
      ],
      "fixAvailable": true
    },
    "react-router": {
      "name": "react-router",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1112053,
          "name": "react-router",
          "dependency": "react-router",
          "title": "React Router vulnerable to XSS via Open Redirects",
          "url": "https://github.com/advisories/GHSA-2w69-qvjg-hvjx",
          "severity": "high",
          "cwe": [
            "CWE-79"
          ],
          "cvss": {
            "score": 8,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:C/C:H/I:H/A:N"
          },
          "range": ">=7.0.0 <=7.11.0"
        },
        {
          "source": 1120063,
          "name": "react-router",
          "dependency": "react-router",
          "title": "React Router's vendored turbo-stream v2 allows arbitrary constructor invocation via TYPE_ERROR deserialization leading to Unauth RCE",
          "url": "https://github.com/advisories/GHSA-49rj-9fvp-4h2h",
          "severity": "high",
          "cwe": [
            "CWE-502"
          ],
          "cvss": {
            "score": 8.1,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H"
          },
          "range": ">=7.0.0 <=7.14.1"
        },
        {
          "source": 1120066,
          "name": "react-router",
          "dependency": "react-router",
          "title": "React Router vulnerable to XSS in unstable RSC redirect handling via javascript: redirect targets",
          "url": "https://github.com/advisories/GHSA-8646-j5j9-6r62",
          "severity": "high",
          "cwe": [
            "CWE-79"
          ],
          "cvss": {
            "score": 8,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:C/C:H/I:H/A:N"
          },
          "range": ">=7.7.0 <7.13.2"
        },
        {
          "source": 1120069,
          "name": "react-router",
          "dependency": "react-router",
          "title": "React Router vulnerable to DoS via unbounded path expansion in __manifest endpoint",
          "url": "https://github.com/advisories/GHSA-8x6r-g9mw-2r78",
          "severity": "high",
          "cwe": [
            "CWE-400"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=7.0.0 <7.15.0"
        },
        {
          "source": 1120081,
          "name": "react-router",
          "dependency": "react-router",
          "title": "React Router vulnerable to Denial of Service via reflected user input in single-fetch",
          "url": "https://github.com/advisories/GHSA-rxv8-25v2-qmq8",
          "severity": "high",
          "cwe": [
            "CWE-770"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=7.0.0 <7.14.0"
        },
        {
          "source": 1120382,
          "name": "react-router",
          "dependency": "react-router",
          "title": "React Router has CSRF issue in Action/Server Action Request Processing",
          "url": "https://github.com/advisories/GHSA-h5cw-625j-3rxh",
          "severity": "moderate",
          "cwe": [
            "CWE-346",
            "CWE-352"
          ],
          "cvss": {
            "score": 6.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N"
          },
          "range": ">=7.0.0 <=7.11.0"
        },
        {
          "source": 1124268,
          "name": "react-router",
          "dependency": "react-router",
          "title": "React Router: Open redirect via backslash in <Link> and useNavigate (CVE-2025-68470 bypass)",
          "url": "https://github.com/advisories/GHSA-wrjc-x8rr-h8h6",
          "severity": "moderate",
          "cwe": [
            "CWE-601"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=6.0.0 <7.18.0"
        },
        {
          "source": 1124272,
          "name": "react-router",
          "dependency": "react-router",
          "title": "React Router: Arbitrary Constructor Injection via deserializeErrors() in React Router SSR Hydration",
          "url": "https://github.com/advisories/GHSA-337j-9hxr-rhxg",
          "severity": "moderate",
          "cwe": [
            "CWE-470"
          ],
          "cvss": {
            "score": 6.1,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N"
          },
          "range": ">=6.4.0 <7.18.0"
        },
        {
          "source": 1124276,
          "name": "react-router",
          "dependency": "react-router",
          "title": "React Router: Unauthenticated Denial of Service via Inefficient Route Matching",
          "url": "https://github.com/advisories/GHSA-chx6-hx7r-mcp5",
          "severity": "high",
          "cwe": [
            "CWE-400",
            "CWE-407"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=7.0.0 <7.18.0"
        },
        {
          "source": 1136304,
          "name": "react-router",
          "dependency": "react-router",
          "title": "React Router's same-origin redirect with path starting // causes open redirect via protocol-relative URL reinterpretation",
          "url": "https://github.com/advisories/GHSA-2j2x-hqr9-3h42",
          "severity": "moderate",
          "cwe": [
            "CWE-601"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=7.0.0 <7.14.1"
        },
        {
          "source": 1193651,
          "name": "react-router",
          "dependency": "react-router",
          "title": "React Router: Open redirect leading to XSS",
          "url": "https://github.com/advisories/GHSA-jjmj-jmhj-qwj2",
          "severity": "moderate",
          "cwe": [
            "CWE-79",
            "CWE-601"
          ],
          "cvss": {
            "score": 6.9,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:C/C:H/I:L/A:N"
          },
          "range": ">=7.9.6 <=7.12.0"
        },
        {
          "source": 1193653,
          "name": "react-router",
          "dependency": "react-router",
          "title": "React Router has stored XSS via unescaped Location header in prerendered redirect HTML",
          "url": "https://github.com/advisories/GHSA-f22v-gfqf-p8f3",
          "severity": "moderate",
          "cwe": [
            "CWE-79"
          ],
          "cvss": {
            "score": 5.4,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N"
          },
          "range": ">=7.5.1 <7.13.2"
        },
        {
          "source": 1193655,
          "name": "react-router",
          "dependency": "react-router",
          "title": "React Router SSR XSS in ScrollRestoration",
          "url": "https://github.com/advisories/GHSA-8v8x-cx79-35w7",
          "severity": "high",
          "cwe": [
            "CWE-79"
          ],
          "cvss": {
            "score": 8.2,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:L/A:N"
          },
          "range": ">=7.0.0 <7.12.0"
        }
      ],
      "effects": [
        "react-router-dom"
      ],
      "range": "6.0.0 - 7.17.0",
      "nodes": [
        "node_modules/react-router"
      ],
      "fixAvailable": true
    },
    "react-router-dom": {
      "name": "react-router-dom",
      "severity": "high",
      "isDirect": true,
      "via": [
        "react-router"
      ],
      "effects": [],
      "range": "7.0.0-pre.0 - 7.11.0",
      "nodes": [
        "node_modules/react-router-dom"
      ],
      "fixAvailable": true
    },
    "rollup": {
      "name": "rollup",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1113515,
          "name": "rollup",
          "dependency": "rollup",
          "title": "Rollup 4 has Arbitrary File Write via Path Traversal",
          "url": "https://github.com/advisories/GHSA-mw96-cpmx-2vgc",
          "severity": "high",
          "cwe": [
            "CWE-22"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=4.0.0 <4.59.0"
        },
        {
          "source": 1113517,
          "name": "rollup",
          "dependency": "rollup",
          "title": "Rollup 4 has Arbitrary File Write via Path Traversal",
          "url": "https://github.com/advisories/GHSA-mw96-cpmx-2vgc",
          "severity": "high",
          "cwe": [
            "CWE-22"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": "<2.80.0"
        }
      ],
      "effects": [],
      "range": ">=4.0.0 <4.59.0 || <2.80.0",
      "nodes": [
        "node_modules/rollup",
        "node_modules/workbox-build/node_modules/rollup"
      ],
      "fixAvailable": true
    },
    "serialize-javascript": {
      "name": "serialize-javascript",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1113686,
          "name": "serialize-javascript",
          "dependency": "serialize-javascript",
          "title": "Serialize JavaScript is Vulnerable to RCE via RegExp.flags and Date.prototype.toISOString()",
          "url": "https://github.com/advisories/GHSA-5c6j-r48x-rmvq",
          "severity": "high",
          "cwe": [
            "CWE-96"
          ],
          "cvss": {
            "score": 8.1,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H"
          },
          "range": "<=7.0.2"
        },
        {
          "source": 1119440,
          "name": "serialize-javascript",
          "dependency": "serialize-javascript",
          "title": "Serialize JavaScript has CPU Exhaustion Denial of Service via crafted array-like objects",
          "url": "https://github.com/advisories/GHSA-qj8w-gfj5-8c6v",
          "severity": "moderate",
          "cwe": [
            "CWE-400",
            "CWE-834"
          ],
          "cvss": {
            "score": 5.9,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=5.0.0 <7.0.5"
        },
        {
          "source": 1243082,
          "name": "serialize-javascript",
          "dependency": "serialize-javascript",
          "title": "Serialize JavaScript: Cross-site scripting (XSS) via unescaped </script at the end of a serialized function body",
          "url": "https://github.com/advisories/GHSA-m5mm-p8h7-m29v",
          "severity": "low",
          "cwe": [
            "CWE-79"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": "<7.1.3"
        }
      ],
      "effects": [
        "@rollup/plugin-terser"
      ],
      "range": "<=7.1.2",
      "nodes": [
        "node_modules/serialize-javascript"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    },
    "source-map-js": {
      "name": "source-map-js",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1241209,
          "name": "source-map-js",
          "dependency": "source-map-js",
          "title": "source-map-js allows event-loop denial of service through indexed source-map section offsets",
          "url": "https://github.com/advisories/GHSA-68fv-2mgg-jv7q",
          "severity": "high",
          "cwe": [
            "CWE-1284"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=1.0.0 <1.2.2"
        }
      ],
      "effects": [],
      "range": "1.0.0 - 1.2.1",
      "nodes": [
        "node_modules/source-map-js"
      ],
      "fixAvailable": true
    },
    "vite": {
      "name": "vite",
      "severity": "high",
      "isDirect": true,
      "via": [
        {
          "source": 1116230,
          "name": "vite",
          "dependency": "vite",
          "title": "Vite Vulnerable to Path Traversal in Optimized Deps `.map` Handling",
          "url": "https://github.com/advisories/GHSA-4w7w-66w2-5vf9",
          "severity": "moderate",
          "cwe": [
            "CWE-22",
            "CWE-200"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=7.0.0 <=7.3.1"
        },
        {
          "source": 1116232,
          "name": "vite",
          "dependency": "vite",
          "title": "Vite: `server.fs.deny` bypassed with queries",
          "url": "https://github.com/advisories/GHSA-v2wj-q39q-566r",
          "severity": "high",
          "cwe": [
            "CWE-180",
            "CWE-284"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=7.1.0 <=7.3.1"
        },
        {
          "source": 1116235,
          "name": "vite",
          "dependency": "vite",
          "title": "Vite Vulnerable to Arbitrary File Read via Vite Dev Server WebSocket",
          "url": "https://github.com/advisories/GHSA-p9ff-h696-f583",
          "severity": "high",
          "cwe": [
            "CWE-200",
            "CWE-306"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=7.0.0 <=7.3.1"
        },
        {
          "source": 1120785,
          "name": "vite",
          "dependency": "vite",
          "title": "launch-editor: NTLMv2 hash disclosure via UNC path handling on Windows",
          "url": "https://github.com/advisories/GHSA-v6wh-96g9-6wx3",
          "severity": "moderate",
          "cwe": [
            "CWE-73",
            "CWE-522"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=7.0.0 <=7.3.4"
        },
        {
          "source": 1242623,
          "name": "vite",
          "dependency": "vite",
          "title": "launch-editor: escapeCmdArgs() omits % escaping on Windows",
          "url": "https://github.com/advisories/GHSA-698v-4r3x-3vcv",
          "severity": "moderate",
          "cwe": [
            "CWE-78"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=7.0.0 <=7.3.6"
        },
        {
          "source": 1242652,
          "name": "vite",
          "dependency": "vite",
          "title": "launch-editor: Editor CLI flag misinterpretation causing arbitrary command execution for some editors",
          "url": "https://github.com/advisories/GHSA-r825-w8mm-5pxw",
          "severity": "moderate",
          "cwe": [
            "CWE-88"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=7.0.0 <=7.3.6"
        },
        {
          "source": 1242659,
          "name": "vite",
          "dependency": "vite",
          "title": "launch-editor: `fs.existsSync()` existence check can be bypassed on Windows",
          "url": "https://github.com/advisories/GHSA-587h-7wmj-h5pm",
          "severity": "high",
          "cwe": [
            "CWE-77"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=7.0.0 <=7.3.6"
        },
        {
          "source": 1242725,
          "name": "vite",
          "dependency": "vite",
          "title": "Vite: Cross origin script execution through Vite custom middleware",
          "url": "https://github.com/advisories/GHSA-9jrq-w75r-8gcw",
          "severity": "low",
          "cwe": [
            "CWE-80"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=7.0.0 <=7.3.6"
        },
        {
          "source": 1242731,
          "name": "vite",
          "dependency": "vite",
          "title": "Vite: Files outside `server.fs.allow` could be served when project paths match system paths on non-Windows machine",
          "url": "https://github.com/advisories/GHSA-rq7h-c2jc-7f22",
          "severity": "moderate",
          "cwe": [
            "CWE-22",
            "CWE-284"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=7.0.0 <=7.3.6"
        },
        {
          "source": 1243433,
          "name": "vite",
          "dependency": "vite",
          "title": "vite: `server.fs.deny` bypass on Windows alternate paths",
          "url": "https://github.com/advisories/GHSA-fx2h-pf6j-xcff",
          "severity": "moderate",
          "cwe": [
            "CWE-22",
            "CWE-200"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=7.0.0 <=7.3.4"
        }
      ],
      "effects": [],
      "range": "7.0.0 - 7.3.6",
      "nodes": [
        "node_modules/vite"
      ],
      "fixAvailable": true
    },
    "vite-plugin-pwa": {
      "name": "vite-plugin-pwa",
      "severity": "moderate",
      "isDirect": true,
      "via": [
        "workbox-build"
      ],
      "effects": [],
      "range": ">=1.2.0",
      "nodes": [
        "node_modules/vite-plugin-pwa"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    },
    "vitest": {
      "name": "vitest",
      "severity": "critical",
      "isDirect": true,
      "via": [
        "@vitest/mocker",
        "@vitest/ui",
        {
          "source": 1139529,
          "name": "vitest",
          "dependency": "vitest",
          "title": "When Vitest UI server is listening, arbitrary file can be read and executed",
          "url": "https://github.com/advisories/GHSA-5xrq-8626-4rwp",
          "severity": "critical",
          "cwe": [
            "CWE-22",
            "CWE-862"
          ],
          "cvss": {
            "score": 9.8,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
          },
          "range": ">=4.0.0 <4.1.0"
        },
        {
          "source": 1193683,
          "name": "vitest",
          "dependency": "vitest",
          "title": "Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock",
          "url": "https://github.com/advisories/GHSA-82fw-gwwq-j7x9",
          "severity": "moderate",
          "cwe": [
            "CWE-22"
          ],
          "cvss": {
            "score": 5.9,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N"
          },
          "range": ">=2.1.0 <4.1.11"
        }
      ],
      "effects": [
        "@vitest/ui"
      ],
      "range": "2.1.0-beta.1 - 4.1.10",
      "nodes": [
        "node_modules/vitest"
      ],
      "fixAvailable": true
    },
    "workbox-build": {
      "name": "workbox-build",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        "@rollup/plugin-node-resolve",
        "@rollup/plugin-terser",
        "glob"
      ],
      "effects": [
        "vite-plugin-pwa"
      ],
      "range": ">=6.0.0-alpha.0",
      "nodes": [
        "node_modules/workbox-build"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    },
    "ws": {
      "name": "ws",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1119108,
          "name": "ws",
          "dependency": "ws",
          "title": "ws: Uninitialized memory disclosure",
          "url": "https://github.com/advisories/GHSA-58qx-3vcg-4xpx",
          "severity": "moderate",
          "cwe": [
            "CWE-908"
          ],
          "cvss": {
            "score": 4.4,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:H/UI:N/S:U/C:H/I:N/A:N"
          },
          "range": ">=8.0.0 <8.20.1"
        },
        {
          "source": 1123259,
          "name": "ws",
          "dependency": "ws",
          "title": "ws: Memory exhaustion DoS from tiny fragments and data chunks",
          "url": "https://github.com/advisories/GHSA-96hv-2xvq-fx4p",
          "severity": "high",
          "cwe": [
            "CWE-400",
            "CWE-770",
            "CWE-1050"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": ">=8.0.0 <8.21.0"
        }
      ],
      "effects": [],
      "range": "8.0.0 - 8.20.1",
      "nodes": [
        "node_modules/ws"
      ],
      "fixAvailable": true
    },
    "zod": {
      "name": "zod",
      "severity": "high",
      "isDirect": false,
      "via": [
        {
          "source": 1243066,
          "name": "zod",
          "dependency": "zod",
          "title": "Zod can exhaust memory while validating oversized constrained collections",
          "url": "https://github.com/advisories/GHSA-mrhx-c7xc-m3w5",
          "severity": "high",
          "cwe": [
            "CWE-770"
          ],
          "cvss": {
            "score": 7.5,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
          },
          "range": "<4.6.6"
        }
      ],
      "effects": [],
      "range": "<4.6.6",
      "nodes": [
        "node_modules/zod"
      ],
      "fixAvailable": true
    }
  },
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 3,
      "moderate": 8,
      "high": 20,
      "critical": 2,
      "total": 33
    },
    "dependencies": {
      "prod": 16,
      "dev": 611,
      "optional": 49,
      "peer": 7,
      "peerOptional": 0,
      "total": 626
    }
  }
}
```

### baseline-audit — complete stderr

```text

```

### post-audit — metadata

```text
{
  "command": [
    "npm",
    "audit",
    "--json"
  ],
  "started": "2026-11-16T06:36:18.373Z",
  "finished": "2026-11-16T06:36:21.662Z",
  "exit": 1,
  "signal": null,
  "error": null
}
```

### post-audit — complete stdout JSON

```text
{
  "auditReportVersion": 2,
  "vulnerabilities": {
    "@rollup/plugin-node-resolve": {
      "name": "@rollup/plugin-node-resolve",
      "severity": "low",
      "isDirect": false,
      "via": [
        "deepmerge"
      ],
      "effects": [
        "workbox-build"
      ],
      "range": ">=8.0.0",
      "nodes": [
        "node_modules/@rollup/plugin-node-resolve"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    },
    "@typescript-eslint/eslint-plugin": {
      "name": "@typescript-eslint/eslint-plugin",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        "@typescript-eslint/parser",
        "@typescript-eslint/type-utils",
        "@typescript-eslint/utils"
      ],
      "effects": [
        "typescript-eslint"
      ],
      "range": "6.16.0 - 8.72.2",
      "nodes": [
        "node_modules/@typescript-eslint/eslint-plugin"
      ],
      "fixAvailable": {
        "name": "typescript-eslint",
        "version": "8.36.0",
        "isSemVerMajor": true
      }
    },
    "@typescript-eslint/parser": {
      "name": "@typescript-eslint/parser",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        "@typescript-eslint/typescript-estree"
      ],
      "effects": [
        "@typescript-eslint/eslint-plugin",
        "typescript-eslint"
      ],
      "range": "6.16.0 - 8.72.2",
      "nodes": [
        "node_modules/@typescript-eslint/parser"
      ],
      "fixAvailable": {
        "name": "typescript-eslint",
        "version": "8.36.0",
        "isSemVerMajor": true
      }
    },
    "@typescript-eslint/type-utils": {
      "name": "@typescript-eslint/type-utils",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        "@typescript-eslint/typescript-estree",
        "@typescript-eslint/utils"
      ],
      "effects": [],
      "range": "6.16.0 - 8.72.2",
      "nodes": [
        "node_modules/@typescript-eslint/type-utils"
      ],
      "fixAvailable": true
    },
    "@typescript-eslint/typescript-estree": {
      "name": "@typescript-eslint/typescript-estree",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        "minimatch"
      ],
      "effects": [
        "@typescript-eslint/parser",
        "@typescript-eslint/type-utils",
        "@typescript-eslint/utils",
        "typescript-eslint"
      ],
      "range": "6.16.0 - 8.72.2",
      "nodes": [
        "node_modules/@typescript-eslint/typescript-estree"
      ],
      "fixAvailable": {
        "name": "typescript-eslint",
        "version": "8.36.0",
        "isSemVerMajor": true
      }
    },
    "@typescript-eslint/utils": {
      "name": "@typescript-eslint/utils",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        "@typescript-eslint/typescript-estree"
      ],
      "effects": [
        "@typescript-eslint/eslint-plugin",
        "typescript-eslint"
      ],
      "range": "6.16.0 - 8.72.2",
      "nodes": [
        "node_modules/@typescript-eslint/utils"
      ],
      "fixAvailable": {
        "name": "typescript-eslint",
        "version": "8.36.0",
        "isSemVerMajor": true
      }
    },
    "@vitest/mocker": {
      "name": "@vitest/mocker",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        {
          "source": 1193684,
          "name": "@vitest/mocker",
          "dependency": "@vitest/mocker",
          "title": "Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock",
          "url": "https://github.com/advisories/GHSA-82fw-gwwq-j7x9",
          "severity": "moderate",
          "cwe": [
            "CWE-22"
          ],
          "cvss": {
            "score": 5.9,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N"
          },
          "range": ">=2.1.0 <4.1.11"
        },
        {
          "source": 1242767,
          "name": "@vitest/mocker",
          "dependency": "@vitest/mocker",
          "title": "Vitest: Code injection via unauthenticated manual mock registration",
          "url": "https://github.com/advisories/GHSA-qxg6-89mg-rqv8",
          "severity": "moderate",
          "cwe": [
            "CWE-94",
            "CWE-116",
            "CWE-306"
          ],
          "cvss": {
            "score": 4.7,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:C/C:L/I:L/A:N"
          },
          "range": ">=2.1.0-beta.7 <4.1.12"
        }
      ],
      "effects": [
        "vitest"
      ],
      "range": "<=4.1.11",
      "nodes": [
        "node_modules/@vitest/mocker"
      ],
      "fixAvailable": true
    },
    "@vitest/ui": {
      "name": "@vitest/ui",
      "severity": "critical",
      "isDirect": true,
      "via": [
        "vitest"
      ],
      "effects": [
        "vitest"
      ],
      "range": "4.0.0-beta.1 - 4.1.0-beta.6",
      "nodes": [
        "node_modules/@vitest/ui"
      ],
      "fixAvailable": true
    },
    "deepmerge": {
      "name": "deepmerge",
      "severity": "low",
      "isDirect": false,
      "via": [
        {
          "source": 1243505,
          "name": "deepmerge",
          "dependency": "deepmerge",
          "title": "deepmerge mergeObject() allows prototype poisoning of returned objects",
          "url": "https://github.com/advisories/GHSA-gcqx-w48m-w2h4",
          "severity": "low",
          "cwe": [
            "CWE-1321"
          ],
          "cvss": {
            "score": 5.3,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N"
          },
          "range": ">=4.2.0 <=4.3.1"
        }
      ],
      "effects": [
        "@rollup/plugin-node-resolve"
      ],
      "range": ">=4.2.0",
      "nodes": [
        "node_modules/deepmerge"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    },
    "glob": {
      "name": "glob",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        {
          "source": 1244013,
          "name": "glob",
          "dependency": "glob",
          "title": "Glob: AbortSignal cancellation bypass allows post-timeout filesystem traversal",
          "url": "https://github.com/advisories/GHSA-3g3m-2fjr-6pw4",
          "severity": "moderate",
          "cwe": [
            "CWE-400"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=9.0.0 <=14.0.1"
        },
        "minimatch"
      ],
      "effects": [
        "workbox-build"
      ],
      "range": "9.0.0 - 14.0.1",
      "nodes": [
        "node_modules/glob"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    },
    "minimatch": {
      "name": "minimatch",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        {
          "source": 1244623,
          "name": "minimatch",
          "dependency": "minimatch",
          "title": "minimatch has potential denial of service via globparts amplification",
          "url": "https://github.com/advisories/GHSA-g3hv-75wg-m249",
          "severity": "moderate",
          "cwe": [
            "CWE-405"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=7.0.0 <11.0.1"
        }
      ],
      "effects": [
        "@typescript-eslint/typescript-estree",
        "glob"
      ],
      "range": "7.0.0 - 11.0.0",
      "nodes": [
        "node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch",
        "node_modules/glob/node_modules/minimatch"
      ],
      "fixAvailable": {
        "name": "typescript-eslint",
        "version": "8.36.0",
        "isSemVerMajor": true
      }
    },
    "typescript-eslint": {
      "name": "typescript-eslint",
      "severity": "moderate",
      "isDirect": true,
      "via": [
        "@typescript-eslint/eslint-plugin",
        "@typescript-eslint/parser",
        "@typescript-eslint/typescript-estree",
        "@typescript-eslint/utils"
      ],
      "effects": [],
      "range": "<=8.72.2",
      "nodes": [
        "node_modules/typescript-eslint"
      ],
      "fixAvailable": {
        "name": "typescript-eslint",
        "version": "8.36.0",
        "isSemVerMajor": true
      }
    },
    "vite-plugin-pwa": {
      "name": "vite-plugin-pwa",
      "severity": "moderate",
      "isDirect": true,
      "via": [
        "workbox-build"
      ],
      "effects": [],
      "range": ">=1.2.0",
      "nodes": [
        "node_modules/vite-plugin-pwa"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    },
    "vitest": {
      "name": "vitest",
      "severity": "critical",
      "isDirect": true,
      "via": [
        "@vitest/mocker",
        "@vitest/ui",
        {
          "source": 1139529,
          "name": "vitest",
          "dependency": "vitest",
          "title": "When Vitest UI server is listening, arbitrary file can be read and executed",
          "url": "https://github.com/advisories/GHSA-5xrq-8626-4rwp",
          "severity": "critical",
          "cwe": [
            "CWE-22",
            "CWE-862"
          ],
          "cvss": {
            "score": 9.8,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
          },
          "range": ">=4.0.0 <4.1.0"
        },
        {
          "source": 1193683,
          "name": "vitest",
          "dependency": "vitest",
          "title": "Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock",
          "url": "https://github.com/advisories/GHSA-82fw-gwwq-j7x9",
          "severity": "moderate",
          "cwe": [
            "CWE-22"
          ],
          "cvss": {
            "score": 5.9,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N"
          },
          "range": ">=2.1.0 <4.1.11"
        }
      ],
      "effects": [
        "@vitest/ui"
      ],
      "range": "2.1.0-beta.1 - 4.1.10",
      "nodes": [
        "node_modules/vitest"
      ],
      "fixAvailable": true
    },
    "workbox-build": {
      "name": "workbox-build",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        "@rollup/plugin-node-resolve",
        "glob"
      ],
      "effects": [
        "vite-plugin-pwa"
      ],
      "range": ">=6.0.0-alpha.0",
      "nodes": [
        "node_modules/workbox-build"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    }
  },
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 2,
      "moderate": 11,
      "high": 0,
      "critical": 2,
      "total": 15
    },
    "dependencies": {
      "prod": 16,
      "dev": 588,
      "optional": 53,
      "peer": 8,
      "peerOptional": 0,
      "total": 603
    }
  }
}
```

### post-audit — complete stderr

```text

```

### final-audit — metadata

```text
{
  "command": [
    "npm",
    "audit",
    "--json"
  ],
  "started": "2026-11-16T06:43:33.577Z",
  "finished": "2026-11-16T06:43:35.786Z",
  "exit": 1,
  "signal": null,
  "error": null
}
```

### final-audit — complete stdout JSON

```text
{
  "auditReportVersion": 2,
  "vulnerabilities": {
    "@rollup/plugin-node-resolve": {
      "name": "@rollup/plugin-node-resolve",
      "severity": "low",
      "isDirect": false,
      "via": [
        "deepmerge"
      ],
      "effects": [
        "workbox-build"
      ],
      "range": ">=8.0.0",
      "nodes": [
        "node_modules/@rollup/plugin-node-resolve"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    },
    "@typescript-eslint/eslint-plugin": {
      "name": "@typescript-eslint/eslint-plugin",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        "@typescript-eslint/parser",
        "@typescript-eslint/type-utils",
        "@typescript-eslint/utils"
      ],
      "effects": [],
      "range": "6.16.0 - 8.72.2",
      "nodes": [
        "node_modules/@typescript-eslint/eslint-plugin"
      ],
      "fixAvailable": true
    },
    "@typescript-eslint/parser": {
      "name": "@typescript-eslint/parser",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        "@typescript-eslint/typescript-estree"
      ],
      "effects": [
        "@typescript-eslint/eslint-plugin",
        "typescript-eslint"
      ],
      "range": "6.16.0 - 8.72.2",
      "nodes": [
        "node_modules/@typescript-eslint/parser"
      ],
      "fixAvailable": {
        "name": "typescript-eslint",
        "version": "8.36.0",
        "isSemVerMajor": true
      }
    },
    "@typescript-eslint/type-utils": {
      "name": "@typescript-eslint/type-utils",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        "@typescript-eslint/typescript-estree",
        "@typescript-eslint/utils"
      ],
      "effects": [],
      "range": "6.16.0 - 8.72.2",
      "nodes": [
        "node_modules/@typescript-eslint/type-utils"
      ],
      "fixAvailable": true
    },
    "@typescript-eslint/typescript-estree": {
      "name": "@typescript-eslint/typescript-estree",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        "minimatch"
      ],
      "effects": [
        "@typescript-eslint/parser",
        "@typescript-eslint/type-utils",
        "@typescript-eslint/utils",
        "typescript-eslint"
      ],
      "range": "6.16.0 - 8.72.2",
      "nodes": [
        "node_modules/@typescript-eslint/typescript-estree"
      ],
      "fixAvailable": {
        "name": "typescript-eslint",
        "version": "8.36.0",
        "isSemVerMajor": true
      }
    },
    "@typescript-eslint/utils": {
      "name": "@typescript-eslint/utils",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        "@typescript-eslint/typescript-estree"
      ],
      "effects": [
        "@typescript-eslint/eslint-plugin",
        "typescript-eslint"
      ],
      "range": "6.16.0 - 8.72.2",
      "nodes": [
        "node_modules/@typescript-eslint/utils"
      ],
      "fixAvailable": {
        "name": "typescript-eslint",
        "version": "8.36.0",
        "isSemVerMajor": true
      }
    },
    "deepmerge": {
      "name": "deepmerge",
      "severity": "low",
      "isDirect": false,
      "via": [
        {
          "source": 1243505,
          "name": "deepmerge",
          "dependency": "deepmerge",
          "title": "deepmerge mergeObject() allows prototype poisoning of returned objects",
          "url": "https://github.com/advisories/GHSA-gcqx-w48m-w2h4",
          "severity": "low",
          "cwe": [
            "CWE-1321"
          ],
          "cvss": {
            "score": 5.3,
            "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N"
          },
          "range": ">=4.2.0 <=4.3.1"
        }
      ],
      "effects": [
        "@rollup/plugin-node-resolve"
      ],
      "range": ">=4.2.0",
      "nodes": [
        "node_modules/deepmerge"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    },
    "glob": {
      "name": "glob",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        {
          "source": 1244013,
          "name": "glob",
          "dependency": "glob",
          "title": "Glob: AbortSignal cancellation bypass allows post-timeout filesystem traversal",
          "url": "https://github.com/advisories/GHSA-3g3m-2fjr-6pw4",
          "severity": "moderate",
          "cwe": [
            "CWE-400"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=9.0.0 <=14.0.1"
        },
        "minimatch"
      ],
      "effects": [
        "workbox-build"
      ],
      "range": "9.0.0 - 14.0.1",
      "nodes": [
        "node_modules/glob"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    },
    "minimatch": {
      "name": "minimatch",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        {
          "source": 1244623,
          "name": "minimatch",
          "dependency": "minimatch",
          "title": "minimatch has potential denial of service via globparts amplification",
          "url": "https://github.com/advisories/GHSA-g3hv-75wg-m249",
          "severity": "moderate",
          "cwe": [
            "CWE-405"
          ],
          "cvss": {
            "score": 0,
            "vectorString": null
          },
          "range": ">=7.0.0 <11.0.1"
        }
      ],
      "effects": [
        "@typescript-eslint/typescript-estree",
        "glob"
      ],
      "range": "7.0.0 - 11.0.0",
      "nodes": [
        "node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch",
        "node_modules/glob/node_modules/minimatch"
      ],
      "fixAvailable": {
        "name": "typescript-eslint",
        "version": "8.36.0",
        "isSemVerMajor": true
      }
    },
    "typescript-eslint": {
      "name": "typescript-eslint",
      "severity": "moderate",
      "isDirect": true,
      "via": [
        "@typescript-eslint/eslint-plugin",
        "@typescript-eslint/parser",
        "@typescript-eslint/typescript-estree",
        "@typescript-eslint/utils"
      ],
      "effects": [],
      "range": "<=8.72.2",
      "nodes": [
        "node_modules/typescript-eslint"
      ],
      "fixAvailable": {
        "name": "typescript-eslint",
        "version": "8.36.0",
        "isSemVerMajor": true
      }
    },
    "vite-plugin-pwa": {
      "name": "vite-plugin-pwa",
      "severity": "moderate",
      "isDirect": true,
      "via": [
        "workbox-build"
      ],
      "effects": [],
      "range": ">=1.2.0",
      "nodes": [
        "node_modules/vite-plugin-pwa"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    },
    "workbox-build": {
      "name": "workbox-build",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        "@rollup/plugin-node-resolve",
        "glob"
      ],
      "effects": [
        "vite-plugin-pwa"
      ],
      "range": ">=6.0.0-alpha.0",
      "nodes": [
        "node_modules/workbox-build"
      ],
      "fixAvailable": {
        "name": "vite-plugin-pwa",
        "version": "1.1.0",
        "isSemVerMajor": true
      }
    }
  },
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 2,
      "moderate": 10,
      "high": 0,
      "critical": 0,
      "total": 12
    },
    "dependencies": {
      "prod": 16,
      "dev": 588,
      "optional": 53,
      "peer": 8,
      "peerOptional": 0,
      "total": 603
    }
  }
}
```

### final-audit — complete stderr

```text

```

## Evidence integrity index

These are local ignored evidence files, not tracked artifacts or published data. All command captures, baseline/frozen manifests and lock, freeze, delta inventory, artifact verification and helper source are listed with exact bytes and SHA-256. No canceled-release artifact was reused. The report generator itself is included at its current contents. Final readback files are created only after the report commit and cannot be listed prospectively here.

| Evidence file (relative to node_modules/.cache/audit-only-evidence) | Bytes | SHA-256 |
| --- | --- | --- |
| artifact-verification-corrected.meta.json | 233 | d358208ab5c360997420c1956c09e3f45ba9fed14909787f5be64477235f22e4 |
| artifact-verification-corrected.stderr | 498 | e724668854bb018437a2641a1362d95c0831efcc90de94f91e194d84395f57f0 |
| artifact-verification-corrected.stdout | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| artifact-verification-final.meta.json | 233 | df58e41365d09817a029bf27fec3bb4cdd5fbd60dcdfbf8390cbb498f387f443 |
| artifact-verification-final.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| artifact-verification-final.stdout | 2102 | 31b7fcc63bb6227153694a3c56fc05c4b3e964d631303fef8607ee94a14b6096 |
| artifact-verification.json | 2102 | 31b7fcc63bb6227153694a3c56fc05c4b3e964d631303fef8607ee94a14b6096 |
| artifact-verification.meta.json | 233 | f24cd1ab03b7fc4f985d841464f1cc99dd7fdc1ec238f1c0e0bf1f0844353377 |
| artifact-verification.stderr | 1024 | 98fe85717f07168109c3ea5154d56d8287356641a8bfc9ddfc699aa5725d17b1 |
| artifact-verification.stdout | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| audit-after-vitest.meta.json | 191 | 549f5f133ec86a683d4ae4fcd66e10edc2669322c98fd07828a4a80d433f3240 |
| audit-after-vitest.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| audit-after-vitest.stdout | 10962 | b786c3c4bf123d84b95be65b24830eed2cd3b55555fa41fd9851723a5f263896 |
| audit-resolved-vitest.meta.json | 191 | eafa51d755ac12b549bf44fdcde0a39a76599f92dfaf1a760995e34f911d18c2 |
| audit-resolved-vitest.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| audit-resolved-vitest.stdout | 7725 | a8f42f4a84732787fb7bc481e012a6584632d76bcec4f904e6ee452c61f6d4fb |
| baseline-audit.meta.json | 191 | ae2c920f5a5e87a7f158e368b9440a30ed6f731fd8afbc24e307971a914574a9 |
| baseline-audit.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| baseline-audit.stdout | 68467 | 715d99a213ba541b382452b1ca7e640b72de78e90b553d59309d5781ca7ba62f |
| baseline-branch.meta.json | 200 | d3ece5a22b5fcb6dc5ddf808e130ca310da9bde7dc4b3104fad640c601b34604 |
| baseline-branch.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| baseline-branch.stdout | 11 | 08245dcb0cf05d3bef172997514e3c24c78b591368ad100877bccf09702a283b |
| baseline-head.meta.json | 193 | 75097cf3e718d31676ab5b35f52cbf97a793cc4febfd92651d3445fbd7ded319 |
| baseline-head.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| baseline-head.stdout | 41 | d28be49e1d75dd1c93adefeecaf39afd99f71a065653e4a0b69b423eb1c2d005 |
| baseline-package-lock.json | 326904 | 7a4f1f5273d5c1c9bce3dfcd0301be58294d4bb2c8644f329c6efc031d59b32e |
| baseline-package.json | 1322 | 677800cc71baf61e5ea0acba38c9e30486222c0a37f19a377e6852633c5a795e |
| baseline-remotes.meta.json | 188 | 61e24f06e5369480c884a664480c0892842b30057fc6e1b27a29b91bdd842a5b |
| baseline-remotes.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| baseline-remotes.stdout | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| baseline-status.meta.json | 197 | a985769e0dd09c91710d2e2e33d39014789c64699aa055830deefcdd534f3e1c |
| baseline-status.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| baseline-status.stdout | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| capture.mjs | 2869 | 7c5a262d38acf5e9eec7fa8045961dfeef0f95ac4a03e729a93bcaf2ad596aec |
| dependency-candidate-head.meta.json | 193 | 553faf5495e40de6b95a5368dab1b3490e41a9188a2dbb2cd237ef2d8e6598a0 |
| dependency-candidate-head.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| dependency-candidate-head.stdout | 41 | 4f89139bb4df0d969d095aa6a78bfa9f59726bf478f1fe51c0ec718b90ac21e0 |
| dependency-candidate-show.meta.json | 225 | d8cc55dcd787737b178541c7aae5265bfc5df93fc818f202126c5e86ea42a189 |
| dependency-candidate-show.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| dependency-candidate-show.stdout | 504 | 134021beedc9ebc2290a696557edcea029f7a661cb843cc397cc5cd2488b36bd |
| dependency-candidate-status.meta.json | 197 | 4076fa39b1e2d3074f2b3941184d3b715d4f37911608c4d64a005e4da5d752e5 |
| dependency-candidate-status.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| dependency-candidate-status.stdout | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| dependency-freeze.json | 571 | 96e6c79f0a0e9bc0c20ec10499e15ad6fcc955b7860945d759e7dde7c1b8a9ec |
| dependency-tree.meta.json | 191 | d0638d9952238dbd04edf1e58fc2266ababa0b3913c88a778cf6f71bd5fce969 |
| dependency-tree.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| dependency-tree.stdout | 1014 | 56c75a672f88fc2a30a1033b80ea4640cd3542e1b3694c723555d65b2b16749f |
| final-audit.meta.json | 191 | 3835967b0b98f9539d1e3f602ede9866fca018b47d01c213ba4136823d7e8b5b |
| final-audit.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| final-audit.stdout | 7725 | a8f42f4a84732787fb7bc481e012a6584632d76bcec4f904e6ee452c61f6d4fb |
| final-dependency-tree.meta.json | 187 | 4d0f59146bda4934110702799fae68f55b436d953bf40b9a59ff5708c40b9c49 |
| final-dependency-tree.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| final-dependency-tree.stdout | 70560 | a0de06cfb7d21eb02c911966a88e8d225ac0c4569137e7e0b1fc4fd9397092bd |
| final-gates-started.json | 38 | bce4aa09c7728c6692487ae690c7eb9053fa237832690c5fe1ae473179391c5d |
| freeze.mjs | 1268 | c0754d09a434f30d7028194af2d2b7c1e7d21fd512952905f1e9487a4f658b8d |
| frozen-package-lock.json | 319125 | 0ec244d4b0e848af3e454de4bd5f99f8430b1abd9292c30c74daafdb2a063ba6 |
| frozen-package.json | 1322 | 1f81a3b388ffbd632288eca31b277581668d8c59a75b8fb358be7f2a0a7f70ae |
| gate-1-eslint.meta.json | 187 | b1d3f8be9b3913f048c7f2b710ec6c6b85034db295be6410d245eb63af079bd8 |
| gate-1-eslint.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| gate-1-eslint.stdout | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| gate-2-tsc.meta.json | 185 | 1957afcd91f6715702712839c81bcea7f2d525488253fb4d7284ad2e68d3567a |
| gate-2-tsc.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| gate-2-tsc.stdout | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| gate-3-test.meta.json | 199 | beb2f707293efe6f8cf0905d0e76558219d9d92d6e2ecee75d8e05d014e6ad5b |
| gate-3-test.stderr | 144 | d3c0e05bde79eaf4cb7cdde298ee0ae14b6447142cfeb3545db091119de621ae |
| gate-3-test.stdout | 305 | a4560c85731e2e21949f94cb34fd6d0b595674a1d3dad3043a4e3118351d97b0 |
| gate-4-build.meta.json | 188 | 7f913d140bd31121b0c2df3862e7c435030082d9103c633771b3f27d48217ff0 |
| gate-4-build.stderr | 4444 | 5ae3c5052a27b9c736cab1abe707b0d90943aae69a8da1371211c6ebea823109 |
| gate-4-build.stdout | 607 | aaeb538159ca3424e54c463cc9a110bc30fead07e038d195e79550311718cdd9 |
| initial-lock-version-deltas.json | 29126 | 7c27d5ac02db4a89efd6723e46ae2896cb0cd82917f8abb0196718f05bc15134 |
| inspect.mjs | 1714 | fcdac3dbef9a2f1888df3a53d0809e3b226d3447115decb970b462fc4d686981 |
| install-fixed-vitest.meta.json | 245 | 64073c0cd20c11fd2cc27aaebbcee38183396e1b7ad66f5ed7aa5e426660a6ea |
| install-fixed-vitest.stderr | 178 | e9e8ab63fb0bd287d2c92757641408fd1f975fc841bfffdca69bf145c2631fab |
| install-fixed-vitest.stdout | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| install-manifest-vitest.meta.json | 179 | b67dbc391ffcf52948f69be134a1ffe0cbdb5f32701d1f7c526f7d6561da597a |
| install-manifest-vitest.stderr | 178 | 6ff8adefa01c0255622e7f59b7633eb3fd5ab2a7de5d46e94923266d95ae433c |
| install-manifest-vitest.stdout | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| install-resolved-lock.meta.json | 179 | b73f118263f776154bfa964867d25abbf36f2deaf1b5fef82a6a9b4466cec14f |
| install-resolved-lock.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| install-resolved-lock.stdout | 344 | 66654ae54b69ab1bbf73e754b553b53a8aeaa152a7095fc10c53555de732ca28 |
| make-report.mjs | 24637 | c88d6f02042909e2508da6115ad31d6d254e95f8c594c65ded2f0c56b31b8768 |
| node-version.meta.json | 182 | 0e0857a96a2c50406f5ac47c9293e05a79bef27c22f24f8ca70d9ce5f02ee694 |
| node-version.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| node-version.stdout | 9 | c42fcf0db5a550bda2f566fcdc21955df3e5a8ec3aeb90ac533f3776e7fce32a |
| npm-audit-fix.meta.json | 188 | 888dea4e9f24692a03fd44954ef010d79a4e3c5f4a44b329ba5a58cfb9ff9f4e |
| npm-audit-fix.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| npm-audit-fix.stdout | 3816 | a51d4be21fc5271fc526d97bc014e38fed4d3c3dc14e7613d4460aedeed5cb0e |
| npm-version.meta.json | 181 | 87062b1080fafec039479abbfecc1462b00197d3c3b615f867a12b35f69496e3 |
| npm-version.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| npm-version.stdout | 7 | 7eeb2f42ee0d10d4e00355252af2e7468bbff992af43b511355feb76da5c7cfb |
| post-audit.meta.json | 191 | 1aae71869dd3babcec42bc51cb004607a76da841717e62a45c884b8197f42f7c |
| post-audit.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| post-audit.stdout | 11092 | 7094c324ee350de2b934b5136c2a5906e8f636fe3a44a2c9fec64a6fc2644b8a |
| post-package-lock.json | 318690 | c4617f8e91dfb4d03f93160d2ff1c537312c25e1c0263f9b83fe1ba093cea2ff |
| post-package.json | 1322 | 677800cc71baf61e5ea0acba38c9e30486222c0a37f19a377e6852633c5a795e |
| precommit-validation.json | 34648 | 8c056a0c0eb826b03851e099e3cfe29db98d0fe43e5d8f2dd51f30b78ea1a9a2 |
| precommit-validation.meta.json | 226 | 6de619548546dd19a12684d2513e2fda8b55d74319d99e4ee5751c37f8f025a5 |
| precommit-validation.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| precommit-validation.stdout | 634 | 968d3c7985b922c83557af54fac644fd58cab0863189b2c139a595a727382a62 |
| precommit.mjs | 2782 | cd09b7e13bf357e772794e99ef7396a2f58893586491d2c6442253228d313b64 |
| pwa-adjacent-tests.meta.json | 298 | a103d0fe9b321d5b6145844524a5ff444cda5a4dc8f1af7656978efa9ef7e4e2 |
| pwa-adjacent-tests.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| pwa-adjacent-tests.stdout | 2201 | dae3d2a36099de9a72a68f6ce259f1f00c74124e10fdad323594e722bd67cd4c |
| registry-minimatch.meta.json | 244 | c9708a19bb60ecbef2c5c0415f39737843ca0d17d979e1f195d85874d8e6652a |
| registry-minimatch.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| registry-minimatch.stdout | 77 | 831ea3c23f9307c9bd0834a3aff1c9ec07088f197480eb00f84389296a8223ce |
| registry-pwa-1.1.0.meta.json | 278 | 5c5a83e587bc2e85148c94c84d715e712cf8fd127afc8f018b4bfe342970b9d7 |
| registry-pwa-1.1.0.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| registry-pwa-1.1.0.stdout | 391 | 50e0b865bb7be39ed1ea04451f64e0fd4af48f39a2db07f6b789bc787db734eb |
| registry-remediation.meta.json | 314 | 3850a0a97e42183fd937102098f0dc920d21d2e7e895e87ec38306f4a1f7a3b1 |
| registry-remediation.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| registry-remediation.stdout | 35574 | eb3a85ed379c92ec3cca1ef6fb91cdb259311fdd8448104b3e06d94e3329d28b |
| registry-typescript-eslint.meta.json | 230 | 91cae5b3b5aab3e28281e32d6d81cad37608e4d62cc390c3105dd1f7177e33d6 |
| registry-typescript-eslint.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| registry-typescript-eslint.stdout | 9 | 725dbd32b5ecb90a48b796f60a1d59e23f7b5a212ac6e25e5e20e80a87bd5072 |
| registry-ui-fixed.meta.json | 274 | f49d68ecff6fdcfc787b7590525af95b85427faf304f755711d348e6b5a4cab1 |
| registry-ui-fixed.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| registry-ui-fixed.stdout | 285 | e8b77b6a3a54d0b951e373437bed63250a59349de6f42674ecdf2b9ac5bcfe4b |
| registry-vitest-fixed.meta.json | 285 | 6569410ca4dbf6e6d4d1be06ac43447b9be986cbd58de44fcee6bed64832a5af |
| registry-vitest-fixed.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| registry-vitest-fixed.stdout | 1197 | d07ca257906d234a54eab02858ef434bd71932eab9c48fc532c6e429c9b94d51 |
| registry-workbox-current.meta.json | 252 | c9170768ce0b4c1d9479415b866cc2f4e28e894e17438e3edf4b72dc980f66c3 |
| registry-workbox-current.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| registry-workbox-current.stdout | 1322 | bf07b2a19f35f4115434c0755a0e52053b8b5993ade09b7742ac7442ab861ee0 |
| remaining-minimatch-path.meta.json | 196 | e11d5811ee86113c9f64ace4d1a2de66d8c85db0457eded1313677ab24e5e434 |
| remaining-minimatch-path.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| remaining-minimatch-path.stdout | 17445 | f289ccec3315f8b485777cba9c3241344aa37593dd40161a7037d31b7e05f1b4 |
| resolve-vitest-lock-only.meta.json | 206 | b6072b25188a6a90c81f316d974fde9a1df81119ab4f98d7ff9d88d1ae6e5a6a |
| resolve-vitest-lock-only.stderr | 178 | 8df25297ab3422c858227cdf437a422caa41faa696b1bd5fc4db492d3983dd2a |
| resolve-vitest-lock-only.stdout | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| strict-vitest-resolution.meta.json | 232 | 52961ef8e189d5930f18c37f7c88464f4ee9db2c68153a0e4c2e4263367e7468 |
| strict-vitest-resolution.stderr | 178 | 3134576bc15b997e19137bf88cf37cbeabefab7ce34395c67a1517e8d11c1847 |
| strict-vitest-resolution.stdout | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| targeted-nonbreaking-vitest.meta.json | 210 | 6dc7c846ce61425400b0d95d3459caeee43222b8101ace20047a57e532dadbe2 |
| targeted-nonbreaking-vitest.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| targeted-nonbreaking-vitest.stdout | 343 | c0518df5e484c8d9a3cbffd6d2f60cb06bfcbeb3e9eb8f70ec11238b15d1741f |
| verify-artifacts.mjs | 2796 | d3f06a2008f5e7e0641117cf8ceff3981811c66a66f57105e00565e2fbe9887b |
| vitest-peer-cycle-resolution.meta.json | 232 | fdb522d33e018b47b3d0d05bcdbc7c7ff9203b21268350dd14fb3b5298d65134 |
| vitest-peer-cycle-resolution.stderr | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| vitest-peer-cycle-resolution.stdout | 331 | f636f83c1f560aa674829d55ab23fca1084b3e700b3fb252a3616f2b7f12fd0d |

## Closeout boundary

Report staging check: `git diff --cached --name-only` listed only `REPORT-AUDIT.md`. `git diff --cached --check` returned **2** for trailing whitespace in verbatim raw evidence: five `[plugin vite:reporter] ` lines and one whitespace-only line from the failed artifact-helper stack trace. These bytes are intentionally retained to satisfy complete raw-output preservation; they are not application or dependency whitespace changes. Earlier dependency diff checks returned 0. A read-only report integrity check also confirmed all 294 version-delta rows, all complete final gate streams and audit snapshots, and byte-identical frozen/committed dependencies; it did not rerun any application gate.

Audit remediation and all four raw final gates are complete for dependency candidate `2f57b1fd7776ca85cd2a09f875002dde3b107601`; **12 low/moderate affected-package findings remain deferred** as detailed above. This does not release or independently accept the application. The next and final actions are committing only this report locally and reading back actual HEAD, branch, porcelain status and remotes. No source/dependency changes, gate repeats, main operation, push or deploy follow this report.
