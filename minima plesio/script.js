const firebaseConfig = {
  apiKey: "AIzaSyCBSduuXA59rSwm_siZ_o7vMzWi-c4esNY",
  authDomain: "radiochatlive2.firebaseapp.com",
  databaseURL: "https://radiochatlive2-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "radiochatlive2",
  storageBucket: "radiochatlive2.firebasestorage.app",
  messagingSenderId: "872129194132",
  appId: "1:872129194132:web:09255f2edfd3ec2237ec81"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentUser = '';
let currentUid = '';
let currentSessionId = '';
let onlineUsers = {};
let userAvatars = {};
let isAdmin = false;
let currentPrivateChat = null;
let currentPrivateChatName = null;
let pendingPrivateNotif = null;
let bannedUsersList = [];
let pendingBanUsername = null;
let isPlayerOpen = false;
let isPlayerLoaded = false;
let isAvatarUploading = false;
let connectTime = 0;
let isTvLiveOpen = false;
let unreadPrivateMessages = {};
let privateChatListeners = {};
let currentPrivateNotification = null;

if (!localStorage.getItem('chat_device_unique_id')) { 
  const fixedId = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(); 
  localStorage.setItem('chat_device_unique_id', fixedId); 
}
currentSessionId = localStorage.getItem('chat_device_unique_id');

const tvDragState = { isDragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 };

function showCustomToast(title, message, isError = false) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = isError ? '⚠️' : '✅';
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentNode === container) container.removeChild(toast); }, 4000);
}

function showPrivateMessageNotification(senderName, senderUid) {
  const notificationContainer = document.getElementById('privateMessageNotification');
  if (!notificationContainer) return;
  
  const notification = document.createElement('div');
  notification.className = 'private-message-notification';
  notification.innerHTML = `
    <div class="private-message-notification-icon"></div>
    <div class="private-message-notification-text">
      <div class="private-message-notification-title">Νέο μήνυμα</div>
      <div class="private-message-notification-name">Από: ${escapeHtml(senderName)}</div>
    </div>
  `;
  
  notification.onclick = function() {
    notification.remove();
    startPrivateChat(senderUid, senderName);
  };
  
  notificationContainer.appendChild(notification);
  currentPrivateNotification = notification;
  playNotificationSound();
}

function hidePrivateMessageNotification() {
  const notificationContainer = document.getElementById('privateMessageNotification');
  if (currentPrivateNotification) { currentPrivateNotification.remove(); currentPrivateNotification = null; }
  if (notificationContainer) { notificationContainer.innerHTML = ''; }
}

function toggleTvLiveWindow() { isTvLiveOpen ? closeTvLiveWindow() : openTvLiveWindow(); }
function openTvLiveWindow() {
  const win = document.getElementById('tvLiveWindow');
  if (!isTvLiveOpen) { document.getElementById('tvLiveIframe').src = 'sakis tv/tv.html'; }
  win.classList.add('show'); isTvLiveOpen = true;
}
function closeTvLiveWindow() {
  const win = document.getElementById('tvLiveWindow');
  win.classList.remove('show'); win.style.width = ''; win.style.height = '';
  document.getElementById('tvLiveIframe').src = ''; isTvLiveOpen = false;
}

const tvHeader = document.getElementById('tvLiveWindowHeader');
tvHeader.addEventListener('mousedown', function(e) {
  if (e.target.closest('.tv-live-window-btn')) return;
  const win = document.getElementById('tvLiveWindow');
  tvDragState.isDragging = true; tvDragState.startX = e.clientX; tvDragState.startY = e.clientY;
  const rect = win.getBoundingClientRect(); tvDragState.startLeft = rect.left; tvDragState.startTop = rect.top;
  win.style.right = 'auto'; win.style.left = rect.left + 'px'; win.style.top = rect.top + 'px';
  document.body.style.userSelect = 'none'; e.preventDefault();
});
document.addEventListener('mousemove', function(e) {
  if (!tvDragState.isDragging) return;
  const win = document.getElementById('tvLiveWindow');
  const dx = e.clientX - tvDragState.startX; const dy = e.clientY - tvDragState.startY;
  let newLeft = tvDragState.startLeft + dx; let newTop = tvDragState.startTop + dy;
  newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - win.offsetWidth));
  newTop = Math.max(0, Math.min(newTop, window.innerHeight - 40));
  win.style.left = newLeft + 'px'; win.style.top = newTop + 'px';
});
document.addEventListener('mouseup', function() {
  if (tvDragState.isDragging) { tvDragState.isDragging = false; document.body.style.userSelect = ''; }
});
tvHeader.addEventListener('touchstart', function(e) {
  if (e.target.closest('.tv-live-window-btn')) return;
  const touch = e.touches[0]; const win = document.getElementById('tvLiveWindow');
  tvDragState.isDragging = true; tvDragState.startX = touch.clientX; tvDragState.startY = touch.clientY;
  const rect = win.getBoundingClientRect(); tvDragState.startLeft = rect.left; tvDragState.startTop = rect.top;
  win.style.right = 'auto'; win.style.left = rect.left + 'px'; win.style.top = rect.top + 'px';
}, { passive: true });
document.addEventListener('touchmove', function(e) {
  if (!tvDragState.isDragging) return;
  const touch = e.touches[0]; const win = document.getElementById('tvLiveWindow');
  const dx = touch.clientX - tvDragState.startX; const dy = touch.clientY - tvDragState.startY;
  let newLeft = tvDragState.startLeft + dx; let newTop = tvDragState.startTop + dy;
  newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - win.offsetWidth));
  newTop = Math.max(0, Math.min(newTop, window.innerHeight - 40));
  win.style.left = newLeft + 'px'; win.style.top = newTop + 'px';
}, { passive: true });
document.addEventListener('touchend', function() { if (tvDragState.isDragging) { tvDragState.isDragging = false; } });

