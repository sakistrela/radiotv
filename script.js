const firebaseConfig = {
  apiKey: "AIzaSyCcKzw7KbEcayXoxsAKqpTumd2kazBsgEQ",
  authDomain: "radiochatlive-43be4.firebaseapp.com",
  databaseURL: "https://radiochatlive-43be4-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "radiochatlive-43be4",
  storageBucket: "radiochatlive-43be4.firebasestorage.app",
  messagingSenderId: "883430401617",
  appId: "1:883430401617:web:7963ac1ff4481bfb3c3a70"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

var currentUser = '';
var currentSessionId = '';
var onlineUsers = {};
var userAvatars = {};
var isAdmin = false;
var currentPrivateChat = null;
var pendingPrivateNotif = null;
var bannedUsersList = [];
var pendingBanUsername = null;
var isPlayerOpen = false;
var isPlayerLoaded = false;
var isAvatarUploading = false;
var connectTime = 0;
var isTvLiveOpen = false;

if (!localStorage.getItem('chat_device_unique_id')) { 
  var fixedId = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(); 
  localStorage.setItem('chat_device_unique_id', fixedId); 
}
currentSessionId = localStorage.getItem('chat_device_unique_id');

var tvDragState = { isDragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 };

function toggleTvLiveWindow() { if (isTvLiveOpen) { closeTvLiveWindow(); } else { openTvLiveWindow(); } }
function openTvLiveWindow() {
  var win = document.getElementById('tvLiveWindow');
  if (!isTvLiveOpen) { document.getElementById('tvLiveIframe').src = 'sakis tv/tv.html'; }
  win.classList.add('show'); isTvLiveOpen = true;
}
function closeTvLiveWindow() {
  var win = document.getElementById('tvLiveWindow');
  win.classList.remove('show'); win.style.width = ''; win.style.height = '';
  document.getElementById('tvLiveIframe').src = ''; isTvLiveOpen = false;
}

var tvHeader = document.getElementById('tvLiveWindowHeader');
tvHeader.addEventListener('mousedown', function(e) {
  if (e.target.closest('.tv-live-window-btn')) return;
  var win = document.getElementById('tvLiveWindow');
  tvDragState.isDragging = true; tvDragState.startX = e.clientX; tvDragState.startY = e.clientY;
  var rect = win.getBoundingClientRect(); tvDragState.startLeft = rect.left; tvDragState.startTop = rect.top;
  win.style.right = 'auto'; win.style.left = rect.left + 'px'; win.style.top = rect.top + 'px';
  document.body.style.userSelect = 'none'; e.preventDefault();
});
document.addEventListener('mousemove', function(e) {
  if (!tvDragState.isDragging) return;
  var win = document.getElementById('tvLiveWindow');
  var dx = e.clientX - tvDragState.startX; var dy = e.clientY - tvDragState.startY;
  var newLeft = tvDragState.startLeft + dx; var newTop = tvDragState.startTop + dy;
  newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - win.offsetWidth));
  newTop = Math.max(0, Math.min(newTop, window.innerHeight - 40));
  win.style.left = newLeft + 'px'; win.style.top = newTop + 'px';
});
document.addEventListener('mouseup', function() {
  if (tvDragState.isDragging) { tvDragState.isDragging = false; document.body.style.userSelect = ''; }
});
tvHeader.addEventListener('touchstart', function(e) {
  if (e.target.closest('.tv-live-window-btn')) return;
  var touch = e.touches[0]; var win = document.getElementById('tvLiveWindow');
  tvDragState.isDragging = true; tvDragState.startX = touch.clientX; tvDragState.startY = touch.clientY;
  var rect = win.getBoundingClientRect(); tvDragState.startLeft = rect.left; tvDragState.startTop = rect.top;
  win.style.right = 'auto'; win.style.left = rect.left + 'px'; win.style.top = rect.top + 'px';
}, { passive: true });
document.addEventListener('touchmove', function(e) {
  if (!tvDragState.isDragging) return;
  var touch = e.touches[0]; var win = document.getElementById('tvLiveWindow');
  var dx = touch.clientX - tvDragState.startX; var dy = touch.clientY - tvDragState.startY;
  var newLeft = tvDragState.startLeft + dx; var newTop = tvDragState.startTop + dy;
  newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - win.offsetWidth));
  newTop = Math.max(0, Math.min(newTop, window.innerHeight - 40));
  win.style.left = newLeft + 'px'; win.style.top = newTop + 'px';
}, { passive: true });
document.addEventListener('touchend', function() { if (tvDragState.isDragging) { tvDragState.isDragging = false; } });

function ensureAdminOnline() {
  if (currentUser && isAdmin) {
    var avatarData = userAvatars[currentUser.toLowerCase()] || localStorage.getItem('user_avatar_' + currentUser.toLowerCase()) || null;
    db.ref('users/' + currentUser).set({ username: currentUser, avatar: avatarData });
  }
}

function togglePlayer() { if (isPlayerOpen) closePlayer(); else openPlayer(); }
function openPlayer() { 
  if (!isPlayerLoaded) { document.getElementById('playerIframe').src = 'player.html'; isPlayerLoaded = true; } 
  document.getElementById('playerPanel').classList.add('show'); isPlayerOpen = true; 
  document.getElementById('radioBtn').classList.remove('playing'); 
}
function closePlayer() { 
  document.getElementById('playerPanel').classList.remove('show'); isPlayerOpen = false; 
  if (isPlayerLoaded) document.getElementById('radioBtn').classList.add('playing'); 
}
function disconnectPlayer() { 
  document.getElementById('playerPanel').classList.remove('show'); document.getElementById('playerIframe').src = ''; 
  isPlayerOpen = false; isPlayerLoaded = false; document.getElementById('radioBtn').classList.remove('playing'); 
}
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarOverlay').classList.toggle('show'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('show'); }

