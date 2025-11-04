// NASA APOD gallery script
// NASA API base URL (ensure present even if other edits removed it)
const NASA_APOD_URL = 'https://api.nasa.gov/planetary/apod';
// Use a local static dataset for demos to avoid network rate limits and to include
// the provided curated entries. This file was added at `data/apod.json`.
const apodData = './data/apod.json';

// DOM elements
const getImageBtn = document.getElementById('getImageBtn');
const gallery = document.getElementById('gallery');
const loading = document.getElementById('loading');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const apiKeyInput = document.getElementById('apiKey');
const didYouKnowEl = document.getElementById('didYouKnow');

// Modal elements (modal contains a media container we populate with <img> or <iframe>)
const modal = document.getElementById('modal');
const modalMedia = document.getElementById('modalMedia');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');
const modalClose = document.getElementById('modalClose');

// Small set of fun facts (could be extended)
const facts = [
	"The Moon is moving away from Earth about 1.5 inches (3.8 cm) every year.",
	"Venus rotates in the opposite direction to most planets — its day is longer than its year.",
	"A day on Mars is only about 37 minutes longer than a day on Earth.",
	"Jupiter's Great Red Spot is a storm larger than Earth that's been raging for centuries.",
	"Saturn's rings are made mostly of water ice, with some rocky material and dust."
];

// Helpers
function formatDate(d) {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

function addDays(d, days) {
	const nd = new Date(d);
	nd.setDate(nd.getDate() + days);
	return nd;
}

// Set default date range
document.addEventListener('DOMContentLoaded', () => {
	const today = new Date();
	const defaultStart = addDays(today, -8);
	const defaultEnd = new Date(today);
	
	startDateInput.value = formatDate(defaultStart);
	endDateInput.value = formatDate(defaultEnd);

	// show a random Did You Know fact on load
	const fact = facts[Math.floor(Math.random() * facts.length)];
	didYouKnowEl.textContent = `Did you know? ${fact}`;
});

// Show/hide loading
function showLoading(message = 'Loading images…') {
	loading.hidden = false;
	loading.textContent = message;
}
function hideLoading() {
	loading.hidden = true;
}

// Render helpers
function clearGallery() {
	gallery.innerHTML = '';
}

function createGalleryItem(item) {
	const div = document.createElement('div');
	div.className = 'gallery-item';

	// Create media container
	const mediaContainer = document.createElement('div');
	mediaContainer.className = 'gallery-item-media';

	// MEDIA: image or video thumbnail
	if (item.media_type === 'image') {
		const img = document.createElement('img');
		img.src = item.url || '';
		img.alt = item.title || 'NASA APOD';
		mediaContainer.appendChild(img);
	} else if (item.media_type === 'video') {
		// video: show thumbnail if available, otherwise a lightweight placeholder
		const thumb = document.createElement('div');
		thumb.className = 'video-thumb';
		const thumbImg = document.createElement('img');
		// Prefer explicit thumbnail_url. If missing and it's a YouTube link, generate the YouTube thumbnail.
		const getYouTubeId = (u) => {
			try {
				const url = new URL(u);
				if (url.hostname.includes('youtube.com')) return url.searchParams.get('v');
				if (url.hostname === 'youtu.be') return url.pathname.slice(1);
			} catch (e) {
				return null;
			}
			return null;
		};
		let thumbSrc = item.thumbnail_url || '';
		if (!thumbSrc && item.url) {
			const id = getYouTubeId(item.url);
			if (id) thumbSrc = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
		}
		thumbImg.src = thumbSrc || '';
		thumbImg.alt = item.title || 'Video thumbnail';
		thumb.appendChild(thumbImg);
		// overlay play icon
		const play = document.createElement('div');
		play.className = 'play-overlay';
		play.textContent = '▶';
		thumb.appendChild(play);
		mediaContainer.appendChild(thumb);
	} else {
		const unknown = document.createElement('p');
		unknown.textContent = 'Unsupported media type';
		mediaContainer.appendChild(unknown);
	}
	div.appendChild(mediaContainer);

	// Create header with title and toggle button
	const header = document.createElement('div');
	header.className = 'gallery-item-header';
	
	const title = document.createElement('h3');
	title.textContent = item.title || '';
	header.appendChild(title);

	const date = document.createElement('p');
	date.className = 'gallery-item-date';
	date.textContent = item.date;
	header.appendChild(date);

	const toggleBtn = document.createElement('button');
	toggleBtn.className = 'details-toggle';
	toggleBtn.innerHTML = '▼';
	toggleBtn.setAttribute('aria-label', 'Toggle details');
	header.appendChild(toggleBtn);
	
	div.appendChild(header);

	// Create collapsible details section
	const details = document.createElement('div');
	details.className = 'gallery-item-details';
	details.hidden = true;

	const explanation = document.createElement('p');
	explanation.className = 'gallery-item-explanation';
	explanation.textContent = item.explanation || '';
	details.appendChild(explanation);

	if (item.copyright) {
		const copyright = document.createElement('p');
		copyright.className = 'gallery-item-copyright';
		copyright.textContent = `© ${item.copyright}`;
		details.appendChild(copyright);
	}

	const viewFullBtn = document.createElement('button');
	viewFullBtn.className = 'view-full-btn';
	viewFullBtn.textContent = 'View Full Size';
	details.appendChild(viewFullBtn);

	div.appendChild(details);

	// Add event listeners
	toggleBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		details.hidden = !details.hidden;
		toggleBtn.innerHTML = details.hidden ? '▼' : '▲';
	});

	viewFullBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		openModal(item);
	});

	// Media container opens modal
	mediaContainer.addEventListener('click', () => openModal(item));

	return div;
}

