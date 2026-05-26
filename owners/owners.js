// Supabase-powered owner auth and scholarship posting, with a local demo fallback.
import { supabaseConfig, hasSupabaseConfig } from '../supabase-config.js';

const maxFileBytes = 5 * 1024 * 1024;
const tableName = 'opportunities';
const bucketName = 'opportunity-files';
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedDocumentTypes = new Set(['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/webp']);
const allowedDocumentExtensions = new Set(['.pdf', '.txt', '.jpg', '.jpeg', '.png', '.webp']);
const maxTextLengths = {
  name: 80,
  title: 160,
  provider: 120,
  summary: 500,
  amount: 120,
  applyUrl: 500,
  fullInfo: 5000
};
const localUsersKey = 'oasisscholars-local-users';
const localSessionKey = 'oasisscholars-local-session';
const localOpportunitiesKey = 'oasisscholars-local-opportunities';
const legacyOpportunitiesKey = 'oasis_ops_v2';
const legacyOwnersKey = 'oasis_owners_v1';
const legacyActiveOwnerKey = 'oasis_owner_active';

const supabaseReady = hasSupabaseConfig();
let supabase = null;

async function initSupabase(){
  if(!supabaseReady || supabase) return supabase;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
  return supabase;
}

function setMessage(element, message){
  if(element) element.textContent = message || '';
}

function clearElement(element){
  while(element && element.firstChild) element.removeChild(element.firstChild);
}

function addText(parent, tag, text, className){
  const el = document.createElement(tag);
  if(className) el.className = className;
  el.textContent = text || '';
  parent.appendChild(el);
  return el;
}

function addMeta(parent, label, value){
  if(!value) return;
  const item = document.createElement('p');
  item.className = 'opportunity-meta-item';
  const strong = document.createElement('strong');
  strong.textContent = label + ': ';
  item.appendChild(strong);
  item.appendChild(document.createTextNode(value));
  parent.appendChild(item);
}

function siteBaseUrl(){
  return window.location.origin + window.location.pathname.replace(/(?:owners\/)?[^/]*$/, '');
}

function opportunityUrl(opportunity){
  return new URL('opportunity.html?id=' + encodeURIComponent(opportunity.id), siteBaseUrl()).href;
}

function shareText(opportunity){
  const parts = [
    'Posted by OASISSCHOLARS',
    opportunity.title,
    opportunity.summary,
    'Apply or read more: ' + opportunityUrl(opportunity),
    'Website: ' + new URL('index.html', siteBaseUrl()).href
  ];
  return parts.filter(Boolean).join('\n\n');
}

async function copyShareText(opportunity, button){
  const text = shareText(opportunity);
  try{
    if(navigator.share){
      await navigator.share({
        title: opportunity.title,
        text: 'Posted by OASISSCHOLARS: ' + opportunity.title,
        url: opportunityUrl(opportunity)
      });
    } else if(navigator.clipboard){
      await navigator.clipboard.writeText(text);
      if(button) button.textContent = 'Copied';
    } else {
      window.prompt('Copy this post for Instagram or other apps:', text);
    }
  }catch(error){
    if(error.name !== 'AbortError') window.prompt('Copy this post for Instagram or other apps:', text);
  }
}

function buildShareActions(opportunity){
  const share = document.createElement('div');
  share.className = 'share-actions';

  const label = document.createElement('span');
  label.className = 'share-label';
  label.textContent = 'Share';
  share.appendChild(label);

  const encodedText = encodeURIComponent(shareText(opportunity));
  const encodedUrl = encodeURIComponent(opportunityUrl(opportunity));

  const whatsapp = document.createElement('a');
  whatsapp.className = 'share-button';
  whatsapp.href = 'https://wa.me/?text=' + encodedText;
  whatsapp.target = '_blank';
  whatsapp.rel = 'noopener noreferrer';
  whatsapp.textContent = 'WhatsApp';
  share.appendChild(whatsapp);

  const x = document.createElement('a');
  x.className = 'share-button';
  x.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent('Posted by OASISSCHOLARS: ' + opportunity.title) + '&url=' + encodedUrl;
  x.target = '_blank';
  x.rel = 'noopener noreferrer';
  x.textContent = 'X';
  share.appendChild(x);

  const copy = document.createElement('button');
  copy.className = 'share-button';
  copy.type = 'button';
  copy.textContent = 'Copy for Instagram';
  copy.addEventListener('click', () => copyShareText(opportunity, copy));
  share.appendChild(copy);

  return share;
}