var notificationSound = new Audio('https://cdn.pixabay.com/audio/2024/02/08/audio_b7f03fb030.mp3');
var soundVolume = 1.0;
var soundStates = [{ volume: 1.0, icon: '🔊' }, { volume: 0.3, icon: '🔉' }, { volume: 0, icon: '🔇' }];
var currentSoundState = 0;

function loadSoundSettings() { 
  var saved = localStorage.getItem('chat_sound_volume'); 
  if (saved !== null) { currentSoundState = parseInt(saved); soundVolume = soundStates[currentSoundState].volume; notificationSound.volume = soundVolume; updateSoundButton(); } 
}
function updateSoundButton() { document.getElementById('soundBtn').textContent = soundStates[currentSoundState].icon; }
function toggleSound() { 
  currentSoundState = (currentSoundState + 1) % soundStates.length; soundVolume = soundStates[currentSoundState].volume; 
  notificationSound.volume = soundVolume; localStorage.setItem('chat_sound_volume', currentSoundState); updateSoundButton(); 
}
function playNotificationSound() { if (soundVolume > 0) { notificationSound.currentTime = 0; notificationSound.play().catch(e => {}); } }

var emojiCategories = {
  smileys: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🥳','😏','😒','😞','😔','😟','😕','🙁','😖','😫','😩','🥺','😭','😤','😠','😡','🤬','😳','🥶','😨','😰','😥','😓','🤗','🤔','🤫','😶','😐','😑','😬','🙄','😯','😧','😮','😲','😴','🤤','😵','🤐','🥴','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','💩','💀','☠️','👽','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾','🙈','🙉','🙊'],
  animals: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🐣','🦆','🦅','🦉','🦇','🐺','🦄','🐝','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐈','🐓','🦃','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦦','🦥','🐁','🐀','🐿️','🦔','🐾','🐉','🐲'],
  food: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥖','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🌭','🍔','🍟','🍕','🫓','🥙','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🫗','🍼','🫖','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊','🥄','🍴','🍽️','🥣','🥡','🥢','🧂'],
  activities: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🎰','🧩'],
  travel: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛺','🚨','🚔','🚍','🚖','🚘','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅','🚈','🚇','🚆','🚉','✈️','🛫','🛬','🛩️','💺','🛰️','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','⚓','🪝','⛽','🚧','🚦','🚥','🗺️','🗿','🗽','🗼','🏰','🏯','🏟️','🎡','🎢','🎠','⛲','⛱️','🏖️','🏝️','🏜️','🌋','⛰️','🏔️','🗻','🏕️','⛺','🛖','🏠','🏡','🏘️','🏚️','🏗️','🏭','🏢','🏬','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏩','💒','🏛️','⛪','🕌','🕍','🛕','🕋','⛩️','🛤️','🛣️','🗾','🎑','🏞️','🌅','🌄','🌠','🎇','🎆','🌇','🌆','🏙️','🌃','🌌','🌉','🌁'],
  objects: ['⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧱','⛓️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','💈','⚗️','🔭','🔬','🕳️','🩹','🩺','💊','💉','🩸','🧬','🦠','🧫','🧪','🌡️','🧹','🪠','🧺','🧻','🚽','🚰','🚿','🛁','🛀','🧼','🪥','🪒','🧽','🪣','🧴','🛎️','🔑','🗝️','🚪','🪑','🛋️','🛏️','🛌','🧸','🪆','🖼️','🪞','🪟','🛍️','🛒','🎁','🎈','🎏','🎀','🪄','🪅','🎊','🎉','🎎','🏮','🎐','🧧','✉️','📩','📨','📧','💌','📥','📤','📦','🏷️','🪧','📪','📫','📬','📭','📮','📯','📜','📃','📄','📑','🧾','📊','📈','📉','🗒️','🗓️','📆','📅','🗑️','📇','🗃️','🗳️','🗄️','📋','📁','📂','🗂️','🗞️','📰','📓','📔','📒','📕','📗','📘','📙','📚','📖','🔖','🧷','🔗','📎','🖇️','📐','📏','🧮','📌','📍','✂️','🖊️','🖋️','✒️','🖌️','🖍️','📝','✏️','🔍','🔎','🔏','🔐','🔒','🔓'],
  symbols: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈂️','🛂','🛃','🛄','🛅','🚹','🚺','🚼','⚧️','🚻','🚮','🎦','📶','🈁','🔣','ℹ️','🔤','🔡','🔠','🆖','🆗','🆙','🆒','🆕','🆓','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔢','#️⃣','*️⃣','⏏️','▶️','⏸️','⏯️','⏹️','⏺️','⏭️','⏮️','⏩','⏪','⏫','⏬','◀️','🔼','🔽','➡️','⬅️','⬆️','⬇️','↗️','↘️','↙️','↖️','↕️','↔️','↪️','↩️','⤴️','⤵️','🔀','🔁','🔂','🔄','🔃','🎵','🎶','➕','➖','➗','✖️','♾️','💲','💱','™️','©️','®️','👁️‍🗨️','🔚','🔙','🔛','🔝','🔜','〰️','➰','➿','✔️','☑️','🔘','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔸','🔹','🔶','🔷','🔳','🔲','▪️','▫️','◾','◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫','🔈','🔇','🔉','🔊','🔔','🔕','📣','📢','👁️‍🗨️','💬','💭','🗯️','♠️','♣️','♥️','♦️','🃏','🎴','🀄','🕐','🕑','🕒','🕓','🕔','🕕','🕖','🕗','🕘','🕙','🕚','🕛']
};

Object.keys(emojiCategories).forEach(category => { 
  var container = document.getElementById(category); 
  emojiCategories[category].forEach(emoji => { 
    var span = document.createElement('span'); span.className = 'emoji'; span.textContent = emoji; 
    span.onclick = function() { document.getElementById('msgInput').value += emoji; document.getElementById('msgInput').focus(); }; 
    container.appendChild(span); 
  }); 
});
document.querySelectorAll('.emoji-tab').forEach(tab => { 
  tab.addEventListener('click', function() { 
    document.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active')); 
    document.querySelectorAll('.emoji-category').forEach(c => c.classList.remove('active')); 
    this.classList.add('active'); document.getElementById(this.dataset.category).classList.add('active'); 
  }); 
});