function ensureAdminOnline() {
  if (currentUser && isAdmin) {
    const avatarData = userAvatars[currentUid] || localStorage.getItem('user_avatar_' + currentUid) || null;
    db.ref('users/' + currentUid).update({ avatar: avatarData });
  }
}

function togglePlayer() { isPlayerOpen ? closePlayer() : openPlayer(); }
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

const notificationSound = new Audio('https://cdn.pixabay.com/audio/2024/02/08/audio_b7f03fb030.mp3');
let soundVolume = 1.0;
const soundStates = [
  { volume: 1.0, icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>' },
  { volume: 0.3, icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>' },
  { volume: 0, icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>' }
];
let currentSoundState = 0;

function loadSoundSettings() { 
  const saved = localStorage.getItem('chat_sound_volume'); 
  if (saved !== null) { currentSoundState = parseInt(saved); soundVolume = soundStates[currentSoundState].volume; notificationSound.volume = soundVolume; updateSoundButton(); } 
}
function updateSoundButton() { document.getElementById('soundBtn').innerHTML = soundStates[currentSoundState].icon; }
function toggleSound() { 
  currentSoundState = (currentSoundState + 1) % soundStates.length; soundVolume = soundStates[currentSoundState].volume; 
  notificationSound.volume = soundVolume; localStorage.setItem('chat_sound_volume', currentSoundState); updateSoundButton(); 
}
function playNotificationSound() { if (soundVolume > 0) { notificationSound.currentTime = 0; notificationSound.play().catch(() => {}); } }

var emojiCategories = {
    smileys: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🥳','😏','😒','😞','😔','😟','😕','🙁','😖','😫','😩','🥺','😭','😤','😠','😡','🤬','😳','🥶','😨','😰','😥','😓','🤗','🤔','🤫','😶','😐','😑','😬','🙄','😯','😧','😮','😲','😴','🤤','😵','🤐','🥴','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','💩','💀','☠️','👽','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾','🙈','🙉','🙊'],
    animals: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🐣','🦆','🦅','🦉','🦇','🐺','🦄','🐝','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐈','🐓','🦃','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦦','🦥','🐁','🐀','🐿️','🦔','🐾','🐉','🐲'],
    food: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥖','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🌭','🍔','🍟','🍕','🫓','🥙','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🫗','🍼','🫖','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊','🥄','🍴','🍽️','🥣','🥡','🥢','🧂'],
    activities: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🎰','🧩'],
    travel: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛺','🚨','🚔','🚍','🚖','🚘','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅','🚈','🚇','🚆','🚉','✈️','🛫','🛬','🛩️','💺','🛰️','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','⚓','🪝','⛽','🚧','🚦','🚥','🗺️','🗿','🗽','🗼','🏰','🏯','🏟️','🎡','🎢','🎠','⛲','⛱️','🏖️','🏝️','🏜️','🌋','⛰️','🏔️','🗻','🏕️','⛺','🛖','🏠','🏡','🏘️','🏚️','🏗️','🏭','🏢','🏬','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏩','💒','🏛️','⛪','🕌','🕍','🛕','🕋','⛩️','🛤️','🛣️','🗾','🎑','🏞️','🌅','🌄','🌠','🎇','🎆','🌇','🌆','🏙️','🌃','🌌','🌉','🌁'],
    objects: ['⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧱','⛓️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','💈','⚗️','🔭','🔬','🕳️','🩹','🩺','💊','💉','🩸','🧬','🦠','🧫','🧪','🌡️','🧹','🪠','🧺','🧻','🚽','🚰','🚿','🛁','🛀','🧼','🪥','🪒','🧽','🪣','🧴','🛎️','🔑','🗝️','🚪','🪑','🛋️','🛏️','🛌','🧸','🪆','🖼️','🪞','🪟','🛍️','🛒','🎁','🎈','🎏','🎀','🪄','🪅','🎊','🎉','🎎','🏮','🎐','🧧','✉️','📩','📨','📧','💌','📥','📤','📦','🏷️','🪧','📪','📫','📬','📭','📮','📯','📜','📃','📄','📑','🧾','📊','📈','📉','🗒️','🗓️','📆','📅','🗑️','📇','🗃️','🗳️','🗄️','📋','📁','📂','🗂️','🗞️','📰','📓','📔','📒','📕','📗','📘','📙','📚','📖','🔖','🧷','🔗','📎','🖇️','📐','📏','🧮','📌','📍','✂️','🖊️','🖋️','✒️','🖌️','🖍️','📝','✏️','🔍','🔎','🔏','🔐','🔒','🔓'],
    symbols: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈂️','🛂','🛃','🛄','🛅','🚹','🚺','🚼','⚧️','🚻','🚮','🎦','📶','🈁','🔣','ℹ️','🔤','🔡','🔠','🆖','🆗','🆙','🆒','🆕','🆓','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔢','#️⃣','*️⃣','⏏️','▶️','⏸️','⏯️','⏹️','⏺️','⏭️','⏮️','⏩','⏪','⏫','⏬','◀️',' 🔼',' 🔽','➡️','⬅️','⬆️','⬇️','↗️','↘️','↙️','↖️','↕️','↔️','↪️','↩️','⤴️','⤵️','🔀','🔁','🔂','🔄','🔃','🎵','🎶','➕','➖','➗','✖️','♾️','💲','💱','™️','©️','®️','👁️‍🗨️','🔚','🔙','🔛','🔝','🔜','〰️','➰','➿','✔️','☑️','🔘','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔸','🔹','🔶','🔷','🔳','🔲','▪️','▫️','◾','◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫','🔈','🔇','🔉','🔊','🔔','🔕','📣','📢','👁️‍🗨️','💬','💭','🗯️','♠️','♣️','♥️','♦️','🃏','🎴','🀄','🕐','🕑','🕒','🕓','🕔','🕕','🕖','🕗','🕘','🕙','🕚','🕛']
  };

Object.keys(emojiCategories).forEach(category => { 
  const container = document.getElementById(category); 
  emojiCategories[category].forEach(emoji => { 
    const span = document.createElement('span'); span.className = 'emoji'; span.textContent = emoji; 
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

function toggleBgControls() { 
  document.getElementById('bgControlsPanel').classList.toggle('show'); 
  document.getElementById('bannedPanel').classList.remove('show'); 
}
function updateBackground() { 
  const posX = document.getElementById('bgPositionX').value; 
  const brightness = document.getElementById('bgBrightness').value; 
  const blur = document.getElementById('bgBlur').value; 
  const overlay = document.getElementById('bgOverlay').value; 
  document.getElementById('bgContainer').style.backgroundPosition = posX + '% center'; 
  document.getElementById('bgContainer').style.filter = 'brightness(' + brightness + '%) blur(' + blur + 'px)'; 
  document.querySelector('.bg-overlay').style.background = 'rgba(11, 15, 25, ' + (overlay / 100) + ')'; 
  document.getElementById('posValue').textContent = posX + '%'; 
  document.getElementById('brightValue').textContent = brightness + '%'; 
  document.getElementById('blurValue').textContent = blur + 'px'; 
  document.getElementById('overlayValue').textContent = overlay + '%'; 
  localStorage.setItem('bg_settings', JSON.stringify({ posX, brightness, blur, overlay })); 
}
function loadBgSettings() { 
  const saved = localStorage.getItem('bg_settings'); 
  if (saved) { 
    const s = JSON.parse(saved); 
    document.getElementById('bgPositionX').value = s.posX || 50; 
    document.getElementById('bgBrightness').value = s.brightness || 100; 
    document.getElementById('bgBlur').value = s.blur || 0; 
    document.getElementById('bgOverlay').value = s.overlay || 70; 
    updateBackground(); 
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
  const username = pendingBanUsername; pendingBanUsername = null; 
  try { 
    await db.ref('banned_users/' + username.toLowerCase()).set({ 
      banned_by: currentUser, 
      ban_type: 'username', 
      banned_at: firebase.database.ServerValue.TIMESTAMP 
    }); 
    ensureAdminOnline();
    loadBannedUsers();
    showCustomToast('Επιτυχία', `Ο χρήστης ${username} μπλοκαρίστηκε.`);
  } catch(e) { 
    showCustomToast('Σφάλμα', 'Αποτυχία μπλοκαρίσματος.', true); 
  } 
}

function cancelBan() { pendingBanUsername = null; document.getElementById('banTypeOverlay').classList.remove('show'); }

async function unbanUser(username) { 
  if (!confirm('Αφαίρεση ban;')) return; 
  try { 
    await db.ref('banned_users/' + username.toLowerCase()).remove(); 
    ensureAdminOnline();
    loadBannedUsers(); renderBannedUsersPanel(); 
    showCustomToast('Επιτυχία', 'Το ban αφαιρέθηκε.');
  } catch(e) { 
    showCustomToast('Σφάλμα', 'Αποτυχία αφαίρεσης ban.', true); 
  } 
}

async function loadBannedUsers() { 
  return new Promise((resolve) => { db.ref('banned_users').once('value', (snap) => { bannedUsersList = []; snap.forEach(child => { bannedUsersList.push({ username: child.key, ...child.val() }); }); resolve(); }); }); 
}

function renderBannedUsersPanel() { 
  const list = document.getElementById('bannedUsersList'); list.innerHTML = ''; 
  if (bannedUsersList.length === 0) { list.innerHTML = '<div class="no-banned">Δεν υπάρχουν banned χρήστες 🎉</div>'; return; } 
  bannedUsersList.forEach(ban => { 
    const div = document.createElement('div'); div.className = 'banned-user-item'; 
    const time = new Date(ban.banned_at).toLocaleString('el'); 
    div.innerHTML = `<div class="banned-user-info"><div class="banned-user-name">${escapeHtml(ban.username)}</div><div class="banned-user-time">${time}</div></div><button class="unban-btn" onclick="unbanUser(this.dataset.user)" data-user="${escapeHtml(ban.username)}">Unban</button>`; 
    list.appendChild(div); 
  }); 
}

function toggleBannedPanel() { 
  const panel = document.getElementById('bannedPanel'); panel.classList.toggle('show'); 
  document.getElementById('bgControlsPanel').classList.remove('show'); document.getElementById('emojiPanel').classList.remove('show'); 
  if (panel.classList.contains('show')) { loadBannedUsers().then(() => renderBannedUsersPanel()); } 
}

function handleBannedWhileOnline() { 
  document.getElementById('banNotifOverlay').classList.add('show'); 
  setTimeout(async () => { 
    try { 
      db.ref('users/' + currentUid).remove(); localStorage.removeItem('chat_uid'); localStorage.removeItem('chat_username'); localStorage.removeItem('chat_password');
      currentUser = ''; currentUid = ''; isAdmin = false; document.getElementById('chatApp').style.display = 'none'; 
      document.getElementById('banNotifOverlay').classList.remove('show'); document.getElementById('loginDiv').style.display = 'flex'; 
    } catch(e) {} 
  }, 3000); 
}

function subscribeToBans() { 
  db.ref('banned_users').on('child_added', (snap) => { 
    const bannedName = (snap.key || '').toString().trim().toLowerCase();
    const myName = (currentUser || '').toString().trim().toLowerCase();
    if (bannedName && myName && bannedName === myName) { 
      handleBannedWhileOnline(); 
    } 
  }); 
  db.ref('banned_users').on('child_removed', () => { 
    if (isAdmin && document.getElementById('bannedPanel').classList.contains('show')) { 
      loadBannedUsers().then(() => renderBannedUsersPanel()); 
    } 
  }); 
}

async function handleAvatarUpload(event) {
  const file = event.target.files[0]; if (!file) return;
  if (isAvatarUploading) { showCustomToast('Περιμένετε', 'Γίνεται ήδη ανέβασμα.', true); event.target.value = ''; return; }
  if (file.size > 20 * 1024 * 1024) { showCustomToast('Σφάλμα', 'Μέγιστο μέγεθος 20MB!', true); event.target.value = ''; return; }
  isAvatarUploading = true;
  const userItems = document.querySelectorAll('.user-item'); let userAvatarEl = null;
  userItems.forEach(item => { const nameEl = item.querySelector('.user-name'); if (nameEl && nameEl.textContent === currentUser) { userAvatarEl = item.querySelector('.avatar'); } });
  const originalAvatarHTML = userAvatarEl ? userAvatarEl.innerHTML : '';
  if (userAvatarEl) { userAvatarEl.classList.add('loading'); userAvatarEl.innerHTML = '<div class="avatar-spinner"></div>'; }
  try {
    const uploadResult = await uploadToImgur(file);
    userAvatars[currentUid] = uploadResult.link;
    localStorage.setItem('user_avatar_' + currentUid, uploadResult.link);
    db.ref('registered_users/' + currentUid + '/avatar').set(uploadResult.link);
    db.ref('users/' + currentUid).update({ avatar: uploadResult.link });
    updateUserList(); showCustomToast('Επιτυχία', 'Η φωτογραφία σου ενημερώθηκε!');
  } catch(err) { 
    showCustomToast('Σφάλμα', err.message, true); if (userAvatarEl) { userAvatarEl.classList.remove('loading'); userAvatarEl.innerHTML = originalAvatarHTML; } 
  } finally { isAvatarUploading = false; event.target.value = ''; }
}

window.addEventListener('load', async function() { 
  loadBgSettings(); loadSoundSettings(); 
  const savedUser = localStorage.getItem('chat_username'); const savedPass = localStorage.getItem('chat_password');
  if (savedUser && savedPass) { document.getElementById('userIn').value = savedUser; document.getElementById('passIn').value = savedPass; setTimeout(() => goChat(true), 300); } 
});

function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML.replace(/'/g, '&#39;').replace(/"/g, '&quot;'); }
function linkify(text) { 
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g; 
  return text.replace(urlRegex, function(url) { 
    const fullUrl = url.startsWith('http') ? url : 'https://' + url; 
    return '<a href="' + fullUrl + '" target="_blank" style="color: #60a5fa; text-decoration: underline; word-break: break-all;">' + url + '</a>'; 
  }); 
}
function getAvatarHtml(username, uid) { 
  const avatarUrl = userAvatars[uid] || localStorage.getItem('user_avatar_' + uid); 
  if (avatarUrl) { return `<div class="msg-avatar"><img src="${avatarUrl}" alt="${escapeHtml(username)}"></div>`; } 
  return `<div class="msg-avatar">${username.charAt(0).toUpperCase()}</div>`; 
}

async function loadMessages() { 
  const container = document.getElementById('msgContainer'); container.innerHTML = '';
  db.ref('messages').limitToLast(50).once('value', (snap) => {
    snap.forEach(child => { const msg = child.val(); msg._id = child.key; addMessageToUI(msg, false); });
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 100);
  });
}
async function loadPrivateMessages(otherUid, otherName) { 
  const container = document.getElementById('msgContainer'); container.innerHTML = ''; 
  const chatId = [currentUid, otherUid].sort().join('_');
  db.ref('private_messages/' + chatId).limitToLast(200).once('value', (snap) => {
    snap.forEach(child => { const msg = child.val(); msg._id = child.key; addMessageToUI(msg, true); });
    container.scrollTop = container.scrollHeight;
    db.ref('private_messages/' + chatId).orderByChild('receiverUid').equalTo(currentUid).once('value', (snap) => { 
      snap.forEach(child => { if (!child.val().is_read) { child.ref.update({ is_read: true }); } }); 
    });
  });
}

function addMessageToUI(msg, isPrivate) {
  const container = document.getElementById('msgContainer');
  if (msg._id) { const existingMsg = container.querySelector(`.msg[data-msg-id="${msg._id}"]`); if (existingMsg) return; }
  const div = document.createElement('div');
  const senderName = msg.userName || msg.senderName || msg.user || msg.sender || "Άγνωστος";
  const senderUid = msg.userId || msg.senderUid || "unknown";
  const text = msg.text || msg.message || "";
  const img = msg.image || msg.image_data || null;
  const msgId = msg._id;
  const deletehash = msg.imageDeletehash || null;
  const isOwn = (senderUid === currentUid);
  div.className = 'msg' + (isOwn ? ' own' : '') + (isPrivate ? ' private' : '');
  if (msgId) { div.setAttribute('data-msg-id', msgId); }
  const avatarHtml = getAvatarHtml(senderName, senderUid);
  const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString('el', { hour: '2-digit', minute: '2-digit' });
  let deleteButtonHtml = '';
  if (img && isAdmin && deletehash && msgId) {
    const firebasePath = isPrivate ? 'private_messages/' + [msg.senderUid, msg.receiverUid].sort().join('_') + '/' + msgId : 'messages/' + msgId;
    const safePath = firebasePath.replace(/'/g, "\\'");
    const safeDeletehash = deletehash.replace(/'/g, "\\'");
    deleteButtonHtml = `<button class="delete-image-btn" onclick="deleteImage('${safePath}', '${safeDeletehash}', this)">🗑️ Διαγραφή</button>`;
  }
  
  let contentHtml = '';
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
  if (!confirm('️ Διαγραφή ΤΕΛΕΙΩΣ από παντού;')) return;
  buttonElement.disabled = true; buttonElement.textContent = '⏳ Διαγραφή...';
  try {
    await fetch(`https://api.imgur.com/3/image/${deletehash}`, { method: "DELETE", headers: { "Authorization": "Client-ID 546c25a59c58ad7" } });
    await db.ref(firebasePath).remove();
    showCustomToast('Επιτυχία', 'Η εικόνα διαγράφηκε οριστικά.');
  } catch(e) { 
    showCustomToast('Σφάλμα', e.message, true); buttonElement.disabled = false; buttonElement.textContent = '🗑️ Διαγραφή'; 
  }
}

async function sendMsg() { 
  const input = document.getElementById('msgInput'); const text = input.value.trim(); if (!text) return; 
  try { 
    if (currentPrivateChat) { 
      const chatId = [currentUid, currentPrivateChat].sort().join('_'); 
      db.ref('private_messages/' + chatId).push({ 
        senderUid: currentUid, senderName: currentUser, 
        receiverUid: currentPrivateChat, receiverName: currentPrivateChatName, 
        message: text, timestamp: Date.now() 
      }); 
    } else { 
      db.ref('messages').push({ 
        userId: currentUid, userName: currentUser, text: text, timestamp: Date.now() 
      }); 
    } 
    input.value = ''; 
  } catch(e) { showCustomToast('Σφάλμα', e.message, true); } 
}

function toggleEmoji() { 
  document.getElementById('emojiPanel').classList.toggle('show'); 
  document.getElementById('bannedPanel').classList.remove('show'); 
  document.getElementById('bgControlsPanel').classList.remove('show'); 
}

function updateUserList() {
  const list = document.getElementById('userList'); list.innerHTML = '';
  const usersArray = Object.keys(onlineUsers).map(uid => ({ uid: uid, ...onlineUsers[uid] }));
  usersArray.sort((a, b) => a.username.localeCompare(b.username));

  usersArray.forEach(u => {
    const username = u.username;
    const uid = u.uid;
    const div = document.createElement('div'); div.className = 'user-item';
    const initial = username.charAt(0).toUpperCase();
    const isAdminUser = username.toLowerCase() === 'sakis';
    const avatarClass = isAdminUser ? 'avatar admin-avatar' : 'avatar';
    const adminBadge = isAdminUser ? '<span class="admin-badge"> Admin</span>' : '';
    let avatarHtml = '';
    if (userAvatars[uid]) {
      avatarHtml = `<div class="${avatarClass}" onclick="triggerAvatarUpload('${uid}')" data-uid="${uid}"><img src="${userAvatars[uid]}">${uid === currentUid ? '<div class="avatar-upload-hint"></div>' : ''}</div>`;
    } else {
      avatarHtml = `<div class="${avatarClass}" onclick="triggerAvatarUpload('${uid}')" data-uid="${uid}">${initial}${uid === currentUid ? '<div class="avatar-upload-hint">📷</div>' : ''}</div>`;
    }
    let lockBtn = ''; let banBtn = '';
    if (uid !== currentUid) {
      lockBtn = `<button class="icon-btn" onclick="startPrivateChat('${uid}', '${escapeHtml(username)}')" title="Ιδιωτικό" style="margin-left:auto;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></button>`;
      if (isAdmin) { banBtn = `<button class="icon-btn" onclick="banUser('${escapeHtml(username)}')" title="Ban" style="color:var(--danger);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg></button>`; }
    }
    div.innerHTML = `${avatarHtml}<div class="user-info"><div class="user-name">${escapeHtml(username)}${adminBadge}</div><div class="user-status">Online</div></div>${lockBtn}${banBtn}`;
    list.appendChild(div);
  });
  document.getElementById('onlineNum').textContent = usersArray.length;
  document.getElementById('userNum').textContent = usersArray.length;
}

function triggerAvatarUpload(uid) { if (isAvatarUploading) { showCustomToast('Περιμένετε', 'Γίνεται ήδη ανέβασμα.', true); return; } if (uid === currentUid) document.getElementById('avatarInput').click(); }
function triggerImageUpload() { document.getElementById('imageUploadInput').click(); }

async function startPrivateChat(uid, username) { 
  if (uid === currentUid) return; 
  if (!onlineUsers[uid]) { showCustomToast('Σφάλμα', 'Ο χρήστης δεν είναι online!', true); return; } 
  currentPrivateChat = uid; 
  currentPrivateChatName = username;
  
  if (unreadPrivateMessages[uid]) {
    delete unreadPrivateMessages[uid];
    updateUserList();
  }
  
  document.getElementById('chatMain').classList.add('private-mode'); 
  document.getElementById('privateHeader').classList.add('show'); document.getElementById('mainHeader').style.display = 'none'; 
  document.getElementById('privateWithUser').textContent = username; document.getElementById('msgInput').placeholder = 'Γράψε ιδιωτικό μήνυμα...'; 
  document.getElementById('emojiPanel').classList.remove('show'); 
  if (window.innerWidth <= 768) closeSidebar(); loadPrivateMessages(uid, username); 
}
function closePrivateChat() { 
  currentPrivateChat = null; currentPrivateChatName = null; document.getElementById('chatMain').classList.remove('private-mode'); 
  document.getElementById('privateHeader').classList.remove('show'); document.getElementById('mainHeader').style.display = 'flex'; 
  document.getElementById('msgInput').placeholder = 'Γράψε ένα μήνυμα...'; loadMessages(); 
}

async function handleImageUpload(event) {
  const file = event.target.files[0]; if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) { showCustomToast('Σφάλμα', 'Μόνο JPG, PNG, GIF!', true); event.target.value = ''; return; }
  if (file.size > 20 * 1024 * 1024) { showCustomToast('Σφάλμα', 'Μέγιστο μέγεθος 20MB!', true); event.target.value = ''; return; }
  const imageBtn = document.getElementById('imageBtn'); const originalHTML = imageBtn.innerHTML;
  imageBtn.innerHTML = '<div class="avatar-spinner" style="width:22px;height:22px;border-width:2px;"></div>'; imageBtn.classList.add('loading');
  try {
    const uploadResult = await uploadToImgur(file); const imageUrl = uploadResult.link; const deletehash = uploadResult.deletehash; const timestamp = Date.now();
    if (currentPrivateChat) {
      const chatId = [currentUid, currentPrivateChat].sort().join('_');
      db.ref('private_messages/' + chatId).push({ senderUid: currentUid, senderName: currentUser, receiverUid: currentPrivateChat, receiverName: currentPrivateChatName, message: '[📸 Εικόνα]', image: imageUrl, imageDeletehash: deletehash, timestamp: timestamp });
    } else {
      db.ref('messages').push({ userId: currentUid, userName: currentUser, text: '[📸 Εικόνα]', image: imageUrl, imageDeletehash: deletehash, timestamp: timestamp });
    }
  } catch(e) { showCustomToast('Σφάλμα', e.message, true); } 
  finally { imageBtn.innerHTML = originalHTML; imageBtn.classList.remove('loading'); event.target.value = ''; }
}

function showToast(senderName, senderUid) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-icon">💬</div>
    <div class="toast-content">
      <div class="toast-title">Νέο Ιδιωτικό Μήνυμα</div>
      <div class="toast-message">Από: ${escapeHtml(senderName)}</div>
    </div>
  `;
  toast.onclick = function() {
    startPrivateChat(senderUid, senderName);
    if (toast.parentNode === container) container.removeChild(toast);
  };
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentNode === container) container.removeChild(toast); }, 10000);
}

function subscribeToMessages() {
  db.ref('messages').off();
  db.ref('private_messages').off();
  privateChatListeners = {};

  db.ref('messages').on('child_added', (snap) => {
    const msg = snap.val(); msg._id = snap.key;
    if (!currentPrivateChat) { 
      addMessageToUI(msg, false); 
      if (msg.userId !== currentUid && msg.timestamp > connectTime) { playNotificationSound(); } 
    }
  });
  
  db.ref('messages').on('child_removed', (snap) => {
    const removedId = snap.key; 
    if (!currentPrivateChat) { 
      const msgDiv = document.querySelector(`.msg[data-msg-id="${removedId}"]`); 
      if (msgDiv) msgDiv.remove(); 
    }
  });

  db.ref('private_messages').on('child_added', (chatSnap) => {
    const chatId = chatSnap.key; 
    if (!chatId.includes(currentUid)) return;
    
    if (privateChatListeners[chatId]) return;
    privateChatListeners[chatId] = true;
    
    const chatRef = db.ref('private_messages/' + chatId);
    
    chatRef.on('child_added', (msgSnap) => {
      const msg = msgSnap.val(); msg._id = msgSnap.key;
      const isForMe = msg.receiverUid === currentUid;
      const isFromMe = msg.senderUid === currentUid;
      
      if (isForMe && !(currentPrivateChat && currentPrivateChat === msg.senderUid)) {
        if (msg.timestamp > connectTime) {
          showPrivateMessageNotification(msg.senderName, msg.senderUid);
        }
        if (!msg.is_read) msgSnap.ref.update({ is_read: true });
      }
      if (currentPrivateChat && (isForMe || isFromMe)) { 
        const currentChatId = [currentUid, currentPrivateChat].sort().join('_'); 
        if (chatId === currentChatId) { 
          addMessageToUI(msg, true); 
          if (isForMe && !msg.is_read) msgSnap.ref.update({ is_read: true }); 
        } 
      }
    });
    
    chatRef.on('child_removed', (snap) => {
      const removedId = snap.key; 
      const msgDiv = document.querySelector(`.msg[data-msg-id="${removedId}"]`); 
      if (msgDiv) msgDiv.remove();
    });
  });
}

function setupPresenceInitial() { 
  db.ref('users').on('value', (snap) => { 
    onlineUsers = {}; snap.forEach(child => { 
      const user = child.val(); 
      if (user.uid && user.username) { 
        onlineUsers[user.uid] = { username: user.username, avatar: user.avatar || null }; 
        if (user.avatar) { userAvatars[user.uid] = user.avatar; localStorage.setItem('user_avatar_' + user.uid, user.avatar); } 
      } 
    }); updateUserList(); 
  }); 
}

async function registerUser() {
  const username = document.getElementById('userIn').value.trim(); 
  const password = document.getElementById('passIn').value.trim();
  const err = document.getElementById('err'); 
  err.style.display = 'none';
  
  if (!username || !password) { err.textContent = '️ Συμπλήρωσε όνομα και κωδικό!'; err.style.display = 'block'; return; }
  if (username.includes(":")) { err.textContent = '⚠️ Το όνομα δεν μπορεί να περιέχει ":"'; err.style.display = 'block'; return; }
  if (password.length < 3) { err.textContent = '️ Ο κωδικός πρέπει να είναι τουλάχιστον 3 χαρακτήρες!'; err.style.display = 'block'; return; }
  
  const isBanned = await checkIfBanned(username);
  if (isBanned) { err.textContent = ' Αυτό το όνομα είναι banned!'; err.style.display = 'block'; return; }
  
  const lowerUsername = username.toLowerCase();
  const usersSnap = await db.ref('registered_users').orderByChild('username').equalTo(lowerUsername).once('value');
  if (usersSnap.exists()) { err.textContent = '❌ Αυτό το όνομα είναι ήδη κατοχυρωμένο!'; err.style.display = 'block'; return; }

  const newUid = 'uid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  await db.ref('registered_users/' + newUid).set({ username: username, password: password, avatar: null, created_at: Date.now() });
  
  localStorage.setItem('chat_uid', newUid);
  localStorage.setItem('chat_username', username); 
  localStorage.setItem('chat_password', password);
  
  showCustomToast('Επιτυχία', 'Ο λογαριασμός δημιουργήθηκε.');
  setTimeout(() => window.location.reload(), 1500);
}

async function goChat(isAutoLogin = false) { 
  const username = document.getElementById('userIn').value.trim(); 
  const password = document.getElementById('passIn').value.trim();
  const err = document.getElementById('err'); 
  err.style.display = 'none'; 
  
  if (!username || !password) { 
    err.textContent = '⚠️ Συμπλήρωσε όνομα και κωδικό!'; err.style.display = 'block'; return; 
  }
  
  const isBanned = await checkIfBanned(username);
  if (isBanned) { 
    err.textContent = '🚫 Αυτό το όνομα είναι banned!'; err.style.display = 'block'; 
    if (isAutoLogin) { localStorage.removeItem('chat_username'); localStorage.removeItem('chat_password'); localStorage.removeItem('chat_uid'); } 
    return; 
  }
  
  if (username.toLowerCase() === "sakis" && password !== "019630") { 
    if (isAutoLogin) { localStorage.removeItem('chat_username'); localStorage.removeItem('chat_password'); localStorage.removeItem('chat_uid'); } 
    else { err.textContent = 'Λάθος κωδικός!'; err.style.display = 'block'; } 
    return; 
  }
  
  const lowerUsername = username.toLowerCase();
  const regSnap = await db.ref('registered_users').orderByChild('username').equalTo(lowerUsername).once('value');
  
  if (!regSnap.exists() && username.toLowerCase() !== "sakis") {
    err.textContent = '❌ Δεν υπάρχει λογαριασμός. Κάνε εγγραφή!'; err.style.display = 'block';
    if (isAutoLogin) { localStorage.removeItem('chat_username'); localStorage.removeItem('chat_password'); localStorage.removeItem('chat_uid'); } 
    return;
  }
  
  let targetUid = null; let regData = null;
  regSnap.forEach(child => { targetUid = child.key; regData = child.val(); });

  if (username.toLowerCase() !== "sakis" && regData.password !== password) { 
    err.textContent = '❌ Λάθος κωδικός!'; err.style.display = 'block'; 
    if (isAutoLogin) { localStorage.removeItem('chat_username'); localStorage.removeItem('chat_password'); localStorage.removeItem('chat_uid'); } 
    return; 
  }
  
  try { 
    const sessionSnap = await db.ref('active_sessions/' + targetUid).once('value');
    if (sessionSnap.exists()) {
      const existingSession = sessionSnap.val();
      if (existingSession.session_id !== currentSessionId) {
        err.textContent = '️ Ο λογαριασμός είναι ήδη συνδεδεμένος σε άλλη συσκευή!'; 
        err.style.display = 'block'; 
        if (isAutoLogin) { 
          localStorage.removeItem('chat_username'); 
          localStorage.removeItem('chat_password'); 
          localStorage.removeItem('chat_uid'); 
        } 
        return;
      }
    }
    
    await db.ref('active_sessions/' + targetUid).remove();
    await db.ref('active_sessions/' + targetUid).set({ session_id: currentSessionId, timestamp: Date.now() }); 
    
    localStorage.setItem('chat_uid', targetUid);
    localStorage.setItem('chat_username', username); 
    localStorage.setItem('chat_password', password);
    await enterChat(username, targetUid);
  } catch(e) { 
    err.textContent = 'Σφάλμα: ' + e.message; err.style.display = 'block'; 
  } 
}

async function enterChat(username, uid) {
  currentUser = username; currentUid = uid; connectTime = Date.now();
  
  if (currentUser.toLowerCase() === "sakis") { 
    isAdmin = true; 
    document.getElementById('adminClearBtn').classList.add('show');
    document.getElementById('bannedBtn').classList.add('show'); 
    document.getElementById('clearBtn').classList.add('show'); 
  } else { 
    isAdmin = false; 
    document.getElementById('adminClearBtn').classList.remove('show');
    document.getElementById('clearBtn').classList.remove('show'); 
    document.getElementById('bannedBtn').classList.remove('show');
  } 
  
  const regSnap = await db.ref('registered_users/' + currentUid).once('value');
  const regData = regSnap.val();
  let avatarUrl = null;
  
  if (regData && regData.avatar) {
    avatarUrl = regData.avatar;
    userAvatars[currentUid] = avatarUrl;
    localStorage.setItem('user_avatar_' + currentUid, avatarUrl);
  } else {
    avatarUrl = localStorage.getItem('user_avatar_' + currentUid);
    if (avatarUrl) userAvatars[currentUid] = avatarUrl;
  }
  
  const trackData = { uid: currentUid, username: currentUser }; 
  if (avatarUrl) trackData.avatar = avatarUrl; 
  
  await db.ref('users/' + currentUid).set(trackData);
  db.ref('users/' + currentUid).onDisconnect().remove();
  
  document.getElementById('loginDiv').style.display = 'none'; document.getElementById('chatApp').style.display = 'flex'; 
  document.getElementById('msgInput').focus(); 
  await loadMessages(); subscribeToMessages(); subscribeToBans(); setupPresenceInitial();
}

async function adminClearAll() { 
  if (!isAdmin) return; 
  if (!confirm("️ Διαγραφή ΟΛΩΝ των λογαριασμών ΕΚΤΟΣ από εσένα (sakis);\n\nΘα χαθούν ονόματα, κωδικοί, φωτογραφίες.\n\nΕσύ θα παραμείνεις!")) return; 
  try { 
    const regSnap = await db.ref('registered_users').once('value'); const updates = {};
    regSnap.forEach(child => { const uid = child.key; if (child.val().username.toLowerCase() !== 'sakis') { updates['registered_users/' + uid] = null; } });
    
    const sessionsSnap = await db.ref('active_sessions').once('value');
    sessionsSnap.forEach(child => { 
      if (child.val().session_id !== currentSessionId) {
        updates['active_sessions/' + child.key] = null; 
      }
    });
    
    const usersSnap = await db.ref('users').once('value');
    usersSnap.forEach(child => { if (child.val().username.toLowerCase() !== 'sakis') { updates['users/' + child.key] = null; } });
    
    await db.ref().update(updates); 
    ensureAdminOnline();
    showCustomToast('Επιτυχία', 'Ο καθαρισμός ολοκληρώθηκε!');
  } catch(e) { 
    showCustomToast('Σφάλμα', e.message, true); 
  } 
}

async function logoutChat() { 
  if (!confirm("️ Προσοχή! Αν αποσυνδεθείτε, το όνομά σας αποδεσμεύεται. Θέλετε σίγουρα να αποσυνδεθείτε;")) return; 
  document.getElementById('playerIframe').src = ''; 
  document.getElementById('playerPanel').classList.remove('show'); 
  isPlayerOpen = false; 
  closeTvLiveWindow();
  
  try { 
    await db.ref('active_sessions/' + currentUid).remove(); 
    await db.ref('users/' + currentUid).remove();
    localStorage.removeItem('chat_uid'); localStorage.removeItem('chat_username'); localStorage.removeItem('chat_password');
    currentUser = ''; currentUid = ''; 
    document.getElementById('chatApp').style.display = 'none'; 
    document.getElementById('loginDiv').style.display = 'flex'; 
    document.getElementById('userIn').value = ''; document.getElementById('passIn').value = '';
  } catch(e) { 
    console.error('Logout error:', e); showCustomToast('Σφάλμα', e.message, true); 
  } 
}

function showClearConfirmation() { if (!isAdmin) return; document.getElementById('clearConfirmationOverlay').classList.add('show'); }
function hideClearConfirmation() { document.getElementById('clearConfirmationOverlay').classList.remove('show'); }

async function confirmClearMessages() { 
  if (!isAdmin) return; hideClearConfirmation(); 
  try { 
    await db.ref('messages').remove(); 
    ensureAdminOnline();
    showCustomToast('Επιτυχία', 'Τα μηνύματα διαγράφηκαν.');
  } catch(e) { 
    showCustomToast('Σφάλμα', e.message, true); 
  } 
}

function openImagePreview(imgSrc) { 
  const overlay = document.getElementById('imagePreviewOverlay'); 
  const img = document.getElementById('imagePreviewImg'); 
  img.src = imgSrc; overlay.classList.add('show'); 
}
function closeImagePreview(event) { 
  if (event.target.id === 'imagePreviewOverlay' || event.target.closest('.image-preview-close')) { 
    document.getElementById('imagePreviewOverlay').classList.remove('show'); 
  } 
}
document.addEventListener('keydown', function(e) { 
  if (e.key === 'Escape') { 
    document.getElementById('imagePreviewOverlay').classList.remove('show'); 
    if (isTvLiveOpen) closeTvLiveWindow(); 
  } 
});
document.getElementById('userIn').addEventListener('keypress', e => { if (e.key === 'Enter') document.getElementById('passIn').focus(); });
document.getElementById('passIn').addEventListener('keypress', e => { if (e.key === 'Enter') goChat(); });
document.getElementById('msgInput').addEventListener('keypress', e => { if (e.key === 'Enter') sendMsg(); });

window.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'RADIO_TITLE_UPDATE') {
    const titleText = event.data.title || 'Radio Synnefa Live';
    const titleEl = document.getElementById('radioNowPlayingText');
    if (titleEl) {
      const textarea = document.createElement('textarea'); textarea.innerHTML = titleText; const decodedText = textarea.value;
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
    showCustomToast('Σφάλμα', 'Δεν ήταν δυνατή η πρόσβαση στο μικρόφωνο.', true);
    console.error('Mic error:', err);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    clearInterval(recordingInterval);
    if (mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach(track => { track.stop(); track.enabled = false; });
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
  const sendBtn = document.querySelector('#audioPreviewOverlay .btn-primary');
  const originalText = sendBtn.textContent;
  sendBtn.textContent = ' Αποστολή...'; sendBtn.disabled = true;
  try {
    const formData = new FormData();
    formData.append('file', currentAudioBlob, 'recording.webm');
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, { method: 'POST', body: formData });
    const data = await response.json();
    if (data.secure_url) {
      const audioUrl = data.secure_url; const timestamp = Date.now();
      if (currentPrivateChat) {
        const chatId = [currentUid, currentPrivateChat].sort().join('_');
        await db.ref('private_messages/' + chatId).push({ senderUid: currentUid, senderName: currentUser, receiverUid: currentPrivateChat, receiverName: currentPrivateChatName, message: '[🎙️ Ηχητικό Μήνυμα]', audioUrl: audioUrl, timestamp: timestamp });
      } else {
        await db.ref('messages').push({ userId: currentUid, userName: currentUser, text: '[🎙️ Ηχητικό Μήνυμα]', audioUrl: audioUrl, timestamp: timestamp });
      }
      cancelRecording();
      showCustomToast('Επιτυχία', 'Το ηχητικό μήνυμα εστάλη.');
    } else { throw new Error('Αποτυχία μεταφόρτωσης'); }
  } catch (err) { showCustomToast('Σφάλμα', err.message, true); } 
  finally { sendBtn.textContent = originalText; sendBtn.disabled = false; }
}

document.addEventListener('DOMContentLoaded', function() {
  const passIn = document.getElementById('passIn');
  const passHint = document.getElementById('passHint');
  if (passIn && passHint) {
    passIn.addEventListener('focus', () => { passHint.style.display = 'block'; });
    passIn.addEventListener('blur', () => { setTimeout(() => { passHint.style.display = 'none'; }, 250); });
  }
});