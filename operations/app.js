import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://jlbpczgyjeschedamcvz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jJf6sFbhFEiWHG68A-oztA_adFSDmUQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const state = { session: null, user: null, profile: null, page: 'overview', products: [], listings: [], sales: [], tasks: [], employees: [], search: '', filter: 'all' };
const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const pageTitles = { overview: 'Overzicht', inventory: 'Producten & voorraad', listings: 'Listing drafts', sales: 'Verkoop & winst', tasks: 'Teamtaken', team: 'Medewerkers', profile: 'Mijn profiel' };

function esc(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function money(value) { return euro.format(Number(value) || 0); }
function initials(name = '') { const parts = name.trim().split(/\s+/).filter(Boolean); return (parts.length > 1 ? parts[0][0] + parts.at(-1)[0] : (parts[0] || 'B').slice(0, 2)).toUpperCase(); }
function date(value, options = { day: '2-digit', month: 'short' }) { return value ? new Date(value).toLocaleDateString('nl-NL', options) : '—'; }
function isAdmin() { return state.profile?.role === 'admin'; }
function getProduct(id) { return state.products.find(product => product.id === id); }
function toast(message, error = false) { const node = document.createElement('div'); node.className = `toast${error ? ' error' : ''}`; node.textContent = message; $('#toastRoot').append(node); setTimeout(() => node.remove(), 3500); }
function fail(message) { toast(message || 'Er ging iets mis. Probeer het opnieuw.', true); }
function emptyState(icon, title, copy, action = '') { return `<div class="empty-state"><div class="empty-icon">${icon}</div><strong>${esc(title)}</strong>${esc(copy)}${action ? `<div style="margin-top:14px">${action}</div>` : ''}</div>`; }
function tag(text, tone = '') { return `<span class="tag ${tone}">${esc(text)}</span>`; }
function stockTag(stock) { const n = Number(stock) || 0; return n === 0 ? tag('Uitverkocht', 'red') : n <= 2 ? tag(`${n} op voorraad`, 'gold') : tag(`${n} op voorraad`); }
function initialsAvatar(profile, className = 'avatar-small') { return `<span class="${className}">${esc(profile.avatar_initials || initials(profile.full_name))}</span>`; }
function modal(title, subtitle, content, actions = '') {
  $('#modalRoot').innerHTML = `<div class="modal-backdrop" data-close-modal><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="modal-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button class="modal-close" type="button" data-close-modal aria-label="Sluiten">×</button></header><div class="modal-body">${content}</div>${actions ? `<footer class="modal-foot">${actions}</footer>` : ''}</section></div>`;
}
function closeModal() { $('#modalRoot').innerHTML = ''; }

async function loadProfile(user) {
  const { data, error } = await supabase.from('profiles').select('id,username,full_name,role,operations_enabled,department,job_title,profile_theme,compact_mode,avatar_initials').eq('id', user.id).single();
  if (error) throw error;
  if (!data?.operations_enabled) throw new Error('Dit account heeft nog geen toegang tot BLACKWELL OPERATIONS. Vraag de eigenaar om toegang.');
  state.user = user; state.profile = data;
  applyProfile();
}

function applyProfile() {
  const profile = state.profile;
  if (!profile) return;
  $('#sidebarName').textContent = profile.full_name || profile.username;
  $('#sidebarRole').textContent = isAdmin() ? 'Owner · Beheerder' : `${profile.job_title || 'Teamlid'} · Team`;
  $('#sidebarAvatar').textContent = profile.avatar_initials || initials(profile.full_name);
  $('#topAvatar').textContent = profile.avatar_initials || initials(profile.full_name);
  $('#topAvatar').title = profile.full_name || profile.username;
  document.body.classList.toggle('compact', !!profile.compact_mode);
  document.body.dataset.theme = profile.profile_theme || 'gold';
  $$('.admin-only').forEach(item => item.classList.toggle('hidden', !isAdmin()));
}

async function loadData() {
  const requests = [
    supabase.from('operations_products').select('*').order('created_at', { ascending: false }),
    supabase.from('operations_listings').select('*').order('updated_at', { ascending: false }),
    supabase.from('operations_sales').select('*').order('sold_at', { ascending: false }),
    supabase.from('operations_tasks').select('*').order('created_at', { ascending: false }),
  ];
  if (isAdmin()) requests.push(supabase.from('profiles').select('id,username,full_name,role,operations_enabled,department,job_title,avatar_initials').order('full_name'));
  const results = await Promise.all(requests);
  for (const result of results) if (result.error) throw result.error;
  [state.products, state.listings, state.sales, state.tasks] = results.slice(0, 4).map(result => result.data || []);
  state.employees = isAdmin() ? (results[4]?.data || []) : [];
  $('#navProductCount').textContent = state.products.length;
  $('#navListingCount').textContent = state.listings.filter(item => item.status !== 'Gearchiveerd').length;
  $('#navTaskCount').textContent = state.tasks.filter(item => item.status !== 'Klaar').length;
}

async function enterApp(user) {
  try {
    await loadProfile(user);
    await loadData();
    $('#loginScreen').classList.add('hidden');
    $('#appShell').classList.remove('hidden');
    await navigate(state.page);
  } catch (error) {
    await supabase.auth.signOut();
    $('#loginScreen').classList.remove('hidden');
    $('#appShell').classList.add('hidden');
    $('#loginError').textContent = error.message || 'We konden je teamtoegang niet controleren.';
  }
}

async function navigate(page) {
  if (page === 'team' && !isAdmin()) page = 'overview';
  state.page = page;
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
  $('#breadcrumbCurrent').textContent = pageTitles[page] || 'Overzicht';
  const pages = { overview: renderOverview, inventory: renderInventory, listings: renderListings, sales: renderSales, tasks: renderTasks, team: renderTeam, profile: renderProfile };
  $('#pageContent').innerHTML = (pages[page] || renderOverview)();
}

function renderOverview() {
  const units = state.products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  const inventoryValue = state.products.reduce((sum, product) => sum + Number(product.purchase_price || 0) * Number(product.stock || 0), 0);
  const revenue = state.sales.reduce((sum, sale) => sum + Number(sale.sale_price || 0), 0);
  const profit = state.sales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0);
  const openDrafts = state.listings.filter(listing => listing.status !== 'Gearchiveerd').length;
  const products = state.products.slice(0, 5);
  const tasks = state.tasks.filter(task => task.status !== 'Klaar').slice(0, 5);
  const chart = monthChart();
  return `<section class="welcome-hero"><div class="welcome-copy"><div class="eyebrow">${isAdmin() ? 'OWNER CONSOLE' : 'TEAM WORKSPACE'} · ${date(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</div><h1>Welkom terug, ${esc((state.profile.full_name || state.profile.username).split(' ')[0])}.</h1><p>Je overzicht is bijgewerkt. Beheer voorraad, maak listing drafts klaar voor Vinted en Marktplaats en volg verkoopresultaten vanuit één plek.</p></div><div class="hero-pill"><span class="live-dot"></span>Teamomgeving actief</div></section>
  <section class="metric-grid">
    ${metric('Voorraaditems', units.toLocaleString('nl-NL'), `${state.products.length} verschillende producten`, '▤')}
    ${metric('Inkoopwaarde', money(inventoryValue), 'Huidige voorraad tegen inkoopprijs', '◇')}
    ${metric('Totale verkoop', money(revenue), `${state.sales.length} geregistreerde verkopen`, '↗')}
    ${metric('Gerealiseerde winst', money(profit), 'Na kosten en verzendbijdrage', '✦', 'metric-highlight')}
  </section>
  <section class="grid-two"><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Voorraad in beeld</h2><p class="panel-subtitle">Recent bijgewerkte producten en beschikbaarheid</p></div><button class="text-link" data-go="inventory">Alle producten ↗</button></div>${products.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Inkoop</th><th>Richtprijs</th><th>Beschikbaarheid</th></tr></thead><tbody>${products.map(product => `<tr><td><span class="product-name">${esc(product.name)}</span><span class="product-sku">${esc(product.sku || product.category || 'Geen artikelcode')}</span></td><td>${money(product.purchase_price)}</td><td>${money(product.target_price)}</td><td>${stockTag(product.stock)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('▤', 'Je voorraad begint hier', 'Voeg je eerste product toe om prijzen en beschikbaarheid bij te houden.', isAdmin() || !isAdmin() ? `<button class="button" data-action="add-product">＋ Product toevoegen</button>` : '')}</article>
  <article class="panel"><div class="panel-head"><div><h2 class="panel-title">Verkoopontwikkeling</h2><p class="panel-subtitle">Omzet per maand · afgelopen 6 maanden</p></div>${tag(`${state.sales.length} totaal`, 'gold')}</div>${chart}</article></section>
  <section class="grid-two"><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Mijn open taken</h2><p class="panel-subtitle">Kleine stappen houden de operatie in beweging</p></div><button class="text-link" data-go="tasks">Naar taken ↗</button></div>${tasks.length ? taskRows(tasks, true) : emptyState('✓', 'Alles bijgewerkt', 'Je hebt op dit moment geen open taken.')}</article>
  <article class="panel"><div class="panel-head"><div><h2 class="panel-title">Listing drafts</h2><p class="panel-subtitle">Concepten die klaarstaan om later handmatig te plaatsen</p></div><button class="text-link" data-go="listings">Alle drafts ↗</button></div><div class="metric-value" style="font-size:30px;margin-top:4px">${openDrafts}</div><div class="metric-note">Concepten voor Vinted en Marktplaats</div><div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap">${tag(`${state.listings.filter(item => item.status === 'Concept').length} concept`, 'gold')}${tag(`${state.listings.filter(item => item.status === 'Klaar').length} klaar`)}</div></article></section>`;
}