function openModal(item) {
	if (!modal || !modalMedia) {
		// fallback: open media in a new tab
		const url = item.hdurl || item.url || '';
		if (url) window.open(url, '_blank');
		else alert(item.title || 'No preview available');
		return;
	}

	// clear previous media
	modalMedia.innerHTML = '';

	if (item.media_type === 'image') {
		const img = document.createElement('img');
		img.src = item.hdurl || item.url || '';
		img.alt = item.title || '';
		modalMedia.appendChild(img);
	} else if (item.media_type === 'video') {
		// If the URL looks like an embed (youtube), place an iframe
		const iframe = document.createElement('iframe');
		iframe.src = item.url;
		iframe.width = '100%';
		iframe.height = '480';
		iframe.frameBorder = '0';
		iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
		iframe.allowFullscreen = true;
		modalMedia.appendChild(iframe);
	} else {
		modalMedia.textContent = 'Preview not available for this media type.';
	}

	if (modalTitle) modalTitle.textContent = item.title || '';
	if (modalDate) modalDate.textContent = item.date || '';
	if (modalExplanation) modalExplanation.textContent = item.explanation || '';
	modal.hidden = false;
}

function closeModal() {
	if (modal) modal.hidden = true;
	if (modalMedia) modalMedia.innerHTML = '';
}

// Guard modal event attachments — modal markup may be missing
if (modalClose) {
	modalClose.addEventListener('click', closeModal);
}
if (modal) {
	modal.addEventListener('click', (e) => {
		if (e.target === modal) closeModal();
	});
}
window.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') closeModal();
});

// Fetch APOD data from NASA for a date range (inclusive).
// If apiKey is 'DEMO_KEY' we fetch a public static dataset (apodData) and filter by date range
async function fetchApodRange(startDateStr, endDateStr, apiKey) {
	// Always fetch the CDN JSON dataset and filter locally by date range
	const res = await fetch(apodData);
	if (!res.ok) throw new Error(`Failed to load dataset: ${res.status}`);
	const all = await res.json();
	const start = new Date(startDateStr + 'T00:00:00');
	const end = new Date(endDateStr + 'T23:59:59');
	const filtered = all.filter((it) => {
		const d = new Date(it.date + 'T12:00:00');
		return d >= start && d <= end;
	});
	filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
	return filtered;
}

// Main button handler
getImageBtn.addEventListener('click', async () => {
	const start = startDateInput.value;
	const end = endDateInput.value;
	
	if (!start || !end) {
		alert('Please choose both start and end dates');
		return;
	}

	const startDate = new Date(start + 'T00:00:00');
	const endDate = new Date(end + 'T00:00:00');
	
	if (startDate > endDate) {
		alert('Start date must be before or equal to end date');
		return;
	}

	const startStr = formatDate(startDate);
	const endStr = formatDate(endDate);

	const apiKey = apiKeyInput.value.trim() || 'DEMO_KEY';

		// show a loading message inside the gallery so users know images are on the way
		clearGallery();
		gallery.innerHTML = `<div class="placeholder"><p>🔄 Loading space photos…</p></div>`;
		showLoading('Loading APOD entries…');

	try {
		// fetch the CDN JSON (array of APOD-like objects) and filter locally
		const items = await fetchApodRange(startStr, endStr, apiKey);


		// Remove global loading indicator and clear the gallery placeholder before rendering
		hideLoading();
		clearGallery();

		if (!items || items.length === 0) {
			gallery.innerHTML = '<div class="placeholder"><p>No images found for the selected range.</p></div>';
			return;
		}

		// Build dynamic gallery with all available items
		items.forEach((it) => {
			gallery.appendChild(createGalleryItem(it));
		});
	} catch (err) {
		hideLoading();
		gallery.innerHTML = `<div class="placeholder"><p>Error loading data: ${err.message}</p></div>`;
		console.error(err);
	}
});