function iconSvg(pathData){
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  svg.appendChild(path);
  return svg;
}

function addListingMeta(parent, iconPath, text){
  if(!text) return;
  const item = document.createElement('li');
  item.className = 'listing-meta-item';
  const icon = document.createElement('span');
  icon.className = 'listing-meta-icon';
  icon.appendChild(iconSvg(iconPath));
  item.appendChild(icon);
  item.appendChild(document.createTextNode(text));
  parent.appendChild(item);
}

function formatDate(value){
  if(!value) return '';
  const date = new Date(value + 'T00:00:00');
  if(Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'});
}

function supabaseSetupCard(target){
  clearElement(target);
  const card = document.createElement('div');
  card.className = 'setup-card';
  addText(card, 'h2', 'Local demo mode');
  addText(card, 'p', 'Supabase is not configured yet, so this browser is using temporary local storage. Posts made here are useful for testing, but they will not appear for other visitors until Supabase is connected.');
  target.appendChild(card);
}

function readLocalJson(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(error){
    return fallback;
  }
}

function writeLocalJson(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function readSessionJson(key, fallback){
  try{
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(error){
    return fallback;
  }
}

function createLocalId(){
  if(window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'local-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function localUserFromRecord(record){
  if(!record) return null;
  return {
    id: record.id,
    email: record.email,
    user_metadata: { full_name: record.name }
  };
}

function localUserFromLegacyOwner(record){
  if(!record) return null;
  return {
    id: record.email,
    email: record.email,
    user_metadata: { full_name: record.name || record.email }
  };
}

async function hashLocalPassword(password){
  if(!window.crypto || !window.crypto.subtle) return password;
  const encoded = new TextEncoder().encode(password);
  const buffer = await window.crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getLocalSessionUser(){
  const session = readLocalJson(localSessionKey, null);
  const users = readLocalJson(localUsersKey, []);
  if(session){
    const user = localUserFromRecord(users.find(item => item.id === session.userId));
    if(user) return user;
  }

  const legacyOwner = readSessionJson(legacyActiveOwnerKey, null);
  if(legacyOwner) return localUserFromLegacyOwner(legacyOwner);

  return null;
}

async function localSignUp(name, email, password){
  const users = readLocalJson(localUsersKey, []);
  if(users.some(user => user.email.toLowerCase() === email.toLowerCase())){
    throw new Error('This email is already registered in local demo mode.');
  }
  const user = { id: createLocalId(), name, email, passwordHash: await hashLocalPassword(password) };
  users.push(user);
  writeLocalJson(localUsersKey, users);
  writeLocalJson(localSessionKey, { userId: user.id });
}

async function localSignIn(email, password){
  const users = readLocalJson(localUsersKey, []);
  const passwordHash = await hashLocalPassword(password);
  const user = users.find(item => item.email.toLowerCase() === email.toLowerCase() && item.passwordHash === passwordHash);
  if(user){
    writeLocalJson(localSessionKey, { userId: user.id });
    return;
  }

  const legacyOwners = readLocalJson(legacyOwnersKey, []);
  const legacyOwner = legacyOwners.find(item => item.email.toLowerCase() === email.toLowerCase() && item.passHash === passwordHash);
  if(legacyOwner){
    sessionStorage.setItem(legacyActiveOwnerKey, JSON.stringify({ email: legacyOwner.email, name: legacyOwner.name }));
    return;
  }

  throw new Error('Invalid login details.');
}

async function localSignOut(){
  localStorage.removeItem(localSessionKey);
  sessionStorage.removeItem(legacyActiveOwnerKey);
}

function localFileToDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(reader.error || new Error('Could not read file.')));
    reader.readAsDataURL(file);
  });
}

function validateFile(file){
  if(!file) return;
  if(file.size > maxFileBytes){
    throw new Error(file.name + ' is too large. Please use a file under 5 MB.');
  }
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  const imageOnly = file.type.startsWith('image/');
  if(imageOnly && !allowedImageTypes.has(file.type)){
    throw new Error(file.name + ' must be a JPG, PNG, or WebP image.');
  }
  if(!imageOnly && (!allowedDocumentTypes.has(file.type) || !allowedDocumentExtensions.has(extension))){
    throw new Error(file.name + ' must be a PDF or plain text document.');
  }
}

function safeText(value, field){
  const text = String(value || '').trim();
  const max = maxTextLengths[field];
  if(max && text.length > max){
    throw new Error(field + ' is too long. Please shorten it.');
  }
  return text;
}

function safeUrl(value){
  const text = safeText(value, 'applyUrl');
  if(!text) return '';
  let url;
  try{
    url = new URL(text);
  }catch(error){
    throw new Error('Application website link must be a valid URL.');
  }
  if(url.protocol !== 'https:' && url.protocol !== 'http:'){
    throw new Error('Application website link must start with https:// or http://.');
  }
  return url.href;
}

async function uploadFile(file, folder, userId, expectedKind){
  if(!file) return null;
  validateFile(file);
  if(expectedKind === 'image' && !allowedImageTypes.has(file.type)){
    throw new Error('Scholarship image must be a JPG, PNG, or WebP file.');
  }
  if(!supabaseReady){
    return {
      name: file.name,
      type: file.type || 'application/octet-stream',
      path: `${folder}/${userId}/${Date.now()}-${file.name}`,
      url: await localFileToDataUrl(file)
    };
  }
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120);
  const path = `${folder}/${userId}/${Date.now()}-${cleanName}`;
  const { error } = await supabase.storage.from(bucketName).upload(path, file, {
    cacheControl: '3600',
    upsert: false
  });
  if(error) throw error;

  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
  return {
    name: file.name,
    type: file.type || 'application/octet-stream',
    path,
    url: data.publicUrl
  };
}

