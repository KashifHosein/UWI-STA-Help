// main.js — UWI Help MVP (Auth & Step-by-step Explore)

// =========================
// Firebase Imports
// =========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, signOut, updateProfile 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase_config.js";

// =========================
// Firebase Init
// =========================
initializeApp(firebaseConfig);
const auth = getAuth();

// =========================
// Utilities
// =========================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const fmtDT = (d) => new Date(d).toLocaleString();
const escapeHtml = (str)=> str.replace(/[&<>\"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[m]));

// =========================
// Theme
// =========================
function setTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('uwi-theme', theme);
}
(function initTheme(){
  setTheme(localStorage.getItem('uwi-theme') || 'dark');
})();
$('#themeToggle').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  setTheme(cur === 'dark' ? 'light' : 'dark');
});

// =========================
// Routing
// =========================
const pages = { 
  home: $('#page-home'), 
  explore: $('#page-explore'), 
  events: $('#page-events') // Removed forum reference
};

function goto(page) {
  Object.values(pages).forEach(el => el && el.classList.add('hidden'));

  // navigate to a course forum automatically by reproducing the Explore flow
  if (page && page.startsWith('forum:')) {
    const courseCode = page.split(':')[1];

    // show Explore page first
    pages.explore?.classList.remove('hidden');

    // Try to locate course in the CATALOG and drive the step UI directly
    let found = false;
    for (const fac of Object.keys(CATALOG)) {
      for (const dept of Object.keys(CATALOG[fac])) {
        const courses = CATALOG[fac][dept] || [];
        if (courses.includes(courseCode)) {
          // set the selection state and drive the existing build functions
          selFaculty = fac;
          selDept = dept;
          selCourse = courseCode;

          // populate step 2 (depts) and show it
          buildStep2();
          setStep(2);

          // give the DOM a moment then populate step 3 and show it,
          // then open the forum (step 4)
          setTimeout(() => {
            buildStep3();
            setStep(3);
            setTimeout(() => {
              // openForum is already wired to render the forum for a course
              openForum(courseCode);
              setStep(4);
            }, 40);
          }, 40);

          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      // Fallback: try to simulate clicking the course entry in Explore (if DOM uses different structure)
      const tryNavigateInExplore = () => {
        const exploreRoot = pages.explore || $('#page-explore');
        if (!exploreRoot) return false;

        // prefer explicit data attributes if present
        let el = exploreRoot.querySelector(`[data-course-code="${courseCode}"], [data-code="${courseCode}"], [data-course="${courseCode}"]`);

        // fallback: find element whose text matches the course code
        if (!el) {
          const candidates = Array.from(exploreRoot.querySelectorAll('button, a, div, span'));
          el = candidates.find(e => e.textContent && e.textContent.trim().toUpperCase() === courseCode.toUpperCase());
        }

        if (!el) return false;
        const clickable = el.closest('button, a') || el;
        clickable.click();
        return true;
      };

      const ok = tryNavigateInExplore();
      if (!ok) {
        setTimeout(() => {
          const ok2 = tryNavigateInExplore();
          if (!ok2 && typeof openForum === 'function') openForum(courseCode); // final fallback
        }, 150);
      }
    }

    // show explore tab as active
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.goto === 'explore'));
    return;
  }

  // standard page navigation
  pages[page]?.classList.remove('hidden');
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.goto === page));
}
$$('.tab').forEach(t => t.addEventListener('click', () => goto(t.dataset.goto)));

// =========================
// Auth DOM elements
// =========================
const authBox = $('#authBox'), profileBox = $('#profileBox');
const authDialog = $('#authDialog'), authForm = $('#authForm');
const authTitle = $('#authTitle'), authEmail = $('#authEmail'), authPass = $('#authPass');
const authError = $('#authError'), authSubmit = $('#authSubmit');
let authMode = 'signup';

function openAuth(mode) {
  authMode = mode;
  authTitle.textContent = mode === 'signup' ? 'Sign Up' : 'Log In';
  authEmail.value = authPass.value = '';
  authError.textContent = '';
  authDialog.showModal();
}

// ✅ Manual submit handler
authSubmit.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  const pass = authPass.value.trim();

  if (!email || !pass) {
    authError.textContent = 'Email and password are required.';
    return;
  }

  try {
    if (authMode === 'signup') {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const displayName = email.split('@')[0];
      await updateProfile(cred.user, { displayName });
      console.log('User signed up:', cred.user);
    } else {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      console.log('User logged in:', cred.user);
    }

    authForm.returnValue = 'confirm'; // ✅ Set manually
    authDialog.close();              // ✅ Close manually
    updateUI();                      // ✅ Refresh UI
  } catch (err) {
    console.error(err);
    authError.textContent = err.message;
  }
});