function metric(label, value, note, icon, valueClass = '') { return `<article class="metric-card"><div class="metric-top"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value ${valueClass}">${value}</div><div class="metric-note">${note}</div></article>`; }

function monthChart() {
  const now = new Date(); const months = [];
  for (let offset = 5; offset >= 0; offset--) { const d = new Date(now.getFullYear(), now.getMonth() - offset, 1); months.push({ label: d.toLocaleDateString('nl-NL', { month: 'short' }), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, amount: 0 }); }
  state.sales.forEach(sale => { const key = String(sale.sold_at || '').slice(0, 7); const month = months.find(item => item.key === key); if (month) month.amount += Number(sale.sale_price || 0); });
  const max = Math.max(1, ...months.map(item => item.amount));
  return `<div class="chart">${months.map(month => `<div class="chart-col"><span class="chart-amount">${month.amount ? money(month.amount).replace(',00', '') : ''}</span><div class="chart-bar" style="height:${Math.max(3, month.amount / max * 80)}%"></div><span class="chart-label">${esc(month.label)}</span></div>`).join('')}</div>`;
}

function pageHeading(kicker, title, subtitle, actions = '') { return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="page-subtitle">${subtitle}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`; }

function renderInventory() {
  const actions = `<button class="button button-primary" data-action="add-product"><span class="icon-plus">＋</span> Product toevoegen</button>`;
  const rows = filteredProducts();
  return `${pageHeading('CATALOGUS · INVENTORY', 'Producten & voorraad', 'Bekijk inkoop- en richtprijzen, pas voorraad aan en houd elk item verkoopklaar.', actions)}
  <div class="filter-bar"><div class="search-field"><span>⌕</span><input id="productSearch" value="${esc(state.search)}" placeholder="Zoek product, artikelcode of categorie…"></div><select id="stockFilter" class="filter-select"><option value="all" ${state.filter === 'all' ? 'selected' : ''}>Alle voorraad</option><option value="low" ${state.filter === 'low' ? 'selected' : ''}>Lage voorraad</option><option value="empty" ${state.filter === 'empty' ? 'selected' : ''}>Uitverkocht</option></select>${tag(`${state.products.length} producten`, 'gold')}</div>
  <section class="panel"><div class="panel-head"><div><h2 class="panel-title">Productcatalogus</h2><p class="panel-subtitle">Prijzen, staat en voorraadstatus in één overzicht</p></div></div>${rows.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Categorie</th><th>Inkoopprijs</th><th>Richtprijs</th><th>Margepotentieel</th><th>Voorraad</th><th></th></tr></thead><tbody>${rows.map(productRow).join('')}</tbody></table></div>` : emptyState('▤', state.products.length ? 'Geen resultaten' : 'Nog geen producten', state.products.length ? 'Pas je zoekopdracht of filter aan.' : 'Voeg producten toe om voorraad en prijzen bij te houden.', '<button class="button button-primary" data-action="add-product">＋ Product toevoegen</button>')}</section>`;
}

function filteredProducts() {
  const query = state.search.toLowerCase();
  return state.products.filter(product => {
    const matchesQuery = !query || [product.name, product.sku, product.category].some(value => String(value || '').toLowerCase().includes(query));
    const matchesFilter = state.filter === 'all' || (state.filter === 'low' && Number(product.stock) > 0 && Number(product.stock) <= 2) || (state.filter === 'empty' && Number(product.stock) === 0);
    return matchesQuery && matchesFilter;
  });
}

function productRow(product) {
  const margin = Number(product.target_price || 0) - Number(product.purchase_price || 0);
  return `<tr><td><span class="product-name">${esc(product.name)}</span><span class="product-sku">${esc(product.sku || 'Geen artikelcode')} · ${esc(product.condition)}</span></td><td>${esc(product.category)}</td><td>${money(product.purchase_price)}</td><td>${money(product.target_price)}</td><td class="${margin >= 0 ? 'profit-positive' : 'profit-negative'}">${money(margin)}</td><td>${stockTag(product.stock)}</td><td><div class="inline-actions"><button class="mini-action" data-edit-product="${product.id}" title="Bewerken">✎</button>${isAdmin() ? `<button class="mini-action" data-delete-product="${product.id}" title="Verwijderen">×</button>` : ''}</div></td></tr>`;
}

function renderListings() {
  const actions = `<button class="button button-primary" data-action="add-listing">＋ Listing draft</button>`;
  const shown = state.listings.filter(item => item.status !== 'Gearchiveerd');
  return `${pageHeading('VERKOOPKLAAR MAKEN', 'Listing drafts', 'Schrijf concepten voor Vinted en Marktplaats. Plaatsen blijft altijd een handmatige stap.', actions)}
  <div class="filter-bar"><div class="search-field"><span>⌕</span><input id="listingSearch" placeholder="Zoek op titel of platform…"></div><select id="listingFilter" class="filter-select"><option value="all">Alle statussen</option><option value="Concept">Concept</option><option value="Klaar">Klaar voor plaatsing</option></select>${tag(`${shown.length} actieve drafts`, 'gold')}</div>
  <section class="listing-card-grid" id="listingCards">${shown.length ? shown.map(listingCard).join('') : emptyState('↗', 'Nog geen listing drafts', 'Koppel een draft aan een product en bereid je advertentietekst voor.', '<button class="button button-primary" data-action="add-listing">＋ Listing draft</button>')}</section>
  <section class="panel section-block"><div class="panel-head"><div><h2 class="panel-title">Plaatsingscheck</h2><p class="panel-subtitle">Een korte controle voor een nette productpresentatie</p></div>${tag('Handmatige plaatsing', 'gold')}</div><div class="grid-two" style="margin-bottom:0"><div class="task-list"><div class="task-row"><span class="task-check">✓</span><div><div class="task-title">Titel en productdetails gecontroleerd</div><div class="task-meta">Maak maat, merk en staat duidelijk</div></div></div><div class="task-row"><span class="task-check">✓</span><div><div class="task-title">Prijs en voorraad afgestemd</div><div class="task-meta">Controleer dat je voorraad klopt</div></div></div></div><div class="admin-note"><strong>Drafts worden niet automatisch geplaatst</strong>Deze werkruimte bewaart alleen tekst en prijzen. Plaats een advertentie zelf in Vinted of Marktplaats wanneer je er klaar voor bent.</div></div></section>`;
}

function listingCard(listing) {
  const tone = listing.status === 'Klaar' ? '' : 'gold';
  return `<article class="listing-card" data-listing-card data-title="${esc((listing.title + ' ' + listing.platform).toLowerCase())}" data-status="${esc(listing.status)}"><div class="listing-top"><span class="platform-mark">${listing.platform === 'Vinted' ? '✳ VINTED' : '◉ MARKTPLAATS'}</span>${tag(listing.status === 'Klaar' ? 'Klaar voor plaatsing' : 'Concept', tone)}</div><h3>${esc(listing.title)}</h3><p class="listing-description">${esc(listing.description || 'Nog geen beschrijving toegevoegd.')}</p><div class="listing-bottom"><span class="listing-price">${money(listing.asking_price)}</span><div class="listing-actions"><button class="mini-action" data-edit-listing="${listing.id}" title="Draft bewerken">✎</button><button class="mini-action" data-archive-listing="${listing.id}" title="Draft archiveren">↘</button></div></div></article>`;
}

function renderSales() {
  const actions = `<button class="button button-primary" data-action="add-sale">＋ Verkoop registreren</button>`;
  const revenue = state.sales.reduce((sum, sale) => sum + Number(sale.sale_price || 0), 0);
  const costs = state.sales.reduce((sum, sale) => sum + Number(sale.purchase_cost || 0) + Number(sale.platform_fee || 0) + Number(sale.shipping_cost || 0), 0);
  const profit = state.sales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0);
  return `${pageHeading('RESULTATEN · SALES', 'Verkoop & winst', 'Leg afgeronde verkopen vast en zie direct je marge na inkoop, platformkosten en verzending.', actions)}
  <section class="metric-grid">${metric('Omzet', money(revenue), 'Totaal van geregistreerde verkopen', '↗')}${metric('Totale kosten', money(costs), 'Inkoop, platform en verzending', '◇')}${metric('Gerealiseerde winst', money(profit), `${state.sales.length} verkoop${state.sales.length === 1 ? '' : 'en'}`, '✦', 'metric-highlight')}${metric('Gemiddelde marge', state.sales.length ? `${(profit / state.sales.length).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })}` : money(0), 'Winst per geregistreerde verkoop', '◷')}</section>
  <section class="panel"><div class="panel-head"><div><h2 class="panel-title">Verkoopregistratie</h2><p class="panel-subtitle">Elke registratie verlaagt automatisch de voorraad met één item</p></div><div class="search-field" style="max-width:220px;flex:0 0 220px"><span>⌕</span><input id="salesSearch" placeholder="Zoek verkoop…"></div></div>${state.sales.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Verkocht op</th><th>Kanaal</th><th>Verkoopprijs</th><th>Kosten</th><th>Winst</th></tr></thead><tbody>${state.sales.map(sale => `<tr data-sale-row data-search="${esc((sale.product_name + sale.platform).toLowerCase())}"><td><span class="product-name">${esc(sale.product_name)}</span><span class="product-sku">${esc(sale.notes || 'Geregistreerde verkoop')}</span></td><td>${date(sale.sold_at)}</td><td>${tag(sale.platform, sale.platform === 'Vinted' ? 'violet' : 'blue')}</td><td>${money(sale.sale_price)}</td><td>${money(Number(sale.purchase_cost) + Number(sale.platform_fee) + Number(sale.shipping_cost))}</td><td class="${Number(sale.profit) >= 0 ? 'profit-positive' : 'profit-negative'}">${money(sale.profit)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('◷', 'Nog geen verkopen geregistreerd', 'Registreer een afgeronde verkoop om omzet en winst bij te houden.', '<button class="button button-primary" data-action="add-sale">＋ Verkoop registreren</button>')}</section>`;
}

function taskRows(tasks, short = false) {
  if (!tasks.length) return emptyState('✓', 'Geen taken gevonden', 'Je taken verschijnen hier zodra ze worden aangemaakt.');
  return `<div class="task-list">${tasks.map(task => {
    const assigned = state.employees.find(person => person.id === task.assigned_to);
    return `<div class="task-row ${task.status === 'Klaar' ? 'done' : ''}"><button class="task-check" data-cycle-task="${task.id}" title="Status wijzigen">${task.status === 'Klaar' ? '✓' : ''}</button><div><div class="task-title">${esc(task.title)}</div><div class="task-meta">${short ? esc(task.details || (assigned?.full_name || 'Toegewezen taak')) : esc(task.details || 'Geen extra details')}${!short && isAdmin() ? ` · ${esc(assigned?.full_name || 'Niet toegewezen')}` : ''}</div></div>${short ? `<span class="task-date">${task.due_date ? date(task.due_date) : esc(task.status)}</span>` : `<select class="status-select" data-task-status="${task.id}"><option ${task.status === 'Open' ? 'selected' : ''}>Open</option><option ${task.status === 'Bezig' ? 'selected' : ''}>Bezig</option><option ${task.status === 'Klaar' ? 'selected' : ''}>Klaar</option></select>`}</div>`;
  }).join('')}</div>`;
}

function renderTasks() {
  const actions = isAdmin() ? `<button class="button button-primary" data-action="add-task">＋ Taak toewijzen</button>` : '';
  const sorted = [...state.tasks].sort((a, b) => (a.status === 'Klaar') - (b.status === 'Klaar'));
  return `${pageHeading('TEAM · ACTIES', 'Teamtaken', isAdmin() ? 'Verdeel acties, wijs ze toe aan teamleden en volg de voortgang.' : 'Werk je acties bij. Updates zijn direct zichtbaar voor je eigenaar.' , actions)}<section class="panel"><div class="panel-head"><div><h2 class="panel-title">${isAdmin() ? 'Alle toegewezen taken' : 'Mijn taken'}</h2><p class="panel-subtitle">${sorted.filter(task => task.status !== 'Klaar').length} open · ${sorted.filter(task => task.status === 'Klaar').length} afgerond</p></div></div>${taskRows(sorted)}</section>`;
}

function renderTeam() {
  const active = state.employees.filter(item => item.operations_enabled).length;
  const employees = state.employees.filter(item => item.username !== state.profile.username);
  return `${pageHeading('OWNER CONSOLE · ACCESS', 'Medewerkers', 'Maak teamaccounts aan, deel tijdelijke inloggegevens en beheer Operations-toegang.', `<button class="button button-primary" data-action="add-employee">＋ Account aanmaken</button>`)}
  <section class="metric-grid">${metric('Teamleden', state.employees.length, 'Accounts in BLACKWELL', '♧')}${metric('Operations actief', active, 'Toegang tot deze werkruimte', '◈')}${metric('Beheerders', state.employees.filter(item => item.role === 'admin').length, 'Owner accounts', '✦')}${metric('Beveiliging', 'Actief', 'Rollen worden server-side gecontroleerd', '▣')}</section>
  <section class="panel"><div class="panel-head"><div><h2 class="panel-title">Teamaccounts</h2><p class="panel-subtitle">Account- en toegangsbeheer voor deze werkruimte</p></div>${tag('Owner only', 'gold')}</div>${employees.length ? `<div class="employee-grid">${employees.map(employeeCard).join('')}</div>` : emptyState('♧', 'Nog geen medewerkers', 'Maak een account aan om je team toegang te geven.', '<button class="button button-primary" data-action="add-employee">＋ Account aanmaken</button>')}</section>
  <section class="panel section-block"><div class="panel-head"><div><h2 class="panel-title">Toegang veilig houden</h2><p class="panel-subtitle">Beheer de accounts zorgvuldig</p></div></div><div class="admin-note"><strong>Tijdelijke wachtwoorden verschijnen maar één keer</strong>Deel een nieuw wachtwoord rechtstreeks met de medewerker. Je kunt op elk moment een nieuw tijdelijk wachtwoord maken of Operations-toegang uitzetten.</div></section>`;
}

function employeeCard(person) {
  if (person.role === 'admin') return `<article class="employee-card"><span class="avatar">${esc(person.avatar_initials || initials(person.full_name))}</span><div class="employee-main"><strong>${esc(person.full_name || person.username)}</strong><small>@${esc(person.username)} · Owner</small></div>${tag('Owner', 'gold')}</article>`;
  return `<article class="employee-card ${person.operations_enabled ? '' : 'inactive'}"><span class="avatar">${esc(person.avatar_initials || initials(person.full_name))}</span><div class="employee-main"><strong>${esc(person.full_name || person.username)}</strong><small>@${esc(person.username)} · ${esc(person.department || 'Team')}</small></div><div class="employee-actions"><button class="mini-action" data-reset-employee="${person.id}" title="Wachtwoord resetten">↻</button><button class="mini-action" data-toggle-employee="${person.id}" data-enabled="${person.operations_enabled}" title="${person.operations_enabled ? 'Toegang uitzetten' : 'Toegang aanzetten'}">${person.operations_enabled ? '◉' : '○'}</button></div></article>`;
}

function renderProfile() {
  const profile = state.profile;
  return `${pageHeading('PERSOONLIJK · INSTELLINGEN', 'Mijn profiel', 'Stel je profiel en weergave in. Je werkgegevens blijven alleen zichtbaar voor het team.')}
  <section class="profile-grid"><article class="profile-card"><div class="profile-identity"><div class="profile-large-avatar">${esc(profile.avatar_initials || initials(profile.full_name))}</div><div><h2>${esc(profile.full_name || profile.username)}</h2><p>@${esc(profile.username)} · ${isAdmin() ? 'Owner & beheerder' : esc(profile.job_title || 'Teamlid')}</p></div></div>
  <form id="profileForm"><div class="form-grid"><div><label class="field-label" for="profileName">Weergavenaam</label><input class="form-control" id="profileName" name="full_name" value="${esc(profile.full_name || '')}" required></div><div><label class="field-label">Gebruikersnaam</label><input class="form-control" value="${esc(profile.username)}" disabled></div><div><label class="field-label">Rol</label><input class="form-control" value="${isAdmin() ? 'Owner / Admin' : 'Medewerker'}" disabled></div><div><label class="field-label">Afdeling</label><input class="form-control" value="${esc(profile.department || 'Team')}" disabled></div></div>
  <label class="field-label" style="margin-top:19px">Profielkleur</label><div class="theme-pickers">${['gold','emerald','violet','blue'].map(theme => `<button class="theme-choice ${profile.profile_theme === theme ? 'selected' : ''}" type="button" data-theme-choice="${theme}" aria-label="${theme}" title="${theme}"></button>`).join('')}</div><input type="hidden" name="profile_theme" id="profileTheme" value="${esc(profile.profile_theme || 'gold')}">
  <div class="toggle-row"><div class="toggle-copy"><strong>Compacte weergave</strong><small>Toon tabellen met minder tussenruimte</small></div><button class="switch ${profile.compact_mode ? 'on' : ''}" id="compactSwitch" type="button" aria-pressed="${!!profile.compact_mode}"></button></div><input type="hidden" name="compact_mode" id="compactMode" value="${!!profile.compact_mode}">
  <div style="margin-top:17px"><button class="button button-primary" type="submit">Wijzigingen opslaan</button></div></form></article>
  <aside><div class="admin-note"><strong>${isAdmin() ? 'Owner-profiel' : 'Teamprofiel'}</strong>${isAdmin() ? 'Je hebt toegang tot medewerkersbeheer, productprijzen en alle verkoopgegevens.' : 'Je profielkleur en weergavenaam zijn alleen voor deze werkruimte. Je rol en toegangsrechten worden door de eigenaar beheerd.'}</div><div class="panel" style="margin-top:12px"><h2 class="panel-title">Accountbeveiliging</h2><p class="panel-subtitle" style="line-height:1.6;margin-top:8px">Je sessie is beveiligd met Supabase Auth. Bij verlies van toegang kan de eigenaar je wachtwoord opnieuw instellen vanuit Medewerkers.</p><button class="button button-quiet" data-action="logout" style="margin-top:12px">Uitloggen</button></div></aside></section>`;
}

function productForm(product = null) {
  const p = product || { name: '', sku: '', category: 'Kleding', condition: 'Goed', stock: 1, description: '', purchase_price: 0, target_price: 0 };
  const content = `<form id="productForm"><div class="form-grid"><div><label class="field-label">Productnaam</label><input class="form-control" name="name" value="${esc(p.name)}" required></div><div><label class="field-label">Artikelcode / SKU</label><input class="form-control" name="sku" value="${esc(p.sku || '')}" placeholder="Optioneel"></div><div><label class="field-label">Categorie</label><input class="form-control" name="category" value="${esc(p.category || '')}" required></div><div><label class="field-label">Staat</label><select class="form-control" name="condition">${['Nieuw','Als nieuw','Goed','Redelijk','Gebruikt'].map(value => `<option ${p.condition === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div><div><label class="field-label">Voorraad</label><input class="form-control" name="stock" type="number" min="0" step="1" value="${Number(p.stock) || 0}" required></div>${isAdmin() ? `<div><label class="field-label">Inkoopprijs (€)</label><input class="form-control" name="purchase_price" type="number" min="0" step="0.01" value="${Number(p.purchase_price) || 0}" required></div><div><label class="field-label">Richtprijs (€)</label><input class="form-control" name="target_price" type="number" min="0" step="0.01" value="${Number(p.target_price) || 0}" required></div>` : ''}</div><label class="field-label" style="margin-top:14px">Notities / beschrijving</label><textarea class="form-control textarea" name="description" placeholder="Maat, merk, kenmerken…">${esc(p.description || '')}</textarea></form>`;
  modal(product ? 'Product bewerken' : 'Product toevoegen', 'Leg de productgegevens en voorraadstatus vast.', content, `<button class="button button-quiet" type="button" data-close-modal>Annuleren</button><button class="button button-primary" type="submit" form="productForm">Opslaan</button>`);
  $('#productForm').addEventListener('submit', async event => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const values = Object.fromEntries(form.entries());
    const payload = { name: values.name.trim(), sku: values.sku.trim() || null, category: values.category.trim(), condition: values.condition, stock: Number(values.stock), description: values.description || '', updated_at: new Date().toISOString() };
    try {
      let id = product?.id;
      if (product) { const { error } = await supabase.from('operations_products').update(payload).eq('id', product.id); if (error) throw error; }
      else { const { data, error } = await supabase.from('operations_products').insert({ ...payload, created_by: state.user.id }).select('id').single(); if (error) throw error; id = data.id; }
      if (isAdmin()) { const { error } = await supabase.rpc('set_operations_product_prices', { p_product_id: id, p_purchase_price: Number(values.purchase_price), p_target_price: Number(values.target_price) }); if (error) throw error; }
      closeModal(); await loadData(); await navigate('inventory'); toast(product ? 'Product bijgewerkt.' : 'Product toegevoegd.');
    } catch (error) { fail(error.message); }
  });
}