function toggleBgControls() { document.getElementById('bgControlsPanel').classList.toggle('show'); document.getElementById('bannedPanel').classList.remove('show'); }
function updateBackground() { 
  var posX = document.getElementById('bgPositionX').value; var brightness = document.getElementById('bgBrightness').value; 
  var blur = document.getElementById('bgBlur').value; var overlay = document.getElementById('bgOverlay').value; 
  document.getElementById('bgContainer').style.backgroundPosition = posX + '% center'; 
  document.getElementById('bgContainer').style.filter = 'brightness(' + brightness + '%) blur(' + blur + 'px)'; 
  document.querySelector('.bg-overlay').style.background = 'rgba(15, 15, 30, ' + (overlay / 100) + ')'; 
  document.getElementById('posValue').textContent = posX + '%'; document.getElementById('brightValue').textContent = brightness + '%'; 
  document.getElementById('blurValue').textContent = blur + 'px'; document.getElementById('overlayValue').textContent = overlay + '%'; 
  localStorage.setItem('bg_settings', JSON.stringify({ posX, brightness, blur, overlay })); 
}
function loadBgSettings() { 
  var saved = localStorage.getItem('bg_settings'); 
  if (saved) { 
    var s = JSON.parse(saved); document.getElementById('bgPositionX').value = s.posX || 50; 
    document.getElementById('bgBrightness').value = s.brightness || 100; document.getElementById('bgBlur').value = s.blur || 0; 
    document.getElementById('bgOverlay').value = s.overlay || 70; updateBackground(); 
  } 
}

async function uploadToImgur(file) {
  const formData = new FormData(); formData.append("image", file);
  const response = await fetch("https://api.imgur.com/3/image", { method: "POST", headers: { Authorization: "Client-ID 546c25a59c58ad7" }, body: formData });
  const result = await response.json();
  if (result.success) { return { link: result.data.link, deletehash: result.data.deletehash }; } 
  else { throw new Error("Αποτυχία ανεβάσματος"); }
}

async function checkIfBanned(username) { 
  return new Promise((resolve) => { db.ref('banned_users/' + username.toLowerCase()).once('value', (snap) => { resolve(snap.exists()); }); }); 
}
async function banUser(username) { 
  pendingBanUsername = username; document.getElementById('banTypeText').textContent = `Θέλεις να μπανάρεις τον "${username}";`; 
  document.getElementById('banTypeOverlay').classList.add('show'); 
}
async function confirmBan() { 
  if (!pendingBanUsername) return; document.getElementById('banTypeOverlay').classList.remove('show'); 
  var username = pendingBanUsername; pendingBanUsername = null; 
  try { 
    db.ref('banned_users/' + username.toLowerCase()).set({ banned_by: currentUser, ban_type: 'username', banned_at: Date.now() }); 
    db.ref('active_sessions/' + username).remove(); alert('🚫 Banned!'); loadBannedUsers(); ensureAdminOnline();
  } catch(e) { alert('Σφάλμα: ' + e.message); } 
}
function cancelBan() { pendingBanUsername = null; document.getElementById('banTypeOverlay').classList.remove('show'); }
async function unbanUser(username) { 
  if (!confirm('Αφαίρεση ban;')) return; 
  try { db.ref('banned_users/' + username.toLowerCase()).remove(); alert('✅ Αφαιρέθηκε!'); loadBannedUsers(); renderBannedUsersPanel(); ensureAdminOnline(); } 
  catch(e) { alert('Σφάλμα: ' + e.message); } 
}
async function loadBannedUsers() { 
  return new Promise((resolve) => { db.ref('banned_users').once('value', (snap) => { bannedUsersList = []; snap.forEach(child => { bannedUsersList.push({ username: child.key, ...child.val() }); }); resolve(); }); }); 
}
function renderBannedUsersPanel() { 
  var list = document.getElementById('bannedUsersList'); list.innerHTML = ''; 
  if (bannedUsersList.length === 0) { list.innerHTML = '<div class="no-banned">Δεν υπάρχουν banned 🎉</div>'; return; } 
  bannedUsersList.forEach(ban => { 
    var div = document.createElement('div'); div.className = 'banned-user-item'; 
    var time = new Date(ban.banned_at).toLocaleString('el'); 
    div.innerHTML = `<div class="banned-user-info"><div class="banned-user-name"> ${escapeHtml(ban.username)}</div><div class="banned-user-time">${time}</div></div><button class="unban-btn" onclick="unbanUser(this.dataset.user)" data-user="${escapeHtml(ban.username)}">Unban</button>`; 
    list.appendChild(div); 
  }); 
}
function toggleBannedPanel() { 
  var panel = document.getElementById('bannedPanel'); panel.classList.toggle('show'); 
  document.getElementById('bgControlsPanel').classList.remove('show'); document.getElementById('emojiPanel').classList.remove('show'); 
  if (panel.classList.contains('show')) { loadBannedUsers().then(() => renderBannedUsersPanel()); } 
}
function handleBannedWhileOnline() { 
  document.getElementById('banNotifOverlay').classList.add('show'); 
  setTimeout(async () => { 
    try { 
      db.ref('users/' + currentUser).remove(); localStorage.removeItem('chat_username'); localStorage.removeItem('chat_password');
      currentUser = ''; isAdmin = false; document.getElementById('chatApp').style.display = 'none'; 
      document.getElementById('banNotifOverlay').classList.remove('show'); document.getElementById('loginDiv').style.display = 'flex'; 
    } catch(e) {} 
  }, 3000); 
}
function subscribeToBans() { 
  db.ref('banned_users').on('child_added', (snap) => { if (snap.key.toLowerCase() === currentUser.toLowerCase()) { handleBannedWhileOnline(); } }); 
  db.ref('banned_users').on('child_removed', () => { if (isAdmin && document.getElementById('bannedPanel').classList.contains('show')) { loadBannedUsers().then(() => renderBannedUsersPanel()); } }); 
}

