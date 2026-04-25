// =====================================================
//  app.js  —  Ana uygulama mantığı
// =====================================================

import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, doc, addDoc, getDoc, getDocs,
  deleteDoc, updateDoc, setDoc,
  query, orderBy, onSnapshot,
  serverTimestamp, arrayUnion, arrayRemove,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// =====================================================
//  STATE
// =====================================================
let currentUser  = null;
let isAdmin      = false;
let currentPostId = null;

// =====================================================
//  PAGES
// =====================================================
window.showPage = function (name) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const page = document.getElementById("page-" + name);
  if (page) page.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (name === "home")  loadPosts();
  if (name === "admin") loadAdminPosts();
};

// =====================================================
//  AUTH STATE
// =====================================================
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  isAdmin = false;

  if (user) {
    // Kullanıcı Firestore'da var mı kontrol et, yoksa oluştur
    const userRef = doc(db, "users", user.uid);
    const snap    = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        displayName: user.displayName || "Anonim",
        email:       user.email,
        photoURL:    user.photoURL || "",
        role:        "user",
        createdAt:   serverTimestamp(),
      });
    }
    const userData = snap.exists() ? snap.data() : { role: "user" };
    isAdmin = userData.role === "admin";
  }

  renderNav();
});

function renderNav() {
  const area = document.getElementById("nav-auth-area");
  if (!currentUser) {
    area.innerHTML = `
      <button class="btn-nav-link" onclick="showPage('auth')">Giriş Yap</button>
    `;
  } else {
    const photo = currentUser.photoURL
      ? `<img src="${currentUser.photoURL}" alt="" />`
      : `<div class="comment-avatar">${getInitials(currentUser.displayName)}</div>`;
    area.innerHTML = `
      <div class="user-badge">
        ${photo}
        <span>${currentUser.displayName || currentUser.email}</span>
        ${isAdmin ? `<span class="admin-tag">Admin</span>` : ""}
      </div>
      ${isAdmin ? `<button class="btn-nav-accent" onclick="showPage('admin')">Panel</button>` : ""}
      <button class="btn-nav-link" onclick="logout()">Çıkış</button>
    `;
  }
}

// =====================================================
//  AUTH FUNCTIONS
// =====================================================
window.switchTab = function (tab) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-login").style.display    = tab === "login"    ? "flex" : "none";
  document.getElementById("tab-register").style.display = tab === "register" ? "flex" : "none";
  document.querySelectorAll(".tab-btn").forEach(b => {
    if (b.textContent.toLowerCase().includes(tab === "login" ? "giriş" : "kayıt"))
      b.classList.add("active");
  });
  document.getElementById("tab-login").style.flexDirection    = "column";
  document.getElementById("tab-register").style.flexDirection = "column";
  clearAuthError();
};
// init flex
document.getElementById("tab-login").style.display = "flex";
document.getElementById("tab-login").style.flexDirection = "column";
document.getElementById("tab-register").style.flexDirection = "column";

window.loginWithGoogle = async function () {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    showPage("home");
    showToast("Hoş geldiniz!", "success");
  } catch (e) { showAuthError(e.message); }
};

window.loginWithEmail = async function () {
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  if (!email || !password) return showAuthError("Lütfen tüm alanları doldurun.");
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showPage("home");
    showToast("Hoş geldiniz!", "success");
  } catch (e) { showAuthError(translateAuthError(e.code)); }
};

window.registerWithEmail = async function () {
  const name     = document.getElementById("reg-name").value.trim();
  const email    = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  if (!name || !email || !password) return showAuthError("Lütfen tüm alanları doldurun.");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    showPage("home");
    showToast("Hesabınız oluşturuldu!", "success");
  } catch (e) { showAuthError(translateAuthError(e.code)); }
};

window.logout = async function () {
  await signOut(auth);
  showPage("home");
  showToast("Çıkış yapıldı.");
};

function showAuthError(msg) { document.getElementById("auth-error").textContent = msg; }
function clearAuthError()    { document.getElementById("auth-error").textContent = ""; }

function translateAuthError(code) {
  const map = {
    "auth/user-not-found":      "Bu e-posta ile kayıtlı kullanıcı bulunamadı.",
    "auth/wrong-password":      "Şifre hatalı.",
    "auth/email-already-in-use":"Bu e-posta zaten kullanılıyor.",
    "auth/weak-password":       "Şifre en az 6 karakter olmalı.",
    "auth/invalid-email":       "Geçersiz e-posta adresi.",
    "auth/invalid-credential":  "E-posta veya şifre hatalı.",
  };
  return map[code] || "Bir hata oluştu. Tekrar deneyin.";
}

