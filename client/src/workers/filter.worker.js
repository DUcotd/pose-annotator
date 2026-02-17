// filter.worker.js
self.onmessage = function (e) {
    const { images, query } = e.data;
    if (!query) {
        self.postMessage(images);
        return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = images.filter(img => {
        const name = typeof img === 'string' ? img : img.name;
        return name.toLowerCase().includes(lowerQuery);
    });

    self.postMessage(filtered);
};