async function handleAvatarUpload(event) {
  var file = event.target.files[0]; if (!file) return;
  if (isAvatarUploading) { alert('⏳ Περιμένετε!'); event.target.value = ''; return; }
  if (file.size > 20 * 1024 * 1024) { alert('Max 20MB!'); event.target.value = ''; return; }
  isAvatarUploading = true;
  var userItems = document.querySelectorAll('.user-item'); var userAvatarEl = null;
  userItems.forEach(item => { var nameEl = item.querySelector('.user-name'); if (nameEl && nameEl.textContent === currentUser) { userAvatarEl = item.querySelector('.avatar'); } });
  var originalAvatarHTML = userAvatarEl ? userAvatarEl.innerHTML : '';
  if (userAvatarEl) { userAvatarEl.classList.add('loading'); userAvatarEl.innerHTML = '<div class="avatar-spinner"></div>'; }
  try {
    var uploadResult = await uploadToImgur(file);
    userAvatars[currentUser.toLowerCase()] = uploadResult.link;
    localStorage.setItem('user_avatar_' + currentUser.toLowerCase(), uploadResult.link);
    db.ref('registered_users/' + currentUser.toLowerCase() + '/avatar').set(uploadResult.link);
    db.ref('users/' + currentUser).update({ avatar: uploadResult.link });
    updateUserList(); alert('✅ Η φωτογραφία σου ενημερώθηκε!');
  } catch(err) { 
    alert('Σφάλμα: ' + err.message); if (userAvatarEl) { userAvatarEl.classList.remove('loading'); userAvatarEl.innerHTML = originalAvatarHTML; } 
  } finally { isAvatarUploading = false; event.target.value = ''; }
}

window.addEventListener('load', async function() { 
  loadBgSettings(); loadSoundSettings(); 
  var savedUser = localStorage.getItem('chat_username'); var savedPass = localStorage.getItem('chat_password');
  if (savedUser && savedPass) { document.getElementById('userIn').value = savedUser; document.getElementById('passIn').value = savedPass; setTimeout(() => goChat(true), 300); } 
});