function listingForm(listing = null) {
  const l = listing || { product_id: '', platform: 'Vinted', title: '', description: '', asking_price: '', status: 'Concept' };
  const productOptions = state.products.map(product => `<option value="${product.id}" ${l.product_id === product.id ? 'selected' : ''}>${esc(product.name)} · ${money(product.target_price)}</option>`).join('');
  const content = `<form id="listingForm"><label class="field-label">Koppel product</label><select class="form-control" name="product_id"><option value="">Geen gekoppeld product</option>${productOptions}</select><div class="form-grid"><div><label class="field-label">Platform</label><select class="form-control" name="platform"><option ${l.platform === 'Vinted' ? 'selected' : ''}>Vinted</option><option ${l.platform === 'Marktplaats' ? 'selected' : ''}>Marktplaats</option></select></div><div><label class="field-label">Vraagprijs (€)</label><input class="form-control" name="asking_price" type="number" min="0" step="0.01" value="${esc(l.asking_price)}" required></div></div><label class="field-label">Titel</label><input class="form-control" name="title" value="${esc(l.title)}" required maxlength="120"><label class="field-label">Beschrijving</label><textarea class="form-control textarea" name="description" placeholder="Staat, maat, merk, bijzonderheden…">${esc(l.description || '')}</textarea><label class="field-label">Draftstatus</label><select class="form-control" name="status"><option ${l.status === 'Concept' ? 'selected' : ''}>Concept</option><option ${l.status === 'Klaar' ? 'selected' : ''}>Klaar</option><option ${l.status === 'Gearchiveerd' ? 'selected' : ''}>Gearchiveerd</option></select><p class="modal-help">Dit bewaart een tekstconcept. De app plaatst niets automatisch op het verkoopplatform.</p></form>`;
  modal(listing ? 'Listing draft bewerken' : 'Listing draft maken', 'Bereid een advertentie voor; plaatsen doe je later zelf.', content, `<button class="button button-quiet" type="button" data-close-modal>Annuleren</button><button class="button button-primary" type="submit" form="listingForm">Draft opslaan</button>`);
  $('#listingForm').addEventListener('submit', async event => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const payload = { product_id: values.product_id || null, platform: values.platform, title: values.title.trim(), description: values.description || '', asking_price: Number(values.asking_price), status: values.status, updated_at: new Date().toISOString() };
    try { const result = listing ? await supabase.from('operations_listings').update(payload).eq('id', listing.id) : await supabase.from('operations_listings').insert({ ...payload, created_by: state.user.id }); if (result.error) throw result.error; closeModal(); await loadData(); await navigate('listings'); toast('Listing draft opgeslagen.'); } catch (error) { fail(error.message); }
  });
}

