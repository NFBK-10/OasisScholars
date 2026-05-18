// owners/owners.js - client-side owner auth and scholarship posting
(function(){
  const storageOwnersKey = 'oasis_owners_v1';
  const storageOpsKey = 'oasis_ops_v2';
  const activeOwnerKey = 'oasis_owner_active';
  const maxFileBytes = 4 * 1024 * 1024;

  function sha256(text){
    const enc = new TextEncoder();
    return crypto.subtle.digest('SHA-256', enc.encode(text)).then(buf=>{
      return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    });
  }

  function getOwners(){
    return JSON.parse(localStorage.getItem(storageOwnersKey) || '[]');
  }

  function saveOwners(list){
    localStorage.setItem(storageOwnersKey, JSON.stringify(list));
  }

  function getOps(){
    const modern = JSON.parse(localStorage.getItem(storageOpsKey) || '[]');
    const old = JSON.parse(localStorage.getItem('oasis_ops_v1') || '[]');
    if(modern.length || !old.length) return modern;
    return old.map(item => ({
      id: item.id,
      title: item.title,
      provider: 'OASISSCHOLARS',
      summary: item.description,
      fullInfo: item.description,
      deadline: item.deadline,
      amount: '',
      applyUrl: '',
      image: null,
      document: null,
      owner: item.owner,
      createdAt: item.id
    }));
  }

  function saveOps(list){
    localStorage.setItem(storageOpsKey, JSON.stringify(list));
  }

  function getActiveOwner(){
    return JSON.parse(sessionStorage.getItem(activeOwnerKey) || 'null');
  }

  function logoutOwner(){
    sessionStorage.removeItem(activeOwnerKey);
  }

  async function registerOwner(name,email,password){
    const owners = getOwners();
    if(owners.find(o => o.email === email)) throw new Error('An owner with that email already exists');
    const passHash = await sha256(password);
    owners.push({name,email,passHash});
    saveOwners(owners);
  }

  async function loginOwner(email,password){
    const owners = getOwners();
    const owner = owners.find(x => x.email === email);
    if(!owner) throw new Error('No owner with that email');
    const passHash = await sha256(password);
    if(owner.passHash !== passHash) throw new Error('Invalid password');
    sessionStorage.setItem(activeOwnerKey, JSON.stringify({email: owner.email, name: owner.name}));
    return owner;
  }

  function readFile(file){
    return new Promise((resolve, reject) => {
      if(!file){
        resolve(null);
        return;
      }
      if(file.size > maxFileBytes){
        reject(new Error(file.name + ' is too large. Please use a file under 4 MB.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({
        name: file.name,
        type: file.type || 'application/octet-stream',
        data: reader.result
      });
      reader.onerror = () => reject(new Error('Could not read ' + file.name));
      reader.readAsDataURL(file);
    });
  }

  function createOpportunity(data){
    const owner = getActiveOwner();
    if(!owner) throw new Error('Not authenticated');
    const ops = getOps();
    const id = Date.now();
    ops.unshift({
      id,
      title: data.title,
      provider: data.provider,
      summary: data.summary,
      fullInfo: data.fullInfo,
      deadline: data.deadline,
      amount: data.amount,
      applyUrl: data.applyUrl,
      image: data.image,
      document: data.document,
      owner: owner.email,
      createdAt: new Date().toISOString()
    });
    saveOps(ops);
    return id;
  }

  function removeOpportunity(id){
    saveOps(getOps().filter(o => o.id !== id));
  }

  function clearElement(element){
    while(element.firstChild) element.removeChild(element.firstChild);
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

  function formatDate(value){
    if(!value) return '';
    const date = new Date(value + 'T00:00:00');
    if(Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'});
  }

  function buildOpportunityCard(opportunity, ownerView){
    const card = document.createElement('article');
    card.className = 'opportunity-card';

    if(opportunity.image && opportunity.image.data){
      const image = document.createElement('img');
      image.className = 'opportunity-image';
      image.src = opportunity.image.data;
      image.alt = opportunity.title;
      card.appendChild(image);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'opportunity-image opportunity-image-placeholder';
      placeholder.textContent = 'OASISSCHOLARS';
      card.appendChild(placeholder);
    }

    const body = document.createElement('div');
    body.className = 'opportunity-card-body';
    addText(body, 'p', opportunity.provider, 'eyebrow small-eyebrow');
    addText(body, 'h2', opportunity.title);
    addText(body, 'p', opportunity.summary);
    addMeta(body, 'Deadline', formatDate(opportunity.deadline));
    addMeta(body, 'Award', opportunity.amount);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const link = document.createElement('a');
    link.className = 'button button-primary';
    link.href = (ownerView ? '../' : '') + 'opportunity.html?id=' + encodeURIComponent(opportunity.id);
    link.textContent = 'See more information';
    actions.appendChild(link);

    if(ownerView){
      const remove = document.createElement('button');
      remove.className = 'button button-secondary';
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        removeOpportunity(opportunity.id);
        renderOwnerPosts();
      });
      actions.appendChild(remove);
    }

    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  function renderOwnerPosts(){
    const postsEl = document.getElementById('owner-posts');
    if(!postsEl) return;
    const owner = getActiveOwner();
    clearElement(postsEl);
    const ops = getOps().filter(o => owner && o.owner === owner.email);
    if(!ops.length){
      addText(postsEl, 'p', 'No posts yet.');
      return;
    }
    ops.forEach(o => postsEl.appendChild(buildOpportunityCard(o, true)));
  }

  function renderPublicList(){
    const listEl = document.getElementById('opportunities-list');
    if(!listEl) return;
    clearElement(listEl);
    const ops = getOps();
    if(!ops.length){
      addText(listEl, 'p', 'No current opportunities. Owners can post via the Owners Portal.');
      return;
    }
    ops.forEach(o => listEl.appendChild(buildOpportunityCard(o, false)));
  }

  function renderOpportunityDetail(){
    const detailEl = document.getElementById('opportunity-detail');
    if(!detailEl) return;
    clearElement(detailEl);
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get('id'));
    const opportunity = getOps().find(o => Number(o.id) === id);

    if(!opportunity){
      addText(detailEl, 'h1', 'Opportunity not found');
      addText(detailEl, 'p', 'Return to the opportunities page and choose an available scholarship.');
      const back = document.createElement('a');
      back.className = 'button button-primary';
      back.href = 'opportunities.html';
      back.textContent = 'Back to opportunities';
      detailEl.appendChild(back);
      return;
    }

    if(opportunity.image && opportunity.image.data){
      const image = document.createElement('img');
      image.className = 'detail-hero-image';
      image.src = opportunity.image.data;
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
    if(opportunity.document && opportunity.document.data){
      const doc = document.createElement('a');
      doc.className = 'button button-secondary';
      doc.href = opportunity.document.data;
      doc.download = opportunity.document.name || 'scholarship-document';
      doc.textContent = 'Download scholarship document';
      actions.appendChild(doc);
    }
    detailEl.appendChild(actions);
  }

  if(document.getElementById('owner-form')){
    const msg = document.getElementById('owner-message');
    document.getElementById('register-btn').addEventListener('click', async () => {
      try{
        const name = document.getElementById('owner-name').value.trim();
        const email = document.getElementById('owner-email').value.trim();
        const password = document.getElementById('owner-password').value;
        if(!name || !email || !password) throw new Error('All fields required');
        await registerOwner(name,email,password);
        msg.textContent = 'Registered. You can now login.';
      }catch(e){
        msg.textContent = e.message;
      }
    });
    document.getElementById('login-btn').addEventListener('click', async () => {
      try{
        const email = document.getElementById('owner-email').value.trim();
        const password = document.getElementById('owner-password').value;
        await loginOwner(email,password);
        window.location.href = 'dashboard.html';
      }catch(e){
        msg.textContent = e.message;
      }
    });
  }

  if(document.getElementById('post-form')){
    const owner = getActiveOwner();
    if(!owner){
      window.location.href = 'login.html';
      return;
    }

    const logoutLink = document.getElementById('logout-link');
    if(logoutLink){
      logoutLink.style.display = 'inline-block';
      logoutLink.addEventListener('click', logoutOwner);
    }

    const form = document.getElementById('post-form');
    const msg = document.getElementById('post-message');
    const imageInput = document.getElementById('image');
    const imagePreview = document.getElementById('image-preview');
    const documentInput = document.getElementById('document');
    const documentPreview = document.getElementById('document-preview');

    imageInput.addEventListener('change', async () => {
      const file = imageInput.files[0];
      clearElement(imagePreview);
      if(!file){
        imagePreview.textContent = 'Image preview will appear here.';
        return;
      }
      const image = await readFile(file);
      const img = document.createElement('img');
      img.src = image.data;
      img.alt = file.name;
      imagePreview.appendChild(img);
    });

    documentInput.addEventListener('change', () => {
      const file = documentInput.files[0];
      documentPreview.textContent = file ? 'Selected document: ' + file.name : 'Attach a PDF, Word document, text file, or image with scholarship requirements.';
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
      form.reset();
      imagePreview.textContent = 'Image preview will appear here.';
      documentPreview.textContent = 'Attach a PDF, Word document, text file, or image with scholarship requirements.';
      msg.textContent = '';
    });

    document.getElementById('post-btn').addEventListener('click', async () => {
      try{
        if(!form.reportValidity()) return;
        const title = document.getElementById('title').value.trim();
        const provider = document.getElementById('provider').value.trim();
        const summary = document.getElementById('summary').value.trim();
        const deadline = document.getElementById('deadline').value;
        const amount = document.getElementById('amount').value.trim();
        const applyUrl = document.getElementById('apply-url').value.trim();
        const fullInfo = document.getElementById('full-info').value.trim();
        if(!title || !provider || !summary || !deadline || !fullInfo) throw new Error('Headline, provider, short text, deadline, and full information are required');

        const image = await readFile(imageInput.files[0]);
        const scholarshipDocument = await readFile(documentInput.files[0]);
        createOpportunity({title, provider, summary, deadline, amount, applyUrl, fullInfo, image, document: scholarshipDocument});
        msg.textContent = 'Posted successfully. Open Opportunities to see the public card.';
        form.reset();
        imagePreview.textContent = 'Image preview will appear here.';
        documentPreview.textContent = 'Attach a PDF, Word document, text file, or image with scholarship requirements.';
        renderOwnerPosts();
      }catch(e){
        msg.textContent = e.message;
      }
    });

    renderOwnerPosts();
  }

  renderPublicList();
  renderOpportunityDetail();

  window.OasisOwners = {registerOwner, loginOwner, logoutOwner, getActiveOwner, getOps, createOpportunity, removeOpportunity};
})();
