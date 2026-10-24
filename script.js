// Venue Data Model with Zones and Pricing Categories
const venueData = [
    {
        id: "vip",
        name: "VIP Orchestra",
        price: 120.00,
        rows: 3,
        seatsPerRow: 8,
        unavailableSeats: ["vip-1-3", "vip-2-7"]
    },
    {
        id: "balcony",
        name: "Grand Balcony",
        price: 75.00,
        rows: 4,
        seatsPerRow: 10,
        unavailableSeats: ["balcony-0-0", "balcony-2-4", "balcony-3-9"]
    },
    {
        id: "standard",
        name: "Standard Stalls",
        price: 45.00,
        rows: 4,
        seatsPerRow: 12,
        unavailableSeats: ["standard-1-5", "standard-1-6", "standard-3-2"]
    }
];

// Application State
let seatsState = {}; // Key: seatId -> Status ('available', 'inspected', 'in-cart', 'unavailable')
let cart = [];       // Array of seatIds
let currentlyInspectedSeatId = null;

// Map Viewport / Pan & Zoom State
let scale = 1;
let panX = 50;
let panY = 50;
let isDragging = false;
let startX, startY;

// DOM Elements
const venueMap = document.getElementById('venue-map');
const sectionsContainer = document.getElementById('sections-container');
const inspectionDetails = document.getElementById('inspection-details');
const addToCartBtn = document.getElementById('add-to-cart-btn');
const cartItemsList = document.getElementById('cart-items-list');
const cartTotal = document.getElementById('cart-total');
const checkoutBtn = document.getElementById('checkout-btn');
const viewport = document.getElementById('map-viewport');

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initVenueModel();
    loadFromLocalStorage();
    renderVenueMap();
    updateMapTransform();
    setupEventListeners();
    setupPanAndZoomBonus();
});

// 1. Initialize data model & seat states
function initVenueModel() {
    venueData.forEach(section => {
        for (let r = 0; r < section.rows; r++) {
            for (let s = 0; s < section.seatsPerRow; s++) {
                const seatId = `${section.id}-${r}-${s}`;
                if (section.unavailableSeats.includes(seatId)) {
                    seatsState[seatId] = 'unavailable';
                } else {
                    seatsState[seatId] = 'available';
                }
            }
        }
    });
}

// 2. Generate repeated seats from JavaScript data
function renderVenueMap() {
    sectionsContainer.innerHTML = '';
    
    venueData.forEach(section => {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'venue-section';
        
        const titleEl = document.createElement('div');
        titleEl.className = 'section-title';
        titleEl.textContent = `${section.name} — $${section.price.toFixed(2)}`;
        sectionEl.appendChild(titleEl);

        const gridEl = document.createElement('div');
        gridEl.className = 'seat-grid';
        gridEl.style.gridTemplateColumns = `repeat(${section.seatsPerRow}, 32px)`;

        for (let r = 0; r < section.rows; r++) {
            for (let s = 0; s < section.seatsPerRow; s++) {
                const seatId = `${section.id}-${r}-${s}`;
                const seatBtn = document.createElement('button');
                seatBtn.className = `seat ${seatsState[seatId]}`;
                seatBtn.dataset.seatId = seatId;
                seatBtn.textContent = `${r+1}-${s+1}`;
                
                // Seat Click Handler (Inspection first)
                seatBtn.addEventListener('click', () => handleSeatClick(seatId, section));
                gridEl.appendChild(seatBtn);
            }
        }
        sectionEl.appendChild(gridEl);
        sectionsContainer.appendChild(sectionEl);
    });
}

// 3. Handle Seat Click & Inspection
function handleSeatClick(seatId, section) {
    const status = seatsState[seatId];

    if (status === 'unavailable') {
        alert("This seat is unavailable and cannot be selected.");
        return;
    }

    if (currentlyInspectedSeatId && seatsState[currentlyInspectedSeatId] === 'inspected') {
        seatsState[currentlyInspectedSeatId] = 'available';
    }

    currentlyInspectedSeatId = seatId;

    if (status === 'available') {
        seatsState[seatId] = 'inspected';
    }

    renderVenueMap();
    displaySeatInspection(seatId, section);
    addToCartBtn.disabled = (seatsState[seatId] === 'in-cart');
}

function displaySeatInspection(seatId, section) {
    const [_, r, s] = seatId.split('-');
    inspectionDetails.innerHTML = `
        <div class="detail-row"><span class="detail-label">Section:</span> <span>${section.name}</span></div>
        <div class="detail-row"><span class="detail-label">Seat:</span> <span>Row ${parseInt(r)+1}, Seat ${parseInt(s)+1}</span></div>
        <div class="detail-row"><span class="detail-label">Price:</span> <span>$${section.price.toFixed(2)}</span></div>
        <div class="detail-row"><span class="detail-label">Status:</span> <span style="text-transform: capitalize; font-weight:600; color:var(--inspected);">${seatsState[seatId]}</span></div>
    `;
    addToCartBtn.disabled = seatsState[seatId] === 'in-cart';
}