function saleForm() {
  const available = state.products.filter(product => Number(product.stock) > 0);
  const content = `<form id="saleForm"><label class="field-label">Product</label><select class="form-control" name="product_id" required><option value="">Kies een product…</option>${available.map(product => `<option value="${product.id}">${esc(product.name)} · ${product.stock} op voorraad · inkoop ${money(product.purchase_price)}</option>`).join('')}</select><div class="form-grid"><div><label class="field-label">Verkoopprijs (€)</label><input class="form-control" name="sale_price" type="number" min="0" step="0.01" required></div><div><label class="field-label">Verkoopkanaal</label><select class="form-control" name="platform"><option>Vinted</option><option>Marktplaats</option><option>Anders</option></select></div><div><label class="field-label">Platformkosten (€)</label><input class="form-control" name="platform_fee" type="number" min="0" step="0.01" value="0"></div><div><label class="field-label">Verzendkosten (€)</label><input class="form-control" name="shipping_cost" type="number" min="0" step="0.01" value="0"></div></div><label class="field-label">Notitie</label><input class="form-control" name="notes" placeholder="Optioneel"></form>${available.length ? '' : '<p class="modal-help">Er zijn geen producten op voorraad om te registreren als verkocht.</p>'}`;
  modal('Verkoop registreren', 'Voorraad wordt automatisch met één item verlaagd.', content, `<button class="button button-quiet" type="button" data-close-modal>Annuleren</button><button class="button button-primary" type="submit" form="saleForm" ${available.length ? '' : 'disabled'}>Verkoop opslaan</button>`);
  $('#saleForm').addEventListener('submit', async event => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { const { error } = await supabase.rpc('record_operations_sale', { p_product_id: values.product_id, p_sale_price: Number(values.sale_price), p_platform: values.platform, p_platform_fee: Number(values.platform_fee || 0), p_shipping_cost: Number(values.shipping_cost || 0), p_notes: values.notes || '' }); if (error) throw error; closeModal(); await loadData(); await navigate('sales'); toast('Verkoop geregistreerd en voorraad bijgewerkt.'); } catch (error) { fail(error.message); }
  });
}

