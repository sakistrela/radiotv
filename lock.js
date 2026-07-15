// lock.js
document.addEventListener("contextmenu", function (e) {
  e.preventDefault(); // Κλείδωμα δεξιού κλικ
});

document.addEventListener("keydown", function (e) {
  // Ctrl+U, Ctrl+S, F12, Ctrl+Shift+I
  if (
    e.ctrlKey && (e.key === 'u' || e.key === 's') ||
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i'))
  ) {
    e.preventDefault();
  }
});
