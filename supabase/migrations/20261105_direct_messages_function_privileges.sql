-- Supabase may grant EXECUTE to anon by default. Chat RPCs must require a session.
revoke all on function public.is_conversation_member(uuid) from public, anon;
revoke all on function public.start_direct_conversation(uuid) from public, anon;
revoke all on function public.search_message_profiles(text) from public, anon;
revoke all on function public.get_inbox() from public, anon;
revoke all on function public.get_conversation_header(uuid) from public, anon;

-- Trigger functions are invoked by their trigger, never through the API.
revoke all on function public.touch_conversation() from public, anon, authenticated;