function taskForm() {
  const content = `<form id="taskForm"><label class="field-label">Taaknaam</label><input class="form-control" name="title" required><label class="field-label">Toewijzen aan</label><select class="form-control" name="assigned_to"><option value="">Nog niet toegewezen</option>${state.employees.filter(person => person.operations_enabled).map(person => `<option value="${person.id}">${esc(person.full_name || person.username)} · @${esc(person.username)}</option>`).join('')}</select><label class="field-label">Deadline</label><input class="form-control" name="due_date" type="date"><label class="field-label">Details</label><textarea class="form-control textarea" name="details" placeholder="Extra context of checklist…"></textarea></form>`;
  modal('Taak toewijzen', 'Maak een actie voor jou of een teamlid.', content, `<button class="button button-quiet" type="button" data-close-modal>Annuleren</button><button class="button button-primary" type="submit" form="taskForm">Taak aanmaken</button>`);
  $('#taskForm').addEventListener('submit', async event => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { const { error } = await supabase.from('operations_tasks').insert({ title: values.title.trim(), details: values.details || '', assigned_to: values.assigned_to || null, due_date: values.due_date || null, created_by: state.user.id }); if (error) throw error; closeModal(); await loadData(); await navigate('tasks'); toast('Taak aangemaakt.'); } catch (error) { fail(error.message); }
  });
}