function opportunityFromRow(row){
  return {
    id: row.id,
    title: row.title,
    provider: row.provider,
    summary: row.summary,
    deadline: row.deadline,
    amount: row.amount,
    applyUrl: row.apply_url,
    fullInfo: row.full_info,
    imageUrl: row.image_url,
    imagePath: row.image_path,
    documentUrl: row.document_url,
    documentPath: row.document_path,
    documentName: row.document_name,
    ownerUid: row.owner_uid,
    ownerEmail: row.owner_email,
    ownerName: row.owner_name,
    createdAt: row.created_at
  };
}

function rowFromLegacyOpportunity(item){
  if(!item) return null;
  return {
    id: String(item.id),
    title: item.title || '',
    provider: item.provider || 'OASISSCHOLARS',
    summary: item.summary || item.description || '',
    deadline: item.deadline || '',
    amount: item.amount || '',
    apply_url: item.applyUrl || '',
    full_info: item.fullInfo || item.description || item.summary || '',
    image_url: item.image && item.image.data ? item.image.data : '',
    image_path: '',
    document_url: item.document && item.document.data ? item.document.data : '',
    document_path: '',
    document_name: item.document && item.document.name ? item.document.name : '',
    owner_uid: item.owner || '',
    owner_email: item.owner || '',
    owner_name: item.owner || '',
    created_at: item.createdAt || new Date(Number(item.id) || Date.now()).toISOString()
  };
}