function escapeHtml(text) { var div = document.createElement('div'); div.textContent = text; return div.innerHTML.replace(/'/g, '&#39;').replace(/"/g, '&quot;'); }
function linkify(text) { 
  var urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g; 
  return text.replace(urlRegex, function(url) { 
    var fullUrl = url.startsWith('http') ? url : 'https://' + url; 
    return '<a href="' + fullUrl + '" target="_blank" style="color: #60a5fa; text-decoration: underline; word-break: break-all;">' + url + '</a>'; 
  }); 
}
function getAvatarHtml(username) { 
  var lower = username.toLowerCase(); var initial = username.charAt(0).toUpperCase(); 
  var avatarUrl = userAvatars[lower] || localStorage.getItem('user_avatar_' + lower); 
  if (avatarUrl) { return `<div class="msg-avatar"><img src="${avatarUrl}" alt="${escapeHtml(username)}"></div>`; } 
  return `<div class="msg-avatar">${initial}</div>`; 
}

async function loadMessages() { 
  var container = document.getElementById('msgContainer'); container.innerHTML = '';
  db.ref('messages').limitToLast(50).once('value', (snap) => {
    snap.forEach(child => { var msg = child.val(); msg._id = child.key; addMessageToUI(msg, false); });
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 100);
  });
}
async function loadPrivateMessages(otherUser) { 
  var container = document.getElementById('msgContainer'); container.innerHTML = ''; 
  var chatId = [currentUser.toLowerCase(), otherUser.toLowerCase()].sort().join('_');
  db.ref('private_messages/' + chatId).limitToLast(200).once('value', (snap) => {
    snap.forEach(child => { var msg = child.val(); msg._id = child.key; addMessageToUI(msg, true); });
    container.scrollTop = container.scrollHeight;
    db.ref('private_messages/' + chatId).orderByChild('receiver').equalTo(currentUser).once('value', (snap) => { 
      snap.forEach(child => { if (!child.val().is_read) { child.ref.update({ is_read: true }); } }); 
    });
  });
}

// ΔΙΟΡΘΩΜΕΝΗ: Προσθήκη preload="none" και requestAnimationFrame για ομαλό scroll
function addMessageToUI(msg, isPrivate) {
  var container = document.getElementById('msgContainer');
  if (msg._id) { var existingMsg = container.querySelector(`.msg[data-msg-id="${msg._id}"]`); if (existingMsg) return; }
  var div = document.createElement('div');
  var senderName = msg.user || msg.sender || "Άγνωστος";
  var text = msg.text || msg.message || "";
  var img = msg.image || msg.image_data || null;
  var msgId = msg._id;
  var deletehash = msg.imageDeletehash || null;
  var isOwn = senderName.toLowerCase() === currentUser.toLowerCase();
  div.className = 'msg' + (isOwn ? ' own' : '') + (isPrivate ? ' private' : '');
  if (msgId) { div.setAttribute('data-msg-id', msgId); }
  var avatarHtml = getAvatarHtml(senderName);
  var time = new Date(msg.timestamp || Date.now()).toLocaleTimeString('el', { hour: '2-digit', minute: '2-digit' });
  var deleteButtonHtml = '';
  if (img && isAdmin && deletehash && msgId) {
    var firebasePath = isPrivate ? 'private_messages/' + [msg.sender.toLowerCase(), msg.receiver.toLowerCase()].sort().join('_') + '/' + msgId : 'messages/' + msgId;
    var safePath = firebasePath.replace(/'/g, "\\'");
    var safeDeletehash = deletehash.replace(/'/g, "\\'");
    deleteButtonHtml = `<button class="delete-image-btn" onclick="deleteImage('${safePath}', '${safeDeletehash}', this)">🗑️ Διαγραφή από παντού</button>`;
  }
  
  var contentHtml = '';
  if (img) {
    contentHtml = `<div class="text"><img src="${img}" style="max-width:200px; border-radius:8px; display:block; margin:5px 0; cursor: pointer;" onclick="openImagePreview(this.src)">${deleteButtonHtml}</div>`;
  } else if (msg.audioUrl) {
    contentHtml = `<div class="text"><div class="msg-audio-wrapper"><audio controls src="${msg.audioUrl}" preload="none"></audio></div></div>`;
  } else {
    contentHtml = `<div class="text">${linkify(escapeHtml(text))}</div>`;
  }

  div.innerHTML = `${avatarHtml}<div class="msg-content"><div class="user">${escapeHtml(senderName)}</div>${contentHtml}<div class="time">${time}</div></div>`;
  container.appendChild(div);
  
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}

async function deleteImage(firebasePath, deletehash, buttonElement) {
  if (!confirm('⚠️ Διαγραφή ΤΕΛΕΙΩΣ από παντού;')) return;
  buttonElement.disabled = true; buttonElement.textContent = '⏳ Διαγραφή...';
  try {
    await fetch(`https://api.imgur.com/3/image/${deletehash}`, { method: "DELETE", headers: { "Authorization": "Client-ID 546c25a59c58ad7" } });
    await db.ref(firebasePath).remove();
  } catch(e) { alert('Σφάλμα: ' + e.message); buttonElement.disabled = false; buttonElement.textContent = '🗑️ Διαγραφή από παντού'; }
}

async function sendMsg() { 
  var input = document.getElementById('msgInput'); var text = input.value.trim(); if (!text) return; 
  try { 
    if (currentPrivateChat) { 
      var chatId = [currentUser.toLowerCase(), currentPrivateChat.toLowerCase()].sort().join('_'); 
      db.ref('private_messages/' + chatId).push({ sender: currentUser, receiver: currentPrivateChat, message: text, timestamp: Date.now() }); 
    } else { 
      db.ref('messages').push({ user: currentUser, text: text, timestamp: Date.now() }); 
    } 
    input.value = ''; 
  } catch(e) { alert('Σφάλμα: ' + e.message); } 
}

function toggleEmoji() { document.getElementById('emojiPanel').classList.toggle('show'); document.getElementById('bannedPanel').classList.remove('show'); document.getElementById('bgControlsPanel').classList.remove('show'); }

function updateUserList() {
    var users = Object.keys(onlineUsers).sort();
    var list = document.getElementById('userList'); list.innerHTML = '';
    users.forEach(username => {
        var div = document.createElement('div'); div.className = 'user-item';
        var initial = username.charAt(0).toUpperCase();
        var isAdminUser = username.toLowerCase() === 'sakis';
        var avatarClass = isAdminUser ? 'avatar admin-avatar' : 'avatar';
        var adminBadge = isAdminUser ? '<span class="admin-badge">👑admin</span>' : '';
        var avatarHtml = userAvatars[username.toLowerCase()]
            ? `<div class="${avatarClass}" onclick="triggerAvatarUpload(this.dataset.user)" data-user="${escapeHtml(username)}"><img src="${userAvatars[username.toLowerCase()]}">${username === currentUser ? '<div class="avatar-upload-hint">📷</div>' : ''}</div>`
            : `<div class="${avatarClass}" onclick="triggerAvatarUpload(this.dataset.user)" data-user="${escapeHtml(username)}">${initial}${username === currentUser ? '<div class="avatar-upload-hint">📷</div>' : ''}</div>`;
        var lockBtn = ''; var banBtn = '';
        if (username !== currentUser) {
            lockBtn = `<button class="private-lock-btn" onclick="startPrivateChat(this.dataset.user)" data-user="${escapeHtml(username)}" title="Ιδιωτικό">🔒</button>`;
            if (isAdmin) { banBtn = `<button class="ban-user-btn show" onclick="banUser(this.dataset.user)" data-user="${escapeHtml(username)}" title="Ban">🚫</button>`; }
        }
        div.innerHTML = `${avatarHtml}<div class="user-info"><div class="user-name">${escapeHtml(username)}${adminBadge}</div><div class="user-status">Online</div></div>${lockBtn}${banBtn}`;
        list.appendChild(div);
    });
    document.getElementById('onlineNum').textContent = users.length;
    document.getElementById('userNum').textContent = users.length;
}

function triggerAvatarUpload(username) { if (isAvatarUploading) { alert('⏳ Περιμένετε!'); return; } if (username === currentUser) document.getElementById('avatarInput').click(); }
function triggerImageUpload() { document.getElementById('imageUploadInput').click(); }
function startPrivateChat(username) { 
  if (username === currentUser) return; 
  if (!onlineUsers[username]) { alert('Ο χρήστης δεν είναι online!'); return; } 
  currentPrivateChat = username; document.getElementById('chatMain').classList.add('private-mode'); 
  document.getElementById('privateHeader').classList.add('show'); document.getElementById('mainHeader').style.display = 'none'; 
  document.getElementById('privateWithUser').textContent = username; document.getElementById('msgInput').placeholder = 'Γράψε ιδιωτικό...'; 
  document.getElementById('emojiPanel').classList.remove('show'); 
  if (window.innerWidth <= 768) closeSidebar(); loadPrivateMessages(username); 
}
function closePrivateChat() { 
  currentPrivateChat = null; document.getElementById('chatMain').classList.remove('private-mode'); 
  document.getElementById('privateHeader').classList.remove('show'); document.getElementById('mainHeader').style.display = 'flex'; 
  document.getElementById('msgInput').placeholder = 'Γράψε ένα μήνυμα...'; loadMessages(); 
}

async function handleImageUpload(event) {
  var file = event.target.files[0]; if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) { alert('Μόνο JPG, PNG, GIF!'); event.target.value = ''; return; }
  if (file.size > 20 * 1024 * 1024) { alert('Max 20MB!'); event.target.value = ''; return; }
  var imageBtn = document.getElementById('imageBtn'); var originalHTML = imageBtn.innerHTML;
  imageBtn.innerHTML = '<div class="spinner"></div>'; imageBtn.classList.add('loading');
  try {
    var uploadResult = await uploadToImgur(file); var imageUrl = uploadResult.link; var deletehash = uploadResult.deletehash; var timestamp = Date.now();
    if (currentPrivateChat) {
      var chatId = [currentUser.toLowerCase(), currentPrivateChat.toLowerCase()].sort().join('_');
      db.ref('private_messages/' + chatId).push({ sender: currentUser, receiver: currentPrivateChat, message: '[📸 Εικόνα]', image: imageUrl, imageDeletehash: deletehash, timestamp: timestamp });
    } else {
      db.ref('messages').push({ user: currentUser, text: '[📸 Εικόνα]', image: imageUrl, imageDeletehash: deletehash, timestamp: timestamp });
    }
  } catch(e) { alert('Σφάλμα: ' + e.message); } 
  finally { imageBtn.innerHTML = originalHTML; imageBtn.classList.remove('loading'); event.target.value = ''; }
}

function showPrivateNotification(sender) { 
  if (pendingPrivateNotif) return; pendingPrivateNotif = sender; 
  document.getElementById('privateNotifText').textContent = 'Ο ' + sender + ' σου έστειλε ιδιωτικό!'; 
  document.getElementById('privateNotifOverlay').classList.add('show'); 
}
function acceptPrivateNotification() { 
  if (pendingPrivateNotif) { 
    var sender = pendingPrivateNotif; pendingPrivateNotif = null; 
    document.getElementById('privateNotifOverlay').classList.remove('show'); startPrivateChat(sender); 
  } 
}

function subscribeToMessages() {
  db.ref('messages').on('value', (snap) => { if (!snap.exists() && !currentPrivateChat) { document.getElementById('msgContainer').innerHTML = ''; } });
  db.ref('messages').on('child_added', (snap) => {
    var msg = snap.val(); msg._id = snap.key;
    if (msg.timestamp && msg.timestamp < connectTime) return;
    if (!currentPrivateChat) { addMessageToUI(msg, false); if (msg.user.toLowerCase() !== currentUser.toLowerCase()) { playNotificationSound(); } }
  });
  db.ref('messages').on('child_removed', (snap) => {
    var removedId = snap.key; if (!currentPrivateChat) { var msgDiv = document.querySelector(`.msg[data-msg-id="${removedId}"]`); if (msgDiv) msgDiv.remove(); }
  });
  db.ref('private_messages').on('child_added', (chatSnap) => {
    var chatId = chatSnap.key; if (!chatId.includes(currentUser.toLowerCase())) return;
    db.ref('private_messages/' + chatId).on('value', (snap) => {
      if (!snap.exists() && currentPrivateChat) {
        var currentChatId = [currentUser.toLowerCase(), currentPrivateChat.toLowerCase()].sort().join('_');
        if (chatId === currentChatId) { document.getElementById('msgContainer').innerHTML = ''; }
      }
    });
    db.ref('private_messages/' + chatId).on('child_added', (msgSnap) => {
      var msg = msgSnap.val(); msg._id = msgSnap.key;
      if (msg.timestamp && msg.timestamp < connectTime) return;
      var isForMe = msg.receiver && msg.receiver.toLowerCase() === currentUser.toLowerCase();
      var isFromMe = msg.sender && msg.sender.toLowerCase() === currentUser.toLowerCase();
      if (isForMe && !(currentPrivateChat && currentPrivateChat.toLowerCase() === msg.sender.toLowerCase())) { showPrivateNotification(msg.sender); }
      if (currentPrivateChat && (isForMe || isFromMe)) { 
        var currentChatId = [currentUser.toLowerCase(), currentPrivateChat.toLowerCase()].sort().join('_'); 
        if (chatId === currentChatId) { addMessageToUI(msg, true); if (isForMe) msgSnap.ref.update({ is_read: true }); } 
      }
    });
    db.ref('private_messages/' + chatId).on('child_removed', (snap) => {
      var removedId = snap.key; var msgDiv = document.querySelector(`.msg[data-msg-id="${removedId}"]`); if (msgDiv) msgDiv.remove();
    });
  });
}

function setupPresenceInitial() { 
  db.ref('users').on('value', (snap) => { 
    onlineUsers = {}; snap.forEach(child => { 
      var user = child.val(); if (user.username) { 
        onlineUsers[user.username] = true; 
        if (user.avatar) { var lower = user.username.toLowerCase(); userAvatars[lower] = user.avatar; localStorage.setItem('user_avatar_' + lower, user.avatar); } 
      } 
    }); updateUserList(); 
  }); 
}

async function registerUser() {
  var username = document.getElementById('userIn').value.trim(); var password = document.getElementById('passIn').value.trim();
  var err = document.getElementById('err'); err.style.display = 'none';
  if (!username || !password) { err.textContent = '⚠️ Συμπλήρωσε όνομα και κωδικό!'; err.style.display = 'block'; return; }
  if (username.includes(":")) { err.textContent = '⚠️ Το όνομα δεν μπορεί να περιέχει ":"'; err.style.display = 'block'; return; }
  if (password.length < 3) { err.textContent = '⚠️ Ο κωδικός πρέπει να είναι τουλάχιστον 3 χαρακτήρες!'; err.style.display = 'block'; return; }
  var isBanned = await checkIfBanned(username);
  if (isBanned) { err.textContent = '🚫 Αυτό το όνομα είναι banned!'; err.style.display = 'block'; return; }
  var existingSnap = await db.ref('registered_users/' + username.toLowerCase()).once('value');
  if (existingSnap.exists()) { err.textContent = '❌ Αυτό το όνομα είναι ήδη κατοχυρωμένο!'; err.style.display = 'block'; return; }
  try {
    await db.ref('registered_users/' + username.toLowerCase()).set({ username: username, password: password, avatar: null, created_at: Date.now() });
    localStorage.setItem('chat_username', username); localStorage.setItem('chat_password', password);
    await enterChat(username);
  } catch(e) { err.textContent = 'Σφάλμα: ' + e.message; err.style.display = 'block'; }
}

async function goChat(isAutoLogin = false) { 
  var username = document.getElementById('userIn').value.trim(); var password = document.getElementById('passIn').value.trim();
  var err = document.getElementById('err'); err.style.display = 'none'; 
  if (!username || !password) { err.textContent = '⚠️ Συμπλήρωσε όνομα και κωδικό!'; err.style.display = 'block'; return; }
  var isBanned = await checkIfBanned(username);
  if (isBanned) { err.textContent = '🚫 Αυτό το όνομα είναι banned!'; err.style.display = 'block'; if (isAutoLogin) { localStorage.removeItem('chat_username'); localStorage.removeItem('chat_password'); } return; } 
  if (username.toLowerCase() === "sakis" && password !== "019630") { 
    if (isAutoLogin) { localStorage.removeItem('chat_username'); localStorage.removeItem('chat_password'); } 
    else { err.textContent = 'Λάθος κωδικός!'; err.style.display = 'block'; } return; 
  }
  var regSnap = await db.ref('registered_users/' + username.toLowerCase()).once('value');
  if (!regSnap.exists() && username.toLowerCase() !== "sakis") {
    err.textContent = '❌ Δεν υπάρχει λογαριασμός. Κάνε εγγραφή!'; err.style.display = 'block';
    if (isAutoLogin) { localStorage.removeItem('chat_username'); localStorage.removeItem('chat_password'); } return;
  }
  if (username.toLowerCase() !== "sakis") {
    var regData = regSnap.val();
    if (regData.password !== password) { err.textContent = '❌ Λάθος κωδικός!'; err.style.display = 'block'; if (isAutoLogin) { localStorage.removeItem('chat_username'); localStorage.removeItem('chat_password'); } return; }
  }
  try { 
    var sessionSnap = await db.ref('active_sessions/' + username).once('value'); var existing = sessionSnap.val();
    if (existing) { if (existing.session_id !== currentSessionId) { err.textContent = 'Το όνομα είναι ήδη συνδεδεμένο αλλού!'; err.style.display = 'block'; return; } } 
    else { await db.ref('active_sessions/' + username).set({ session_id: currentSessionId, timestamp: Date.now() }); } 
    localStorage.setItem('chat_username', username); localStorage.setItem('chat_password', password);
    await enterChat(username);
  } catch(e) { err.textContent = 'Σφάλμα: ' + e.message; err.style.display = 'block'; } 
}

async function enterChat(username) {
  currentUser = username; connectTime = Date.now();
  if (currentUser.toLowerCase() === "sakis") { 
    isAdmin = true; document.getElementById('adminClearBtn').style.display = 'block'; 
    document.getElementById('bannedBtn').classList.add('show'); document.getElementById('clearBtn').classList.add('show'); 
  } else { 
    isAdmin = false; document.getElementById('clearBtn').classList.remove('show'); document.getElementById('bannedBtn').classList.remove('show');
  } 
  var regSnap = await db.ref('registered_users/' + username.toLowerCase()).once('value'); var regData = regSnap.val();
  if (regData && regData.avatar) { userAvatars[username.toLowerCase()] = regData.avatar; localStorage.setItem('user_avatar_' + username.toLowerCase(), regData.avatar); }
  var trackData = { username: currentUser }; 
  var localAvatar = userAvatars[currentUser.toLowerCase()] || localStorage.getItem('user_avatar_' + currentUser.toLowerCase());
  if (localAvatar) { trackData.avatar = localAvatar; } 
  await db.ref('users/' + currentUser).set(trackData);
  db.ref('users/' + currentUser).onDisconnect().remove();
  document.getElementById('loginDiv').style.display = 'none'; document.getElementById('chatApp').style.display = 'flex'; 
  document.getElementById('msgInput').focus(); 
  await loadMessages(); subscribeToMessages(); subscribeToBans(); setupPresenceInitial();
}

async function adminClearAll() { 
  if (!isAdmin) return; 
  if (!confirm("⚠️ Διαγραφή ΟΛΩΝ των λογαριασμών ΕΚΤΟΣ από εσένα (sakis);\n\nΘα χαθούν ονόματα, κωδικοί, φωτογραφίες.\n\nΕσύ θα παραμείνεις!")) return; 
  try { 
    var regSnap = await db.ref('registered_users').once('value'); var updates = {};
    regSnap.forEach(child => { var username = child.key; if (username.toLowerCase() !== 'sakis') { updates['registered_users/' + username] = null; } });
    var sessionsSnap = await db.ref('active_sessions').once('value');
    sessionsSnap.forEach(child => { var username = child.key; if (username.toLowerCase() !== 'sakis') { updates['active_sessions/' + username] = null; } });
    var usersSnap = await db.ref('users').once('value');
    usersSnap.forEach(child => { var username = child.key; if (username.toLowerCase() !== 'sakis') { updates['users/' + username] = null; } });
    await db.ref().update(updates); alert("✅ Καθαρισμός ολοκληρώθηκε!"); ensureAdminOnline();
  } catch(e) { alert("Σφάλμα: " + e.message); } 
}

async function logoutChat() { 
  if (!confirm("⚠️ Προσοχή! Αν αποσυνδεθείτε, το όνομά σας αποδεσμεύεται. Αν το προλάβει και το κατοχυρώσει άλλος χρήστης, θα χάσετε μόνιμα το όνομα και τη φωτογραφία σας και θα πρέπει να κάνετε νέα εγγραφή από την αρχή.Θέλετε σίγουρα να αποσυνδεθείτε;")) return; 
  document.getElementById('playerIframe').src = ''; document.getElementById('playerPanel').classList.remove('show'); isPlayerOpen = false; closeTvLiveWindow();
  try { 
    await db.ref('active_sessions/' + currentUser).remove(); await db.ref('users/' + currentUser).remove();
    localStorage.removeItem('chat_username'); localStorage.removeItem('chat_password');
    currentUser = ''; document.getElementById('chatApp').style.display = 'none'; document.getElementById('loginDiv').style.display = 'flex'; 
    document.getElementById('userIn').value = ''; document.getElementById('passIn').value = '';
  } catch(e) { console.error('Logout error:', e); alert('Σφάλμα: ' + e.message); } 
}

function showClearConfirmation() { if (!isAdmin) return; document.getElementById('clearConfirmationOverlay').classList.add('show'); }
function hideClearConfirmation() { document.getElementById('clearConfirmationOverlay').classList.remove('show'); }
async function confirmClearMessages() { 
  if (!isAdmin) return; hideClearConfirmation(); 
  try { await db.ref('messages').remove(); alert('✅ Διαγράφηκαν!'); ensureAdminOnline(); } 
  catch(e) { alert('Σφάλμα: ' + e.message); } 
}

function openImagePreview(imgSrc) { var overlay = document.getElementById('imagePreviewOverlay'); var img = document.getElementById('imagePreviewImg'); img.src = imgSrc; overlay.classList.add('show'); }
function closeImagePreview(event) { if (event.target.id === 'imagePreviewOverlay' || event.target.classList.contains('image-preview-close')) { document.getElementById('imagePreviewOverlay').classList.remove('show'); } }
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { document.getElementById('imagePreviewOverlay').classList.remove('show'); if (isTvLiveOpen) { closeTvLiveWindow(); } } });
document.getElementById('userIn').addEventListener('keypress', e => { if (e.key === 'Enter') document.getElementById('passIn').focus(); });
document.getElementById('passIn').addEventListener('keypress', e => { if (e.key === 'Enter') goChat(); });
document.getElementById('msgInput').addEventListener('keypress', e => { if (e.key === 'Enter') sendMsg(); });