function employeeForm() {
  const content = `<form id="employeeForm"><div class="form-grid"><div><label class="field-label">Volledige naam</label><input class="form-control" name="full_name" required></div><div><label class="field-label">Gebruikersnaam</label><input class="form-control" name="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_.-]+" placeholder="bijvoorbeeld sam"></div><div><label class="field-label">Afdeling</label><input class="form-control" name="department" value="Operations"></div><div><label class="field-label">Functie</label><input class="form-control" name="job_title" value="Medewerker"></div></div><p class="modal-help">Er wordt een uniek tijdelijk wachtwoord gemaakt. Het verschijnt één keer nadat het account is aangemaakt.</p></form>`;
  modal('Medewerker toevoegen', 'Maak een individueel teamaccount voor BLACKWELL OPERATIONS.', content, `<button class="button button-quiet" type="button" data-close-modal>Annuleren</button><button class="button button-primary" type="submit" form="employeeForm">Account aanmaken</button>`);
  $('#employeeForm').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const button = $('button[type="submit"][form="employeeForm"]'); button.disabled = true; button.textContent = 'Account maken…';
    const values = Object.fromEntries(new FormData(form).entries()); values.username = values.username.trim().toLowerCase();
    try { const result = await supabase.functions.invoke('manage-employee', { body: { action: 'create', ...values } }); if (result.error) throw result.error; if (result.data?.error) throw new Error(result.data.error); closeModal(); await loadData(); await navigate('team'); showCredentials(result.data, 'Nieuw teamaccount'); }
    catch (error) { button.disabled = false; button.textContent = 'Account aanmaken'; fail(error.message || 'Account aanmaken is niet gelukt.'); }
  });
}