// =====================================================
//  POSTS  —  HOME
// =====================================================
function loadPosts() {
  const container = document.getElementById("posts-container");
  container.innerHTML = `<div class="loading-spinner"><span></span></div>`;

  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    container.innerHTML = "";
    if (snapshot.empty) {
      container.innerHTML = `
        <div class="empty-state">
          <span style="font-size:2rem">✦</span>
          <p>Henüz hiç yazı yok.</p>
        </div>`;
      return;
    }
    snapshot.forEach((docSnap) => {
      const post = { id: docSnap.id, ...docSnap.data() };
      container.appendChild(createPostCard(post));
    });
  });
}

function createPostCard(post) {
  const div = document.createElement("div");
  div.className = "post-card";
  div.style.animationDelay = "0.05s";

  const liked = currentUser && post.likedBy && post.likedBy.includes(currentUser.uid);
  const likeCount   = post.likeCount   || 0;
  const commentCount = post.commentCount || 0;

  div.innerHTML = `
    ${post.cover
      ? `<img class="card-cover" src="${post.cover}" alt="${post.title}" loading="lazy" />`
      : `<div class="card-cover-placeholder">✦</div>`
    }
    <div class="card-body" onclick="openPost('${post.id}')">
      <div class="card-date">${formatDate(post.createdAt)}</div>
      <div class="card-title">${escHtml(post.title)}</div>
      <div class="card-excerpt">${getExcerpt(post.body)}</div>
    </div>
    <div class="card-footer">
      <button class="like-btn ${liked ? "liked" : ""}" onclick="toggleLike(event, '${post.id}')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="${liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        ${likeCount}
      </button>
      <span class="comment-count">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        ${commentCount}
      </span>
    </div>
  `;
  return div;
}

// =====================================================
//  POST DETAIL
// =====================================================
window.openPost = async function (postId) {
  currentPostId = postId;
  showPage("detail");

  const container = document.getElementById("post-detail-content");
  container.innerHTML = `<div class="loading-spinner"><span></span></div>`;

  const postSnap = await getDoc(doc(db, "posts", postId));
  if (!postSnap.exists()) {
    container.innerHTML = "<p>Yazı bulunamadı.</p>";
    return;
  }
  const post  = { id: postSnap.id, ...postSnap.data() };
  const liked = currentUser && post.likedBy && post.likedBy.includes(currentUser.uid);

  container.innerHTML = `
    <a class="detail-back" onclick="showPage('home')">
      ← Tüm Yazılar
    </a>
    ${post.cover ? `<img class="detail-cover" src="${post.cover}" alt="${post.title}" />` : ""}
    <div class="detail-meta">
      <span class="detail-date">${formatDate(post.createdAt)}</span>
    </div>
    <h1 class="detail-title">${escHtml(post.title)}</h1>
    <div class="detail-content" id="post-body-html"></div>

    <div class="post-actions">
      <button class="btn-like ${liked ? "liked" : ""}" id="detail-like-btn" onclick="toggleLike(event, '${post.id}')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <span id="detail-like-count">${post.likeCount || 0}</span> Beğeni
      </button>
    </div>

    <div class="comments-section">
      <h3>Yorumlar</h3>
      ${currentUser
        ? `<div class="comment-form">
            <textarea id="comment-input" placeholder="Yorumunuzu yazın..."></textarea>
            <button class="btn-primary" style="width:auto;padding:11px 28px" onclick="submitComment('${post.id}')">Gönder</button>
           </div>`
        : `<p class="no-login-note">Yorum yapmak için <a onclick="showPage('auth')">giriş yapın</a>.</p>`
      }
      <div class="comment-list" id="comment-list"></div>
    </div>
  `;

  // Markdown render
  document.getElementById("post-body-html").innerHTML = parseMarkdown(post.body || "");

  // Real-time comments
  const commentsQuery = query(
    collection(db, "posts", postId, "comments"),
    orderBy("createdAt", "asc")
  );
  onSnapshot(commentsQuery, (snap) => {
    const list = document.getElementById("comment-list");
    if (!list) return;
    list.innerHTML = "";
    if (snap.empty) {
      list.innerHTML = `<p style="color:var(--text-muted);font-size:.875rem">Henüz yorum yok. İlk yorumu sen yap!</p>`;
      return;
    }
    snap.forEach(c => {
      const d = c.data();
      list.appendChild(createCommentEl(d));
    });
  });
};

function createCommentEl(d) {
  const div = document.createElement("div");
  div.className = "comment-item";
  div.innerHTML = `
    <div class="comment-header">
      ${d.photoURL
        ? `<img src="${d.photoURL}" style="width:32px;height:32px;border-radius:50%;object-fit:cover" />`
        : `<div class="comment-avatar">${getInitials(d.displayName)}</div>`
      }
      <span class="comment-name">${escHtml(d.displayName || "Anonim")}</span>
      <span class="comment-date">${formatDate(d.createdAt)}</span>
    </div>
    <div class="comment-text">${escHtml(d.text)}</div>
  `;
  return div;
}