window.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'RADIO_TITLE_UPDATE') {
    var titleText = event.data.title || 'Radio Synnefa Live';
    var titleEl = document.getElementById('radioNowPlayingText');
    if (titleEl) {
      var textarea = document.createElement('textarea'); textarea.innerHTML = titleText; var decodedText = textarea.value;
      titleEl.innerHTML = '<span class="radio-text-scroll">' + decodedText + '</span>';
    }
  }
});

let mediaRecorder = null;
let audioChunks = [];
let recordingInterval = null;
let recordingSeconds = 0;
let currentAudioBlob = null;
let currentAudioUrl = null;
const CLOUDINARY_CLOUD_NAME = 'ceu1jpxy';
const CLOUDINARY_UPLOAD_PRESET = 'radiochat_audio';

async function toggleRecording() { if (!mediaRecorder || mediaRecorder.state === 'inactive') { await startRecording(); } else { stopRecording(); } }

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream); audioChunks = []; recordingSeconds = 0;
    mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) { audioChunks.push(event.data); } };
    mediaRecorder.onstop = () => {
      currentAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      currentAudioUrl = URL.createObjectURL(currentAudioBlob);
      document.getElementById('previewAudioPlayer').src = currentAudioUrl;
      document.getElementById('audioPreviewOverlay').classList.add('show');
      stream.getTracks().forEach(track => track.stop());
    };
    mediaRecorder.start();
    document.getElementById('micBtn').classList.add('recording');
    document.getElementById('recordingTimer').style.display = 'flex';
    recordingInterval = setInterval(() => {
      recordingSeconds++;
      const mins = Math.floor(recordingSeconds / 60);
      const secs = recordingSeconds % 60;
      document.getElementById('recTimeText').textContent = `${mins}:${secs.toString().padStart(2, '0')} / 0:30`;
      if (recordingSeconds >= 30) { stopRecording(); }
    }, 1000);
  } catch (err) {
    alert('⚠️ Δεν ήταν δυνατή η πρόσβαση στο μικρόφωνο.\nΠαρακαλώ επέτρεψε την πρόσβαση στις ρυθμίσεις του browser.');
    console.error('Mic error:', err);
  }
}