function showCredentials(data, title) {
  const content = `<div class="credentials-box"><strong>Bewaar deze tijdelijke inloggegevens</strong><div class="credential-line"><span>Gebruikersnaam</span><code>${esc(data.username)}</code></div><div class="credential-line"><span>Tijdelijk wachtwoord</span><code id="temporaryPassword">${esc(data.password)}</code></div></div><p class="modal-help">De medewerker kan met deze gegevens inloggen. Deel ze rechtstreeks en veilig. Dit wachtwoord wordt later niet opnieuw getoond.</p>`;
  modal(title, 'Kopieer de gegevens nu; sluit dit venster pas als je ze hebt bewaard.', content, `<button class="button button-quiet" type="button" data-close-modal>Sluiten</button><button class="button button-primary" type="button" id="copyCredentials">Gegevens kopiëren</button>`);
  $('#copyCredentials').addEventListener('click', async () => { const text = `Gebruikersnaam: ${data.username}\nTijdelijk wachtwoord: ${data.password}`; try { await navigator.clipboard.writeText(text); toast('Inloggegevens gekopieerd.'); } catch { toast(text); } });
}

async function manageEmployee(action, person) {
  try {
    const result = await supabase.functions.invoke('manage-employee', { body: { action, user_id: person.id, enabled: action === 'set_access' ? !person.operations_enabled : undefined } });
    if (result.error) throw result.error; if (result.data?.error) throw new Error(result.data.error);
    await loadData(); await navigate('team');
    if (action === 'reset_password') showCredentials(result.data, 'Nieuw tijdelijk wachtwoord');
    else toast(result.data.message || (person.operations_enabled ? 'Operations-toegang uitgezet.' : 'Operations-toegang aangezet.'));
  } catch (error) { fail(error.message || 'Medewerkerbeheer is niet gelukt.'); }
}

async function saveProfile(event) {
  event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    const patch = { full_name: values.full_name.trim(), profile_theme: values.profile_theme, compact_mode: values.compact_mode === 'true' };
    const { error } = await supabase.from('profiles').update(patch).eq('id', state.user.id); if (error) throw error;
    state.profile = { ...state.profile, ...patch }; applyProfile(); await navigate('profile'); toast('Je profiel is bijgewerkt.');
  } catch (error) { fail(error.message); }
}

async function updateTaskStatus(id, status) {
  try { const { error } = await supabase.from('operations_tasks').update({ status }).eq('id', id); if (error) throw error; await loadData(); await navigate(state.page); toast('Taakstatus bijgewerkt.'); } catch (error) { fail(error.message); }
}

async function deleteProduct(id) {
  const product = getProduct(id); if (!product || !confirm(`Weet je zeker dat je ${product.name} wilt verwijderen?`)) return;
  try { const { error } = await supabase.from('operations_products').delete().eq('id', id); if (error) throw error; await loadData(); await navigate('inventory'); toast('Product verwijderd.'); } catch (error) { fail(error.message); }
}

