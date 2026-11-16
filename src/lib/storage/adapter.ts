// One-way compatibility seam: library consumers never import the root facade.
export { readRecord as loadUserData } from './runtime';