// =========================
// Auth State Change
// =========================
function renderAuthStatus(user) {
  const box = $('#authStatus');
  box.innerHTML = '';
  if (!user) {
    // Not signed in: show Sign Up and Log In buttons
    const signUpBtn = document.createElement('button');
    signUpBtn.id = 'btnSignUp';
    signUpBtn.className = 'btn primary';
    signUpBtn.textContent = 'Sign Up';
    signUpBtn.onclick = () => openAuth('signup');

    const signInBtn = document.createElement('button');
    signInBtn.id = 'btnSignIn';
    signInBtn.className = 'btn';
    signInBtn.textContent = 'Log In';
    signInBtn.onclick = () => openAuth('login');

    const statusText = document.createElement('span');
    statusText.className = 'muted';
    statusText.textContent = 'Not signed in';

    box.appendChild(statusText);
    box.appendChild(signUpBtn);
    box.appendChild(signInBtn);
  } else {
    // Signed in: show "Logged in" and Log Out button
    const loggedInText = document.createElement('span');
    loggedInText.textContent = 'Logged in';
    loggedInText.style.marginRight = '8px';

    const signOutBtn = document.createElement('button');
    signOutBtn.id = 'btnSignOut';
    signOutBtn.className = 'btn danger';
    signOutBtn.textContent = 'Log Out';
    signOutBtn.onclick = async () => await signOut(auth);

    box.appendChild(loggedInText);
    box.appendChild(signOutBtn);
  }
}

onAuthStateChanged(auth, user => {
  renderAuthStatus(user);
  if(user){
    renderProfileBox(user.uid); renderHome(user.uid);
  } else {
    profileBox.textContent = 'Sign in to see your profile.';
    $('#enrolledList').innerHTML = ''; $('#bookmarkedEvents').innerHTML = '';
  }
});

// =========================
// Local user storage
// =========================
function userKey(uid){ return `uwi-user-${uid}`; }
function getUserState(uid){
  try { return JSON.parse(localStorage.getItem(userKey(uid))) || { courses: [], bookmarks: [], rsvps: {}, roles: ["student"] }; }
  catch{ return { courses: [], bookmarks: [], rsvps: {}, roles: ["student"] }; }
}
function setUserState(uid, obj){ localStorage.setItem(userKey(uid), JSON.stringify(obj)); }

// =========================
// Profile popup
// =========================
const profilePop = $('#profilePop');
$('#profileClose').addEventListener('click', () => profilePop.style.display='none');

function showProfile() {
  const u = auth.currentUser; if (!u) return;
  const st = getUserState(u.uid);
  $('#profileContent').innerHTML = `
    <div style="display:flex; align-items:center; gap:10px">
      <div style="font-weight:700; font-size:18px">${escapeHtml(u.displayName || (u.email||'').split('@')[0])}</div>
      <span class="chip">${(st.roles||[]).join(', ')}</span>
    </div>
    <div class="muted" style="margin-top:6px">${u.email || ''}</div>
    <div style="margin-top:8px"><strong>Enrolled:</strong> ${(st.courses||[]).join(', ') || '—'}</div>
    <div style="margin-top:8px"><strong>Bookmarked events:</strong> ${(st.bookmarks||[]).length}</div>
  `;
  profilePop.style.display='flex';
}

// =========================
// Profile card (home)
// =========================
function renderProfileBox(uid) {
  const u = auth.currentUser;
  const st = getUserState(uid);
  profileBox.innerHTML = `
    <div><strong>${u.displayName || (u.email||'').split('@')[0]}</strong></div>
    <div class="muted">${u.email || ''}</div>
    <div style="margin-top:8px">
      <div><strong>Roles:</strong> ${(st.roles||[]).join(', ')}</div>
      <div style="margin-top:4px"><strong>Enrolled:</strong> ${(st.courses||[]).join(', ') || '—'}</div>
      <div style="margin-top:8px"><button class="btn" id="manageCoursesBtn">Add/Remove Courses</button></div>
    </div>
  `;
  $('#manageCoursesBtn').addEventListener('click', () => goto('explore'));
}

