// NEXT_PUBLIC_ 값은 빌드 때 그대로 박히므로 반드시 이 형태로 참조한다.
// 키가 없으면 앱은 데모 모드(브라우저 저장)로 돌아간다.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);
