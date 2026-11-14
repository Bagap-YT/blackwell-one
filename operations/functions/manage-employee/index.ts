import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowedOrigins = new Set(['https://bagap-yt.github.io']);

function corsHeaders(origin: string | null) {
  const accepted = origin && (allowedOrigins.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return {
    'Access-Control-Allow-Origin': accepted ? origin! : 'https://bagap-yt.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%';
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => alphabet[value % alphabet.length]).join('');
}

Deno.serve(async req => {
  const cors = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Gebruik een POST-verzoek.' }, 405, cors);

  const authorization = req.headers.get('Authorization');
  const accessToken = authorization?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return json({ error: 'Log eerst in met een beheeraccount.' }, 401, cors);

  const callerAuth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: callerResult, error: authError } = await callerAuth.auth.getUser(accessToken);
  if (authError || !callerResult.user) return json({ error: 'Je sessie is niet geldig. Log opnieuw in.' }, 401, cors);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: profileError } = await admin.from('profiles')
    .select('id,role,operations_enabled')
    .eq('id', callerResult.user.id)
    .single();
  if (profileError || !caller || caller.role !== 'admin' || !caller.operations_enabled) {
    return json({ error: 'Alleen de BLACKWELL eigenaar kan accounts beheren.' }, 403, cors);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Ongeldige aanvraag.' }, 400, cors); }
  const action = body.action;

  if (action === 'create') {
    const fullName = String(body.full_name || '').trim();
    const username = String(body.username || '').trim().toLowerCase();
    const department = String(body.department || 'Operations').trim().slice(0, 80);
    const jobTitle = String(body.job_title || 'Medewerker').trim().slice(0, 80);
    if (fullName.length < 2 || fullName.length > 80) return json({ error: 'Vul een naam in van 2 tot 80 tekens.' }, 400, cors);
    if (!/^[a-z0-9_.-]{3,24}$/.test(username)) return json({ error: 'Gebruikersnaam: 3–24 tekens, alleen letters, cijfers, punt, streepje of underscore.' }, 400, cors);
    const { data: existing } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
    if (existing) return json({ error: 'Deze gebruikersnaam is al in gebruik.' }, 409, cors);

    const password = temporaryPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email: `${username}@accounts.blackwell.local`,
      password,
      email_confirm: true,
      user_metadata: { username, full_name: fullName },
    });
    if (error || !data.user) return json({ error: 'Account aanmaken is niet gelukt. Controleer of de gebruikersnaam vrij is.' }, 400, cors);
    const { error: updateError } = await admin.from('profiles').update({
      username,
      full_name: fullName,
      department: department || 'Operations',
      job_title: jobTitle || 'Medewerker',
      role: 'employee',
      operations_enabled: true,
    }).eq('id', data.user.id);
    if (updateError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return json({ error: 'Het profiel voor dit account kon niet worden klaargezet.' }, 500, cors);
    }
    return json({ username, password, full_name: fullName }, 200, cors);
  }

  const userId = String(body.user_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: 'Kies een geldig teamaccount.' }, 400, cors);
  const { data: target, error: targetError } = await admin.from('profiles')
    .select('id,username,full_name,role,operations_enabled')
    .eq('id', userId)
    .single();
  if (targetError || !target) return json({ error: 'Teamaccount niet gevonden.' }, 404, cors);
  if (target.role === 'admin' || target.id === caller.id) return json({ error: 'Owner-accounts kunnen alleen rechtstreeks door de eigenaar worden beheerd.' }, 403, cors);

  if (action === 'reset_password') {
    const password = temporaryPassword();
    const { error } = await admin.auth.admin.updateUserById(target.id, { password });
    if (error) return json({ error: 'Wachtwoord resetten is niet gelukt.' }, 400, cors);
    return json({ username: target.username, password, full_name: target.full_name }, 200, cors);
  }

  if (action === 'set_access') {
    const enabled = body.enabled === true;
    const { error } = await admin.from('profiles').update({ operations_enabled: enabled }).eq('id', target.id);
    if (error) return json({ error: 'Toegang bijwerken is niet gelukt.' }, 400, cors);
    return json({ message: enabled ? 'Operations-toegang aangezet.' : 'Operations-toegang uitgezet.' }, 200, cors);
  }

  return json({ error: 'Deze beheeractie bestaat niet.' }, 400, cors);
});

