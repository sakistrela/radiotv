const streamURL = "https://video.gumlet.io/67840918b15221f868e06399/68458ec90f8d7a051853957b/main.m3u8";
const video = document.getElementById("videoPlayer");
const overlay = document.getElementById("overlayPlay");

if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(streamURL);
    hls.attachMedia(video);
} else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = streamURL;
}

// Με ένα κλικ ξεκινάει και φεύγουν όλα τα ενοχλητικά
overlay.addEventListener("click", () => {
    video.play();
    video.controls = true; // Εμφανίζει τα controls μόνο αφού πατήσεις play
    overlay.classList.add("hidden");
});