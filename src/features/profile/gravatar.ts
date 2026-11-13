import SHA256 from 'crypto-js/sha256';

export const getGravatarUrl = (email: string | undefined, size: number = 200, username: string = 'user'): string => {
  if (!email) {
    // Use DiceBear as default avatar if no email
    // Generate a unique avatar based on username
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}&size=${size}`;
  }

  // Create SHA256 hash of email (Gravatar's current standard)
  // Email must be trimmed and lowercased before hashing
  const hash = SHA256(email.trim().toLowerCase()).toString();
  
  // Return Gravatar URL with DiceBear as fallback
  return `https://gravatar.com/avatar/${hash}?d=https%3A%2F%2Fapi.dicebear.com%2F7.x%2Favataaars%2Fsvg%3Fseed%3D${encodeURIComponent(username)}&s=${size}`;
};