// =========================
// HOME data (from localStorage per user)
// =========================
function renderHome(uid) {
  const st = getUserState(uid);

  // Enrolled courses
  const list = $('#enrolledList'); list.innerHTML = '';
  (st.courses || []).forEach(code => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px">
        <div><div style="font-weight:700">${code}</div><div class="muted">Forum shortcut</div></div>
        <button class="btn" data-open-forum="${code}">Open Forum</button>
      </div>`;
    list.appendChild(card);
  });
  list.querySelectorAll('[data-open-forum]').forEach(btn => btn.addEventListener('click', (e) => {
    const code = e.currentTarget.getAttribute('data-open-forum');
    goto(`forum:${code}`); // Navigate directly to the course forum
  }));

  // Bookmarked events
  const bmWrap = $('#bookmarkedEvents'); bmWrap.innerHTML = '';
  (st.bookmarks || []).forEach(id => {
    const ev = EVENTS.find(x => x.id === id); if (!ev) return;
    bmWrap.appendChild(renderEventCard(ev, {compact:true}));
  });
}

// =========================
// Static Catalog (Fac → Dept → Courses)
// =========================
const CATALOG = {
  "Faculty of Science and Technology": {
    "Department of Computing and Information Technology": ["COMP1601","COMP1602","COMP2601","INFO2602"],
    "Department of Life Sciences": ["BIOL1261","BIOL1362"]
  },
  "Engineering": {
    "Department of Electrical and Computer Engineering": ["EEET1010","COMP3605"]
  },
  "Social Sciences": {
    "Department of Economics": ["ECON1001"]
  },
  "Humanities and Education": {
    "School of Education": ["EDFA1001"]
  },
  "Law": { "Faculty of Law": ["LAW1210","LAW2210"] },
  "Food and Agriculture": { "Department of Agricultural Economics": ["AGRI1001"] },
  "Sport": { "Faculty of Sport": ["SPRT1001"] }
};

// =========================
// Explore (Step-by-step)
// =========================
let selFaculty = null, selDept = null, selCourse = null;

// Step indicators
function setStep(n) {
  [1,2,3,4].forEach(i => $('#dot'+i).classList.toggle('active', i<=n));
  [1,2,3].forEach(i => $('#seg'+i).classList.toggle('active', i<n));
  ['step-1','step-2','step-3','step-4'].forEach((id,idx)=>{
    $('#'+id).classList.toggle('hidden', idx!==n-1);
  });
}
setStep(1);

// Build Step 1
const facultyList = $('#facultyList');
Object.keys(CATALOG).forEach(f => {
  const b = document.createElement('button');
  b.className = 'btn link';
  b.textContent = f;
  b.addEventListener('click', () => {
    selFaculty = f; selDept = null; selCourse = null;
    buildStep2(); setStep(2);
  });
  facultyList.appendChild(b);
});

// Build Step 2
const pickedFaculty = $('#pickedFaculty');
const deptList = $('#deptList');
$('#backTo1').addEventListener('click', () => setStep(1));

function buildStep2() {
  pickedFaculty.textContent = selFaculty;
  deptList.innerHTML = '';
  Object.keys(CATALOG[selFaculty] || {}).forEach(d => {
    const b = document.createElement('button');
    b.className = 'btn link'; b.textContent = d;
    b.addEventListener('click', () => {
      selDept = d; selCourse = null;
      buildStep3(); setStep(3);
    });
    deptList.appendChild(b);
  });
}

// Build Step 3
const pickedDept = $('#pickedDept');
const courseList = $('#courseList');
$('#backTo2').addEventListener('click', () => setStep(2));

function buildStep3() {
  pickedDept.textContent = `${selFaculty} • ${selDept}`;
  courseList.innerHTML = '';
  (CATALOG[selFaculty][selDept] || []).forEach(c => {
    const b = document.createElement('button');
    b.className = 'btn link'; b.textContent = c;
    b.addEventListener('click', () => {
      selCourse = c;
      openForum(c);
      setStep(4);
    });
    courseList.appendChild(b);
  });
}

// =========================
// Forum (local posts + enroll via localStorage)
// =========================
const forumTitle = $('#forumTitle');
const enrollBtn = $('#enrollBtn');
const unenrollBtn = $('#unenrollBtn');
const membersTotal = $('#membersTotal');
const membersOnline = $('#membersOnline');
const forumPosts = $('#forumPosts');
const postText = $('#postText');
const postBtn = $('#postBtn');

// COMP1601 seed posts
const SEED_POSTS = {
  'COMP1601': [
    { author:'Kiana (TA)', role:'tutor', ts: Date.now()-1000*60*60*24*2, text:'Week 4 slides + lab sheet uploaded. Focus on loops & arrays.' },
    { author:'Andre', role:'student', ts: Date.now()-1000*60*60*30, text:'Past Paper 2018 Q3(b): confusion on modulus — anyone explain?' },
    { author:'Ravi', role:'student', ts: Date.now()-1000*60*60*6, text:'Zoom study session Fri 8pm. Link: example.com/zoom' },
  ]
};
// Local posts per-course key
function postKey(code){ return `uwi-posts-${code}`; }
function getPosts(code){
  const raw = localStorage.getItem(postKey(code));
  if (raw) return JSON.parse(raw);
  // If none saved and we have seeds, load them once
  const seed = SEED_POSTS[code] || [];
  localStorage.setItem(postKey(code), JSON.stringify(seed));
  return seed;
}
function addPost(code, p){
  const arr = getPosts(code);
  arr.unshift(p);
  localStorage.setItem(postKey(code), JSON.stringify(arr));
}

function renderPost(p) {
  const el = document.createElement('div'); el.className='post';
  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:12px">
      <div>
        <div><strong>${p.author || 'Student'}</strong> <span class="muted">• ${p.role || 'student'}</span></div>
        <div class="muted" style="font-size:12px">${fmtDT(p.ts)}</div>
      </div>
    </div>
    <div style="margin-top:6px; white-space:pre-wrap">${escapeHtml(p.text || '')}</div>
  `;
  return el;
}

function hashCode(str) { let h=0; for (let i=0;i<str.length;i++) { h=((h<<5)-h)+str.charCodeAt(i); h|=0; } return Math.abs(h); }
function fakeCounts(code) {
  const h = hashCode(code);
  const total = 150 + (h % 351); // 150–500
  const online = Math.max(5, Math.min(total - 1, Math.floor((h % 100) * 0.3)));
  return { total, online };
}

function openForum(code) {
  // Update forum title
  $('#courseTitle').textContent = `Course Forum: ${code}`;

  // Fake counts for members
  const { total, online } = fakeCounts(code);
  membersTotal.textContent = total;
  membersOnline.textContent = online;

  // Render enroll/unenroll buttons
  renderEnrollButtons(code);

  // Render posts specific to the course
  forumPosts.innerHTML = '';
  const posts = getPosts(code); // Fetch posts for the specific course
  if (!posts.length) {
    forumPosts.innerHTML = '<div class="muted">No posts yet. Be the first to ask or share.</div>';
  } else {
    posts.forEach(p => forumPosts.appendChild(renderPost(p)));
  }

  // Set up post composer for the specific course
  postBtn.onclick = () => {
    const user = auth.currentUser;
    if (!user) return alert('Please sign in to post.');
    const txt = postText.value.trim();
    if (!txt) return;
    const st = getUserState(user.uid);
    const role = (st.roles && st.roles[0]) || 'student';
    addPost(code, { author: user.displayName || (user.email || '').split('@')[0], role, ts: Date.now(), text: txt });
    postText.value = '';
    // Refresh posts
    forumPosts.innerHTML = '';
    getPosts(code).forEach(p => forumPosts.appendChild(renderPost(p)));
  };
}

function renderEnrollButtons(code){
  const user = auth.currentUser;
  const enrolled = user ? (getUserState(user.uid).courses || []).includes(code) : false;
  $('#enrollBtn').classList.toggle('hidden', enrolled);
  $('#unenrollBtn').classList.toggle('hidden', !enrolled);
}

enrollBtn.addEventListener('click', () => {
  const user = auth.currentUser; if (!user) return alert('Sign in to enroll.');
  const st = getUserState(user.uid);
  if (!st.courses.includes(forumTitle.textContent)) st.courses.push(forumTitle.textContent);
  setUserState(user.uid, st);
  renderEnrollButtons(forumTitle.textContent);
  renderHome(user.uid);
});
unenrollBtn.addEventListener('click', () => {
  const user = auth.currentUser; if (!user) return;
  const st = getUserState(user.uid);
  st.courses = (st.courses || []).filter(c => c !== forumTitle.textContent);
  setUserState(user.uid, st);
  renderEnrollButtons(forumTitle.textContent);
  renderHome(user.uid);
});

// Back buttons
$('#backTo3').addEventListener('click', () => setStep(3));

// =========================
// Events (static + per-user local RSVP/bookmark)
// =========================
const EVENTS = [
  { id:'e1', title:'COMP1601 Study Group', courseCode:'COMP1601', dateTime: Date.now() + 1000*60*60*48, description:'Focus: loops, arrays. Bring past papers.' },
  { id:'e2', title:'Zoom: DCIT Python Basics', courseCode:'COMP1602', dateTime: Date.now() + 1000*60*60*24*4, description:'Intro session with examples.' },
  { id:'e3', title:'ECON1001 Peer Session', courseCode:'ECON1001', dateTime: Date.now() - 1000*60*60*2, description:'Review elasticity questions.' },
].sort((a,b)=> b.dateTime - a.dateTime);

const eventsList = $('#eventsList');
const eventSearch = $('#eventSearch');
eventSearch.addEventListener('input', renderEvents);

function renderEvents(){
  const term = (eventSearch.value || '').toLowerCase();
  eventsList.innerHTML = '';
  EVENTS.filter(e => !term ||
    (e.title.toLowerCase().includes(term) || (e.courseCode||'').toLowerCase().includes(term))
  ).forEach(e => eventsList.appendChild(renderEventCard(e)));
}
function renderEventCard(e, {compact=false}={}){
  const wrap = document.createElement('div'); wrap.className='card';
  wrap.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:12px">
      <div>
        <div style="font-weight:700">${e.title}</div>
        <div class="muted" style="font-size:12px">${e.courseCode || 'General'} • ${fmtDT(e.dateTime)}</div>
      </div>
      <div style="display:flex; gap:8px; align-items:center">
        <button class="btn" data-view="${e.id}">View</button>
        <button class="btn" data-bookmark="${e.id}">★</button>
      </div>
    </div>
    ${compact ? '' : `<div style="margin-top:6px">${e.description || ''}</div>`}
  `;
  wrap.querySelector(`[data-view="${e.id}"]`).addEventListener('click', () => openEventDetails(e));
  wrap.querySelector(`[data-bookmark="${e.id}"]`).addEventListener('click', () => toggleBookmark(e.id));
  return wrap;
}
function toggleBookmark(id){
  const u = auth.currentUser; if (!u) return alert('Sign in to bookmark events.');
  const st = getUserState(u.uid);
  const i = st.bookmarks.indexOf(id);
  if (i>=0) st.bookmarks.splice(i,1); else st.bookmarks.push(id);
  setUserState(u.uid, st);
  renderHome(u.uid);
}
function openEventDetails(e){
  const u = auth.currentUser;
  const d = document.createElement('dialog');
  d.style.border='none'; d.style.borderRadius='16px'; d.style.padding='0';
  // read RSVP
  const going = u ? !!getUserState(u.uid).rsvps[e.id] : false;
  d.innerHTML = `
    <form method="dialog" class="card" style="min-width:520px">
      <h3 style="margin:0 0 6px 0">${e.title}</h3>
      <div class="muted" style="font-size:12px">${e.courseCode || 'General'} • ${fmtDT(e.dateTime)}</div>
      <div style="margin-top:8px; white-space:pre-wrap">${e.description || ''}</div>
      <div style="margin-top:12px; display:flex; gap:8px; justify-content:space-between; align-items:center">
        <div>
          <button class="btn ${going ? 'danger' : ''}" id="toggleAttend">${going ? '✖︎ Not going' : '✔︎ I\'m going'}</button>
        </div>
        <div class="muted">Attendees (local demo)</div>
      </div>
      <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px">
        <button class="btn" value="close">Close</button>
      </div>
    </form>`;
  document.body.appendChild(d);
  d.showModal();
  d.querySelector('#toggleAttend').addEventListener('click', (ev)=>{
    ev.preventDefault();
    if (!auth.currentUser) { alert('Sign in to RSVP.'); return; }
    const st = getUserState(auth.currentUser.uid);
    if (st.rsvps[e.id]) delete st.rsvps[e.id]; else st.rsvps[e.id] = true;
    setUserState(auth.currentUser.uid, st);
    d.close(); d.remove();
    renderEvents();
    renderHome(auth.currentUser.uid);
  });
  d.addEventListener('close', ()=>{ d.remove(); });
}
renderEvents();

// =========================
// Small extras
// =========================

$('#authStatus').addEventListener('click', (e) => {
  if (e.target.id === 'openProfile') showProfile();
});

// Start on Home
goto('home');

/*console.log('btnSignUp:', document.getElementById('btnSignUp'));
console.log('btnSignIn:', document.getElementById('btnSignIn'));
console.log('btnSignOut:', document.getElementById('btnSignOut'));*/