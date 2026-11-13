// Segment 4 authorized exception: only replace the stale current-version token.
// Frozen JSON remains unchanged and every other byte is still compared exactly.
export const approvedVersionPlaceholder = (path: string, value: string) => path === 'settings.version'
  ? value.replace('1.1.0', '{version}') : value;