async function archiveListing(id) {
  try { const { error } = await supabase.from('operations_listings').update({ status: 'Gearchiveerd', updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; await loadData(); await navigate('listings'); toast('Draft gearchiveerd.'); } catch (error) { fail(error.message); }
}

async function saveProfileTheme(theme) {
  $('#profileTheme').value = theme; $$('.theme-choice').forEach(button => button.classList.toggle('selected', button.dataset.themeChoice === theme));
}

document.addEventListener('click', async event => {
  const close = event.target.closest('[data-close-modal]'); if (close) { if (close.classList.contains('modal-backdrop') && event.target !== close) return; closeModal(); return; }
  const nav = event.target.closest('[data-page]'); if (nav) { await navigate(nav.dataset.page); return; }
  const go = event.target.closest('[data-go]'); if (go) { await navigate(go.dataset.go); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'add-product') productForm();
  if (action === 'add-listing') listingForm();
  if (action === 'add-sale') saleForm();
  if (action === 'add-task') taskForm();
  if (action === 'add-employee' && isAdmin()) employeeForm();
  if (action === 'logout') await logout();
  const editProduct = event.target.closest('[data-edit-product]'); if (editProduct) productForm(getProduct(editProduct.dataset.editProduct));
  const removeProduct = event.target.closest('[data-delete-product]'); if (removeProduct && isAdmin()) await deleteProduct(removeProduct.dataset.deleteProduct);
  const editListing = event.target.closest('[data-edit-listing]'); if (editListing) listingForm(state.listings.find(item => item.id === editListing.dataset.editListing));
  const archive = event.target.closest('[data-archive-listing]'); if (archive) await archiveListing(archive.dataset.archiveListing);
  const reset = event.target.closest('[data-reset-employee]'); if (reset && isAdmin()) { const person = state.employees.find(item => item.id === reset.dataset.resetEmployee); if (confirm(`Maak een nieuw tijdelijk wachtwoord voor ${person.full_name || person.username}?`)) await manageEmployee('reset_password', person); }
  const toggle = event.target.closest('[data-toggle-employee]'); if (toggle && isAdmin()) { const person = state.employees.find(item => item.id === toggle.dataset.toggleEmployee); await manageEmployee('set_access', person); }
  const theme = event.target.closest('[data-theme-choice]'); if (theme) await saveProfileTheme(theme.dataset.themeChoice);
  const compact = event.target.closest('#compactSwitch'); if (compact) { const hidden = $('#compactMode'); const enabled = hidden.value !== 'true'; hidden.value = String(enabled); compact.classList.toggle('on', enabled); compact.setAttribute('aria-pressed', String(enabled)); }
  const cycle = event.target.closest('[data-cycle-task]'); if (cycle) { const task = state.tasks.find(item => item.id === cycle.dataset.cycleTask); const next = task.status === 'Open' ? 'Bezig' : task.status === 'Bezig' ? 'Klaar' : 'Open'; await updateTaskStatus(task.id, next); }
});

document.addEventListener('change', async event => {
  if (event.target.id === 'stockFilter') { state.filter = event.target.value; await navigate('inventory'); }
  const status = event.target.closest('[data-task-status]'); if (status) await updateTaskStatus(status.dataset.taskStatus, status.value);
});

document.addEventListener('input', event => {
  if (event.target.id === 'productSearch') { state.search = event.target.value; const start = event.target.selectionStart; const end = event.target.selectionEnd; const cursor = event.target.value; const panel = $('#pageContent'); const temp = document.createElement('div'); temp.innerHTML = renderInventory(); panel.innerHTML = temp.innerHTML; const next = $('#productSearch'); next.value = cursor; next.focus(); next.setSelectionRange(start, end); }
  if (event.target.id === 'listingSearch') { const query = event.target.value.toLowerCase(); $$('[data-listing-card]').forEach(card => card.classList.toggle('hidden', !card.dataset.title.includes(query))); }
  if (event.target.id === 'listingFilter') { const status = event.target.value; $$('[data-listing-card]').forEach(card => card.classList.toggle('hidden', status !== 'all' && card.dataset.status !== status)); }
  if (event.target.id === 'salesSearch') { const query = event.target.value.toLowerCase(); $$('[data-sale-row]').forEach(row => row.classList.toggle('hidden', !row.dataset.search.includes(query))); }
});

document.addEventListener('submit', event => { if (event.target.id === 'profileForm') saveProfile(event); });

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget; const button = $('button[type="submit"]', form); const errorLine = $('#loginError'); errorLine.textContent = '';
  const username = $('#loginUsername').value.trim().toLowerCase(); const password = $('#loginPassword').value; button.disabled = true; $('span', button).textContent = 'Even controleren…';
  try { const { data, error } = await supabase.auth.signInWithPassword({ email: `${username}@accounts.blackwell.local`, password }); if (error) throw new Error('Gebruikersnaam of wachtwoord klopt niet.'); if (!data.user) throw new Error('Inloggen is niet gelukt.'); state.session = data.session; await enterApp(data.user); }
  catch (error) { errorLine.textContent = error.message || 'Inloggen is niet gelukt.'; }
  finally { button.disabled = false; $('span', button).textContent = 'Inloggen'; }
});

async function logout() { await supabase.auth.signOut(); state.user = null; state.profile = null; state.products = []; state.listings = []; state.sales = []; state.tasks = []; $('#appShell').classList.add('hidden'); $('#loginScreen').classList.remove('hidden'); $('#loginPassword').value = ''; $('#loginError').textContent = ''; $('#loginUsername').focus(); }

$('#logoutButton').addEventListener('click', logout);
$('#refreshButton').addEventListener('click', async event => { const button = event.currentTarget; button.classList.add('spinning'); try { await loadData(); await navigate(state.page); toast('Gegevens zijn ververst.'); } catch (error) { fail(error.message); } finally { button.classList.remove('spinning'); } });
$$('[data-reveal]').forEach(button => button.addEventListener('click', () => { const input = document.getElementById(button.dataset.reveal); input.type = input.type === 'password' ? 'text' : 'password'; }));
$('#topAvatar').addEventListener('click', () => navigate('profile'));

supabase.auth.getSession().then(({ data }) => { if (data.session?.user) enterApp(data.session.user); });
supabase.auth.onAuthStateChange((_event, session) => { if (!session) { $('#appShell').classList.add('hidden'); $('#loginScreen').classList.remove('hidden'); } });

