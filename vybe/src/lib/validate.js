const RESERVED = ['admin','vybe','support','help','settings','login','signup','api','root','u','profile','explore','reels','chats','moderator','official'];

export function validateUsername(u) {
  if (u.length < 3 || u.length > 20) return 'Username must be 3 to 20 characters.';
  if (!/^[a-z0-9_]+$/.test(u)) return 'Use only lowercase letters, numbers and underscores.';
  if (RESERVED.includes(u)) return 'This username is reserved. Try another.';
  return '';
}
export function validateEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? '' : 'Enter a valid email address.';
}
export function validatePassword(p) {
  if (p.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'Include at least one letter and one number.';
  return '';
}
export function friendlyAuthError(error) {
  const m = (error?.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'Email or password is incorrect.';
  if (m.includes('not confirmed')) return 'Verify your email first. Check your inbox for the link.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a few minutes and try again.';
  if (m.includes('database error')) return 'That username was just taken. Pick another one.';
  if (m.includes('weak') || m.includes('password')) return 'Choose a stronger password.';
  return 'Something went wrong. Check your connection and try again.';
}

export function friendlyError(error) {
  const m = (error?.message || '').toLowerCase();
  if (m.includes('rate_limit')) return 'You are doing that too fast. Try again in a little while.';
  if (error?.code === '23505' || m.includes('duplicate')) return 'Already done.';
  if (m.includes('row-level security') || m.includes('permission')) return 'You do not have permission to do that.';
  return 'Something went wrong. Check your connection and try again.';
}

export function friendlyChatError(error) {
  const m = (error?.message || '').toLowerCase();
  if (m.includes('not_allowed')) return 'This person is not accepting messages from you.';
  if (m.includes('request_limit')) return 'Wait for them to accept your request before sending more.';
  if (m.includes('too_many')) return 'Groups can have up to 20 people.';
  return friendlyError(error);
}
