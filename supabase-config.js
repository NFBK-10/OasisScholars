// Paste your Supabase project values here.
// Supabase Dashboard > Project Settings > Data API > Project URL and anon public key
export const supabaseConfig = {
  url: "PASTE_YOUR_SUPABASE_PROJECT_URL",
  anonKey: "PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY"
};

export function hasSupabaseConfig(){
  return supabaseConfig.url !== "PASTE_YOUR_SUPABASE_PROJECT_URL" &&
    supabaseConfig.anonKey !== "PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY";
}