function getLocalOpportunityRows(){
  const currentRows = readLocalJson(localOpportunitiesKey, []);
  const legacyRows = readLocalJson(legacyOpportunitiesKey, [])
    .map(rowFromLegacyOpportunity)
    .filter(Boolean);
  const rowsById = new Map();
  legacyRows.forEach(row => rowsById.set(String(row.id), row));
  currentRows.forEach(row => rowsById.set(String(row.id), row));
  return Array.from(rowsById.values());
}

function buildOpportunityCard(opportunity, ownerView, onRemoved){
  const card = document.createElement('article');
  card.className = 'opportunity-card';

  const top = document.createElement('div');
  top.className = 'opportunity-card-top';

  const media = document.createElement('div');
  media.className = 'opportunity-card-media';
  if(opportunity.imageUrl){
    const image = document.createElement('img');
    image.className = 'opportunity-image';
    image.src = opportunity.imageUrl;
    image.alt = opportunity.title;
    media.appendChild(image);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'opportunity-image opportunity-image-placeholder';
    addText(placeholder, 'span', opportunity.provider || 'OASISSCHOLARS');
    addText(placeholder, 'strong', opportunity.title);
    media.appendChild(placeholder);
  }
  top.appendChild(media);

  const body = document.createElement('div');
  body.className = 'opportunity-card-body';
  addText(body, 'h2', opportunity.title);

  const meta = document.createElement('ul');
  meta.className = 'listing-meta-list';
  addListingMeta(meta, 'M12 1.75a10.25 10.25 0 1 0 0 20.5 10.25 10.25 0 0 0 0-20.5Zm.75 16.5h-1.5v-1.7a4.25 4.25 0 0 1-2.65-1.05l.95-1.25c.82.65 1.6.95 2.45.95.9 0 1.45-.4 1.45-1.05 0-.68-.5-.98-1.8-1.38-1.83-.55-2.75-1.25-2.75-2.8 0-1.38.92-2.38 2.35-2.68V5.75h1.5v1.5c.98.13 1.8.48 2.5 1.05l-.88 1.3c-.7-.48-1.35-.72-2.1-.72-.82 0-1.27.38-1.27.95 0 .62.42.9 1.92 1.35 1.72.52 2.62 1.3 2.62 2.85 0 1.45-.98 2.52-2.8 2.78v1.45Z', opportunity.amount || 'Fully Funded');
  addListingMeta(meta, 'M3 9.5 12 5l9 4.5-9 4.5-9-4.5Zm3 3.2 6 3 6-3V17c0 .35-.22.68-.6.9L12 21l-5.4-3.1A1.05 1.05 0 0 1 6 17v-4.3Z', opportunity.provider);
  addListingMeta(meta, 'M12 3 2 8l10 5 10-5-10-5Zm-7 8.2V18h2v-5.8l-2-1Zm4 2V18h2v-4h-2Zm4 0V18h2v-4h-2Zm4-1V18h2v-6.8l-2 1Z', 'Scholarship');
  addListingMeta(meta, 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H7a3 3 0 0 0-3 3V5.5Zm3 .5v10.5h11V5H7Zm-1 13h12v1.5H6.5A1.5 1.5 0 0 1 5 19c0-.55.45-1 1-1Z', 'All Subjects');
  addListingMeta(meta, 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 9h-3.15a15.8 15.8 0 0 0-1.1-5 8.05 8.05 0 0 1 4.25 5ZM12 4.05c.72 1.03 1.35 2.75 1.62 4.95h-3.24c.27-2.2.9-3.92 1.62-4.95ZM4.25 13h3.15c.12 1.82.5 3.55 1.1 5a8.05 8.05 0 0 1-4.25-5Zm3.15-2H4.25A8.05 8.05 0 0 1 8.5 6a15.8 15.8 0 0 0-1.1 5ZM12 19.95c-.72-1.03-1.35-2.75-1.62-4.95h3.24c-.27 2.2-.9 3.92-1.62 4.95ZM14 13h-4c-.05-.65-.08-1.32-.08-2s.03-1.35.08-2h4c.05.65.08 1.32.08 2s-.03 1.35-.08 2Zm1.5 5c.6-1.45.98-3.18 1.1-5h3.15a8.05 8.05 0 0 1-4.25 5Z', 'International Students');
  addListingMeta(meta, 'M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z', formatDate(opportunity.deadline));
  body.appendChild(meta);
  top.appendChild(body);
  card.appendChild(top);

  const actions = document.createElement('div');
  actions.className = 'listing-actions';
  const link = document.createElement('a');
  link.className = 'button listing-button';
  link.href = (ownerView ? '../' : '') + 'opportunity.html?id=' + encodeURIComponent(opportunity.id);
  link.textContent = 'LEARN MORE';
  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '\u2192';
  link.appendChild(arrow);
  actions.appendChild(link);
  actions.appendChild(buildShareActions(opportunity));

  if(ownerView){
    const remove = document.createElement('button');
    remove.className = 'button button-secondary';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', async () => {
      if(supabaseReady){
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq('id', opportunity.id)
          .eq('owner_uid', opportunity.ownerUid);
        if(error) throw error;
      } else {
        const posts = readLocalJson(localOpportunitiesKey, [])
          .filter(item => !(item.id === opportunity.id && item.owner_uid === opportunity.ownerUid));
        writeLocalJson(localOpportunitiesKey, posts);
        const legacyPosts = readLocalJson(legacyOpportunitiesKey, [])
          .filter(item => String(item.id) !== String(opportunity.id));
        writeLocalJson(legacyOpportunitiesKey, legacyPosts);
      }
      if(onRemoved) onRemoved();
    });
    actions.appendChild(remove);
  }

  card.appendChild(actions);

  const description = document.createElement('p');
  description.className = 'listing-description';
  description.textContent = opportunity.summary || '';
  card.appendChild(description);
  return card;
}

