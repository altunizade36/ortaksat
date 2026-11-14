export function hasProfilePhoto(uri?: string | null): boolean {
  return Boolean(uri && /^(https?:|file:|content:|data:image\/|blob:|\/)/i.test(uri) && !/mascot|brand-head|ui-avatars\.com|\/logo[./-]|\/avatars\/k\d+\.webp/i.test(uri));
}
