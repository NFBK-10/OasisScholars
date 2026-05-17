// owners/owners.js - simple client-side prototype for owner auth and posting
(function(){
  const storageOwnersKey = 'oasis_owners_v1';
  const storageOpsKey = 'oasis_ops_v1';

  function sha256(text){
    const enc = new TextEncoder();
    return crypto.subtle.digest('SHA-256', enc.encode(text)).then(buf=>{
      return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    });
  }

  function getOwners(){
    return JSON.parse(localStorage.getItem(storageOwnersKey)||'[]');
  }
  function saveOwners(list){ localStorage.setItem(storageOwnersKey, JSON.stringify(list)); }

  function getOps(){ return JSON.parse(localStorage.getItem(storageOpsKey)||'[]'); }
  function saveOps(list){ localStorage.setItem(storageOpsKey, JSON.stringify(list)); }

  // Registration
  async function registerOwner(name,email,password){
    const owners = getOwners();
    if(owners.find(o=>o.email===email)) throw new Error('An owner with that email already exists');
    const passHash = await sha256(password);
    owners.push({name,email,passHash});
    saveOwners(owners);
    return true;
  }

  // Login
  async function loginOwner(email,password){
    const owners = getOwners();
    const o = owners.find(x=>x.email===email);
    if(!o) throw new Error('No owner with that email');
    const passHash = await sha256(password);
    if(o.passHash !== passHash) throw new Error('Invalid password');
    sessionStorage.setItem('oasis_owner_active', JSON.stringify({email:o.email,name:o.name}));
    return o;
  }

  function logoutOwner(){ sessionStorage.removeItem('oasis_owner_active'); }
  function getActiveOwner(){ return JSON.parse(sessionStorage.getItem('oasis_owner_active')||'null'); }

  // Posting
  function createOpportunity(title,description,deadline){
    const owner = getActiveOwner();
    if(!owner) throw new Error('Not authenticated');
    const ops = getOps();
    const id = Date.now();
    ops.unshift({id,title,description,deadline,owner:owner.email});
    saveOps(ops);
    return id;
  }

  function removeOpportunity(id){
    let ops = getOps();
    ops = ops.filter(o=>o.id!==id);
    saveOps(ops);
  }

  // UI glue - login page
  if(document.getElementById('owner-form')){
    const form = document.getElementById('owner-form');
    const msg = document.getElementById('owner-message');
    document.getElementById('register-btn').addEventListener('click', async ()=>{
      try{
        const name = document.getElementById('owner-name').value.trim();
        const email = document.getElementById('owner-email').value.trim();
        const password = document.getElementById('owner-password').value;
        if(!name||!email||!password) throw new Error('All fields required');
        await registerOwner(name,email,password);
        msg.textContent = 'Registered. You can now login.';
      }catch(e){ msg.textContent = e.message; }
    });
    document.getElementById('login-btn').addEventListener('click', async ()=>{
      try{
        const email = document.getElementById('owner-email').value.trim();
        const password = document.getElementById('owner-password').value;
        await loginOwner(email,password);
        window.location.href = 'dashboard.html';
      }catch(e){ msg.textContent = e.message; }
    });
  }

  // UI glue - dashboard page
  if(document.getElementById('post-form')){
    const owner = getActiveOwner();
    if(!owner){ window.location.href = 'login.html'; }
    document.getElementById('logout-link').style.display = 'inline-block';
    const postForm = document.getElementById('post-form');
    const msg = document.getElementById('post-message');
    const refreshPosts = ()=>{
      const postsEl = document.getElementById('owner-posts');
      postsEl.innerHTML = '';
      const ops = getOps().filter(o=>o.owner===owner.email);
      if(ops.length===0) postsEl.innerHTML = '<p>No posts yet.</p>';
      ops.forEach(o=>{
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<h4>${o.title}</h4><p>${o.description}</p><p class="meta">Deadline: ${o.deadline}</p><button data-id="${o.id}" class="button">Remove</button>`;
        postsEl.appendChild(card);
      });
      postsEl.querySelectorAll('button[data-id]').forEach(b=>{
        b.addEventListener('click', (ev)=>{
          const id = Number(ev.currentTarget.getAttribute('data-id'));
          removeOpportunity(id);
          refreshPosts();
        });
      });
    };
    document.getElementById('post-btn').addEventListener('click', ()=>{
      try{
        const title = document.getElementById('title').value.trim();
        const description = document.getElementById('description').value.trim();
        const deadline = document.getElementById('deadline').value;
        if(!title||!description||!deadline) throw new Error('All fields required');
        createOpportunity(title,description,deadline);
        msg.textContent = 'Posted successfully.';
        postForm.reset();
        refreshPosts();
      }catch(e){ msg.textContent = e.message; }
    });
    refreshPosts();
  }

  // UI glue - opportunities page (public listing)
  if(document.getElementById('opportunities-list')){
    const listEl = document.getElementById('opportunities-list');
    const render = ()=>{
      listEl.innerHTML = '';
      const ops = getOps();
      if(ops.length===0){ listEl.innerHTML = '<p>No current opportunities. Owners can post via the Owners Portal.</p>'; return; }
      ops.forEach(o=>{
        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `<h2>${o.title}</h2><p>${o.description}</p><p class="meta">Deadline: ${o.deadline}</p>`;
        listEl.appendChild(card);
      });
    };
    render();
  }

  // Expose for console if needed
  window.OasisOwners = {registerOwner,loginOwner,logoutOwner,getActiveOwner,getOps,createOpportunity,removeOpportunity};
})();