async function fetchOpportunities(){
  if(!supabaseReady){
    return getLocalOpportunityRows()
      .map(opportunityFromRow)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .order('created_at', { ascending: false });
  if(error) throw error;
  return data.map(opportunityFromRow);
}

async function renderPublicList(){
  const listEl = document.getElementById('opportunities-list');
  if(!listEl) return;

  try{
    const opportunities = await fetchOpportunities();
    clearElement(listEl);
    if(!opportunities.length){
      addText(listEl, 'p', 'No current opportunities yet.');
      return;
    }
    opportunities.forEach(item => listEl.appendChild(buildOpportunityCard(item, false)));
  }catch(error){
    clearElement(listEl);
    addText(listEl, 'p', 'Could not load opportunities: ' + error.message);
  }
}

async function renderOpportunityDetail(){
  const detailEl = document.getElementById('opportunity-detail');
  if(!detailEl) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if(!id){
    addText(detailEl, 'h1', 'Opportunity not found');
    addText(detailEl, 'p', 'Return to the opportunities page and choose an available scholarship.');
    return;
  }

  try{
    let data;
    if(supabaseReady){
      const response = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();
      if(response.error) throw response.error;
      data = response.data;
    } else {
      data = getLocalOpportunityRows().find(item => String(item.id) === String(id));
      if(!data) throw new Error('This local demo post was not found in this browser.');
    }

    const opportunity = opportunityFromRow(data);
    clearElement(detailEl);

    if(opportunity.imageUrl){
      const image = document.createElement('img');
      image.className = 'detail-hero-image';
      image.src = opportunity.imageUrl;
      image.alt = opportunity.title;
      detailEl.appendChild(image);
    }

    addText(detailEl, 'p', opportunity.provider, 'eyebrow');
    addText(detailEl, 'h1', opportunity.title);
    addText(detailEl, 'p', opportunity.summary, 'detail-summary');

    const meta = document.createElement('div');
    meta.className = 'detail-meta';
    addMeta(meta, 'Deadline', formatDate(opportunity.deadline));
    addMeta(meta, 'Award', opportunity.amount);
    detailEl.appendChild(meta);

    const info = document.createElement('section');
    info.className = 'detail-section';
    addText(info, 'h2', 'Full Information');
    String(opportunity.fullInfo || '').split(/\n{2,}/).forEach(block => {
      const cleaned = block.trim();
      if(cleaned) addText(info, 'p', cleaned);
    });
    detailEl.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'detail-actions';
    if(opportunity.applyUrl){
      const apply = document.createElement('a');
      apply.className = 'button button-primary';
      apply.href = opportunity.applyUrl;
      apply.target = '_blank';
      apply.rel = 'noopener noreferrer';
      apply.textContent = 'Open application website';
      actions.appendChild(apply);
    }
    if(opportunity.documentUrl){
      const docLink = document.createElement('a');
      docLink.className = 'button button-secondary';
      docLink.href = opportunity.documentUrl;
      docLink.target = '_blank';
      docLink.rel = 'noopener noreferrer';
      docLink.textContent = 'Open scholarship document';
      actions.appendChild(docLink);
    }
    actions.appendChild(buildShareActions(opportunity));
    detailEl.appendChild(actions);
  }catch(error){
    clearElement(detailEl);
    addText(detailEl, 'p', 'Could not load this opportunity: ' + error.message);
  }
}

function setupLoginPage(){
  if(!document.getElementById('owner-form')) return;
  const msg = document.getElementById('owner-message');
  if(!supabaseReady){
    setMessage(msg, '');
  }

  document.getElementById('register-btn').addEventListener('click', async () => {
    try{
      const name = safeText(document.getElementById('owner-name').value, 'name');
      const email = document.getElementById('owner-email').value.trim().toLowerCase();
      const password = document.getElementById('owner-password').value;
      if(!name || !email || !password) throw new Error('All fields required');
      if(password.length < 8) throw new Error('Password must be at least 8 characters.');

      if(supabaseReady){
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } }
        });
        if(error) throw error;
      } else {
        await localSignUp(name, email, password);
      }
      window.location.href = 'dashboard.html';
    }catch(error){
      setMessage(msg, error.message);
    }
  });

  document.getElementById('login-btn').addEventListener('click', async () => {
    try{
      const email = document.getElementById('owner-email').value.trim().toLowerCase();
      const password = document.getElementById('owner-password').value;
      if(supabaseReady){
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if(error) throw error;
      } else {
        await localSignIn(email, password);
      }
      window.location.href = 'dashboard.html';
    }catch(error){
      setMessage(msg, error.message);
    }
  });
}