// ΔΙΟΡΘΩΜΕΝΗ: Πλήρης απελευθέρωση μικροφώνου για να μην ανταγωνίζεται το ραδιόφωνο
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    clearInterval(recordingInterval);
    if (mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
    }
    mediaRecorder = null;
    document.getElementById('micBtn').classList.remove('recording');
    document.getElementById('recordingTimer').style.display = 'none';
  }
}

function cancelRecording() {
  document.getElementById('audioPreviewOverlay').classList.remove('show');
  if (currentAudioUrl) { URL.revokeObjectURL(currentAudioUrl); currentAudioUrl = null; }
  currentAudioBlob = null;
}

async function sendAudioMessage() {
  if (!currentAudioBlob) return;
  const sendBtn = document.querySelector('.preview-btn.send');
  const originalText = sendBtn.textContent;
  sendBtn.textContent = '⏳ Αποστολή...'; sendBtn.disabled = true;
  try {
    const formData = new FormData();
    formData.append('file', currentAudioBlob, 'recording.webm');
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, { method: 'POST', body: formData });
    const data = await response.json();
    if (data.secure_url) {
      const audioUrl = data.secure_url; const timestamp = Date.now();
      if (currentPrivateChat) {
        const chatId = [currentUser.toLowerCase(), currentPrivateChat.toLowerCase()].sort().join('_');
        await db.ref('private_messages/' + chatId).push({ sender: currentUser, receiver: currentPrivateChat, message: '[🎙️ Ηχητικό Μήνυμα]', audioUrl: audioUrl, timestamp: timestamp });
      } else {
        await db.ref('messages').push({ user: currentUser, text: '[🎙️ Ηχητικό Μήνυμα]', audioUrl: audioUrl, timestamp: timestamp });
      }
      cancelRecording();
    } else { throw new Error('Αποτυχία μεταφόρτωσης στο Cloudinary'); }
  } catch (err) { alert('Σφάλμα κατά την αποστολή: ' + err.message); } 
  finally { sendBtn.textContent = originalText; sendBtn.disabled = false; }
}