// 4. Add to Cart Logic & Duplicate Prevention
addToCartBtn.addEventListener('click', () => {
    if (!currentlyInspectedSeatId) return;

    if (cart.includes(currentlyInspectedSeatId)) {
        alert("This seat is already in your cart.");
        return;
    }

    cart.push(currentlyInspectedSeatId);
    seatsState[currentlyInspectedSeatId] = 'in-cart';

    renderVenueMap();
    updateCartUI();
    saveToLocalStorage();

    addToCartBtn.disabled = true;
});

// 5. Cart UI & Removal (Map Synchronization)
function updateCartUI() {
    cartItemsList.innerHTML = '';

    if (cart.length === 0) {
        cartItemsList.innerHTML = `<li class="empty-cart">Your cart is empty.</li>`;
        cartTotal.textContent = '$0.00';
        checkoutBtn.disabled = true;
        return;
    }

    let total = 0;
    cart.forEach(seatId => {
        const { section, row, seatNum, price } = parseSeatId(seatId);
        total += price;

        const li = document.createElement('li');
        li.className = 'cart-item';
        li.innerHTML = `
            <div>
                <strong>${section.name}</strong><br>
                <small>Row ${row}, Seat ${seatNum} — $${price.toFixed(2)}</small>
            </div>
            <button class="remove-btn" onclick="removeSeatFromCart('${seatId}')" title="Remove">×</button>
        `;
        cartItemsList.appendChild(li);
    });

    cartTotal.textContent = `$${total.toFixed(2)}`;
    checkoutBtn.disabled = false;
}

window.removeSeatFromCart = function(seatId) {
    cart = cart.filter(id => id !== seatId);
    seatsState[seatId] = 'available';

    if (currentlyInspectedSeatId === seatId) {
        currentlyInspectedSeatId = null;
        inspectionDetails.innerHTML = `<p class="placeholder-text">Click any seat on the map to inspect its details and price.</p>`;
        addToCartBtn.disabled = true;
    }

    renderVenueMap();
    updateCartUI();
    saveToLocalStorage();
};

function parseSeatId(seatId) {
    const parts = seatId.split('-');
    const secId = parts[0];
    const row = parseInt(parts[1]) + 1;
    const seatNum = parseInt(parts[2]) + 1;
    const section = venueData.find(sec => sec.id === secId);
    return { section, row, seatNum, price: section.price };
}

// 6. Map Navigation Controls (Zoom & Pan buttons)
document.getElementById('zoom-in').addEventListener('click', () => {
    scale = Math.min(scale + 0.15, 2.0);
    updateMapTransform();
});
document.getElementById('zoom-out').addEventListener('click', () => {
    scale = Math.max(scale - 0.15, 0.6);
    updateMapTransform();
});
document.getElementById('move-up').addEventListener('click', () => { panY += 40; updateMapTransform(); });
document.getElementById('move-down').addEventListener('click', () => { panY -= 40; updateMapTransform(); });
document.getElementById('move-left').addEventListener('click', () => { panX += 40; updateMapTransform(); });
document.getElementById('move-right').addEventListener('click', () => { panX -= 40; updateMapTransform(); });
document.getElementById('reset-view').addEventListener('click', () => {
    scale = 1;
    panX = 50;
    panY = 50;
    updateMapTransform();
});

function updateMapTransform() {
    venueMap.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
}

// 7. Bonus 10% - Mouse Wheel Zoom & Click/Drag Panning
function setupPanAndZoomBonus() {
    viewport.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        updateMapTransform();
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomIntensity = 0.1;
        if (e.deltaY < 0) {
            scale = Math.min(scale + zoomIntensity, 2.5);
        } else {
            scale = Math.max(scale - zoomIntensity, 0.5);
        }
        updateMapTransform();
    }, { passive: false });
}

// 8. LocalStorage Persistence
function saveToLocalStorage() {
    const stateToSave = {
        cart: cart,
        seatsState: seatsState
    };
    localStorage.setItem('wm1_ticketing_state', JSON.stringify(stateToSave));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('wm1_ticketing_state');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            cart = data.cart || [];
            if (data.seatsState) {
                Object.keys(data.seatsState).forEach(id => {
                    seatsState[id] = data.seatsState[id];
                });
            }
            updateCartUI();
        } catch (e) {
            console.error("Failed to load from localStorage", e);
        }
    }
}