async function setupDashboard(){
  if(!document.getElementById('post-form')) return;
  const msg = document.getElementById('post-message');
  const postsEl = document.getElementById('owner-posts');

  if(!supabaseReady){
    setMessage(msg, '');
  }

  let user;
  if(supabaseReady){
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if(userError || !userData.user){
      window.location.href = 'login.html';
      return;
    }
    user = userData.user;
  } else {
    user = getLocalSessionUser();
    if(!user){
      window.location.href = 'login.html';
      return;
    }
  }

  const logoutLink = document.getElementById('logout-link');
  if(logoutLink){
    logoutLink.style.display = 'inline-block';
    logoutLink.addEventListener('click', async event => {
      event.preventDefault();
      if(supabaseReady){
        await supabase.auth.signOut();
      } else {
        await localSignOut();
      }
      window.location.href = 'login.html';
    });
  }

  const form = document.getElementById('post-form');
  const imageInput = document.getElementById('image');
  const imagePreview = document.getElementById('image-preview');
  const documentInput = document.getElementById('document');
  const documentPreview = document.getElementById('document-preview');

  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    clearElement(imagePreview);
    if(!file){
      imagePreview.textContent = 'Image preview will appear here.';
      return;
    }
    try{
      validateFile(file);
      const image = document.createElement('img');
      image.src = URL.createObjectURL(file);
      image.alt = file.name;
      imagePreview.appendChild(image);
    }catch(error){
      setMessage(msg, error.message);
    }
  });

  documentInput.addEventListener('change', () => {
    const file = documentInput.files[0];
    try{
      validateFile(file);
      documentPreview.textContent = file ? 'Selected document: ' + file.name : 'Attach a PDF, text file, or safe image with scholarship requirements.';
    }catch(error){
      setMessage(msg, error.message);
    }
  });

  document.getElementById('clear-btn').addEventListener('click', () => {
    form.reset();
    imagePreview.textContent = 'Image preview will appear here.';
    documentPreview.textContent = 'Attach a PDF, text file, or safe image with scholarship requirements.';
    setMessage(msg, '');
  });

  async function renderOwnerPosts(){
    try{
      let data;
      if(supabaseReady){
        const response = await supabase
          .from(tableName)
          .select('*')
          .eq('owner_uid', user.id)
          .order('created_at', { ascending: false });
        if(response.error) throw response.error;
        data = response.data;
      } else {
        data = getLocalOpportunityRows()
          .filter(item => item.owner_uid === user.id || item.owner_email === user.email)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }

      clearElement(postsEl);
      if(!data.length){
        addText(postsEl, 'p', 'No posts yet.');
        return;
      }
      data.map(opportunityFromRow).forEach(item => {
        postsEl.appendChild(buildOpportunityCard(item, true, renderOwnerPosts));
      });
    }catch(error){
      clearElement(postsEl);
      addText(postsEl, 'p', 'Could not load your posts: ' + error.message);
    }
  }

  await renderOwnerPosts();

  document.getElementById('post-btn').addEventListener('click', async () => {
    try{
      if(!form.reportValidity()) return;
      setMessage(msg, 'Uploading and saving opportunity...');

      const image = await uploadFile(imageInput.files[0], 'opportunity-images', user.id, 'image');
      const scholarshipDocument = await uploadFile(documentInput.files[0], 'opportunity-documents', user.id, 'document');

      const row = {
        id: createLocalId(),
        title: safeText(document.getElementById('title').value, 'title'),
        provider: safeText(document.getElementById('provider').value, 'provider'),
        summary: safeText(document.getElementById('summary').value, 'summary'),
        deadline: document.getElementById('deadline').value,
        amount: safeText(document.getElementById('amount').value, 'amount'),
        apply_url: safeUrl(document.getElementById('apply-url').value),
        full_info: safeText(document.getElementById('full-info').value, 'fullInfo'),
        image_url: image ? image.url : '',
        image_path: image ? image.path : '',
        document_url: scholarshipDocument ? scholarshipDocument.url : '',
        document_path: scholarshipDocument ? scholarshipDocument.path : '',
        document_name: scholarshipDocument ? scholarshipDocument.name : '',
        owner_uid: user.id,
        owner_email: user.email,
        owner_name: user.user_metadata ? user.user_metadata.full_name || '' : '',
        created_at: new Date().toISOString()
      };

      if(supabaseReady){
        const { error } = await supabase.from(tableName).insert(row);
        if(error) throw error;
      } else {
        const posts = readLocalJson(localOpportunitiesKey, []);
        posts.unshift(row);
        writeLocalJson(localOpportunitiesKey, posts);
      }

      form.reset();
      imagePreview.textContent = 'Image preview will appear here.';
      documentPreview.textContent = 'Attach a PDF, text file, or safe image with scholarship requirements.';
      setMessage(msg, 'Posted successfully. Everyone can now see it on Opportunities.');
      await renderOwnerPosts();
    }catch(error){
      setMessage(msg, error.message);
    }
  });
}

async function startApp(){
  try{
    await initSupabase();
    setupLoginPage();
    await setupDashboard();
    await renderPublicList();
    await renderOpportunityDetail();
  }catch(error){
    const target = document.getElementById('owner-message') ||
      document.getElementById('post-message') ||
      document.getElementById('opportunities-list') ||
      document.getElementById('opportunity-detail');
    if(target) setMessage(target, 'Could not start the owner tools: ' + error.message);
  }
}

startApp();
