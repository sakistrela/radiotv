self.addEventListener('fetch', (event) => {
    // Ελέγχει αν το αίτημα αφορά HTML αρχείο (είτε είναι η αρχική είτε το iframe)
    if (event.request.headers.get('accept').includes('text/html') || event.request.url.endsWith('.html')) {
        event.respondWith(
            new Response(
                "<!DOCTYPE html><html><body><h1>FATAL ERROR: Source Protection Active</h1></body></html>", 
                {
                    headers: { 'Content-Type': 'text/html' }
                }
            )
        );
    }
});