window.submitComment = async function (postId) {
  if (!currentUser) return showToast("Giriş yapmanız gerekiyor.", "error");
  const input = document.getElementById("comment-input");
  const text  = input.value.trim();
  if (!text) return;

  await addDoc(collection(db, "posts", postId, "comments"), {
    text,
    uid:         currentUser.uid,
    displayName: currentUser.displayName || "Anonim",
    photoURL:    currentUser.photoURL || "",
    createdAt:   serverTimestamp(),
  });
  await updateDoc(doc(db, "posts", postId), { commentCount: increment(1) });
  input.value = "";
};

// =====================================================
//  LIKE
// =====================================================
window.toggleLike = async function (e, postId) {
  e.stopPropagation();
  if (!currentUser) { showPage("auth"); return; }

  const postRef = doc(db, "posts", postId);
  const snap    = await getDoc(postRef);
  if (!snap.exists()) return;

  const post  = snap.data();
  const liked = post.likedBy && post.likedBy.includes(currentUser.uid);

  await updateDoc(postRef, {
    likedBy:   liked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
    likeCount: increment(liked ? -1 : 1),
  });
};

// =====================================================
//  ADMIN  —  PUBLISH
// =====================================================
window.publishPost = async function () {
  if (!isAdmin) return showToast("Yetkiniz yok.", "error");

  const title  = document.getElementById("post-title").value.trim();
  const cover  = document.getElementById("post-cover").value.trim();
  const body   = document.getElementById("post-body").value.trim();

  if (!title || !body) return showToast("Başlık ve içerik zorunludur.", "error");

  const msg = document.getElementById("admin-msg");
  msg.textContent = "Yayınlanıyor...";

  try {
    await addDoc(collection(db, "posts"), {
      title, cover, body,
      likeCount:    0,
      commentCount: 0,
      likedBy:      [],
      createdAt:    serverTimestamp(),
    });
    document.getElementById("post-title").value  = "";
    document.getElementById("post-cover").value  = "";
    document.getElementById("post-body").value   = "";
    msg.textContent = "";
    showToast("Yazı yayınlandı! ✦", "success");
    loadAdminPosts();
  } catch (e) {
    msg.textContent = "";
    showToast("Hata: " + e.message, "error");
  }
};

// =====================================================
//  ADMIN  —  LIST & DELETE
// =====================================================
async function loadAdminPosts() {
  if (!isAdmin) return;
  const container = document.getElementById("admin-posts-list");
  container.innerHTML = `<div class="loading-spinner"><span></span></div>`;

  const q    = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  container.innerHTML = "";
  snap.forEach(docSnap => {
    const post = { id: docSnap.id, ...docSnap.data() };
    const row  = document.createElement("div");
    row.className = "admin-post-row";
    row.innerHTML = `
      <span class="admin-post-row-title">${escHtml(post.title)}</span>
      <span style="font-size:.78rem;color:var(--text-muted)">${formatDate(post.createdAt)}</span>
      <button class="btn-delete" onclick="deletePost('${post.id}')">Sil</button>
    `;
    container.appendChild(row);
  });

  if (snap.empty) container.innerHTML = `<p style="color:var(--text-muted);font-size:.875rem">Henüz yazı yok.</p>`;
}

window.deletePost = async function (postId) {
  if (!isAdmin) return;
  if (!confirm("Bu yazıyı silmek istediğinizden emin misiniz?")) return;
  await deleteDoc(doc(db, "posts", postId));
  showToast("Yazı silindi.");
  loadAdminPosts();
};

// =====================================================
//  MARKDOWN PARSER  (basit)
// =====================================================
function parseMarkdown(text) {
  return text
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm,  "<h2>$1</h2>")
    .replace(/^# (.+)$/gm,   "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,    "<em>$1</em>")
    .replace(/`(.+?)`/g,      "<code>$1</code>")
    .replace(/^> (.+)$/gm,    "<blockquote>$1</blockquote>")
    .replace(/^---$/gm,       "<hr />")
    .replace(/^- (.+)$/gm,    "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hublp])(.+)$/gm, (m) => m ? "<p>" + m + "</p>" : "");
}

// =====================================================
//  HELPERS
// =====================================================
function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function getExcerpt(body, len = 120) {
  const plain = (body || "").replace(/[#*`>_\[\]]/g, "").replace(/\n/g, " ");
  return plain.length > len ? plain.slice(0, len) + "…" : plain;
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent   = msg;
  t.className     = "show " + type;
  setTimeout(() => { t.className = ""; }, 3000);
}

renderNav();
loadPosts();
