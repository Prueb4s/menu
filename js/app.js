

/* global supabase */
const { createClient } = supabase;

let SB_URL = null;
let SB_ANON_KEY = null;
let supabaseClient = null;

// Estado
let cart = [];
let products = [];
let currentImageIndex = 0;
let currentProduct = null;
let deferredPrompt = null;
let requireSizeSelection = false;
let orderDetails = {};

// DOM refs
const featuredContainer = document.getElementById('featured-grid');
const offersGrid = document.getElementById('offers-grid');
const allFilteredContainer = document.getElementById('all-filtered-products');
const featuredSection = document.getElementById('featured-section');
const offersSection = document.getElementById('offers-section');
const filteredSection = document.getElementById('filtered-section');
const noProductsMessage = document.getElementById('no-products-message');
const searchInput = document.getElementById('search-input');
const searchResultsTitle = document.getElementById('search-results-title');
const categoryCarousel = document.getElementById('category-carousel');
const productModal = document.getElementById('productModal');
const modalProductName = document.getElementById('modal-product-name');
const modalProductDescription = document.getElementById('modal-product-description');
const modalProductPrice = document.getElementById('modal-product-price');
const modalAddToCartBtn = document.getElementById('modal-add-to-cart-btn');
const qtyInput = document.getElementById('qty-input');
const sizeOptionsContainer = document.getElementById('size-options');
const carouselImagesContainer = document.getElementById('carousel-images-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const cartBtn = document.getElementById('cart-btn');
const cartBadge = document.getElementById('cart-badge');
const cartModal = document.getElementById('cartModal');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total');
const checkoutBtn = document.getElementById('checkout-btn');
const checkoutModal = document.getElementById('checkoutModal');
const customerNameInput = document.getElementById('customer-name');
const customerAddressInput = document.getElementById('customer-address');
const finalizeBtn = document.getElementById('finalize-btn');
const installBanner = document.getElementById('install-banner');
const installCloseBtn = document.getElementById('install-close-btn');
const installPromptBtn = document.getElementById('install-prompt-btn');
const orderSuccessModal = document.getElementById('orderSuccessModal');
const orderSuccessTotal = document.getElementById('order-success-total');
const whatsappBtn = document.getElementById('whatsapp-btn');
const closeSuccessBtn = document.getElementById('close-success-btn');
const termsConsentCheckbox = document.getElementById('terms-consent-checkbox');

// Helpers
const money = (v) => {
    const value = Math.floor(v);
    return value.toLocaleString('es-CO');
};
const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
};

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// Banner Carousel (sin cambios funcionales)
const bannerCarousel = document.getElementById('banner-carousel');
const bannerDots = document.getElementById('banner-dots');
if (bannerCarousel) {
    const slides = document.querySelectorAll('.banner-slide');
    if (slides.length > 0) {
        let currentBanner = 0;
        let bannerInterval;
        const firstSlideClone = slides[0].cloneNode(true);
        const lastSlideClone = slides[slides.length - 1].cloneNode(true);
        bannerCarousel.appendChild(firstSlideClone);
        bannerCarousel.insertBefore(lastSlideClone, slides[0]);
        currentBanner = 1;
        bannerCarousel.style.transform = `translateX(-${currentBanner * 100}%)`;
        slides.forEach((_, idx) => {
            const dot = document.createElement('div');
            dot.classList.add('banner-dot');
            if (idx === 0) dot.classList.add('active');
            dot.addEventListener('click', () => goToSlide(idx + 1));
            bannerDots.appendChild(dot);
        });

        function updateBanner() {
            bannerCarousel.style.transform = `translateX(-${currentBanner * 100}%)`;
            const dotIndex = (currentBanner - 1 + slides.length) % slides.length;
            document.querySelectorAll('.banner-dot').forEach((dot, idx) => {
                dot.classList.toggle('active', idx === dotIndex);
            });
        }

        function goToSlide(idx) {
            currentBanner = idx;
            updateBanner();
            resetInterval();
        }

        function nextBanner() {
            currentBanner++;
            updateBanner();
            if (currentBanner >= slides.length + 1) {
                setTimeout(() => {
                    bannerCarousel.style.transition = 'none';
                    currentBanner = 1;
                    bannerCarousel.style.transform = `translateX(-${currentBanner * 100}%)`;
                    setTimeout(() => {
                        bannerCarousel.style.transition = 'transform 0.5s ease';
                    }, 50);
                }, 500);
            }
        }

        function resetInterval() {
            clearInterval(bannerInterval);
            bannerInterval = setInterval(nextBanner, 4000);
        }

        let startX = 0;
        bannerCarousel.addEventListener('touchstart', e => {
            startX = e.touches[0].clientX;
        });
        bannerCarousel.addEventListener('touchend', e => {
            let endX = e.changedTouches[0].clientX;
            if (endX - startX > 50) {
                currentBanner = (currentBanner - 1);
                updateBanner();
                resetInterval();
            } else if (startX - endX > 50) {
                nextBanner();
                resetInterval();
            }
        });
        let isDown = false,
            startXMouse;
        bannerCarousel.addEventListener('mousedown', e => {
            isDown = true;
            startXMouse = e.pageX;
        });
        bannerCarousel.addEventListener('mouseup', e => {
            if (!isDown) return;
            let diff = e.pageX - startXMouse;
            if (diff > 50) {
                currentBanner = (currentBanner - 1);
                updateBanner();
            } else if (diff < -50) {
                nextBanner();
            }
            isDown = false;
            resetInterval();
        });
        resetInterval();
    }
}

// Size multipliers (cliente usa solo para mostrar mensajes/chequeos de consumo opcionales)
function sizeMultiplier(sizeName) {
    if (!sizeName) return 1.0;
    const s = String(sizeName).toLowerCase();
    if (s.includes('peque') || s.includes('small') || s === 'sm' || s === 's' || s.includes('chico')) return 1.0;
    if (s.includes('med') || s.includes('medio') || s.includes('medium') || s === 'md' || s === 'm') return 0.5;
    if (s.includes('grand') || s.includes('large') || s === 'lg' || s === 'g') return 0.25;
    return 1.0;
}

// Render tarjeta producto (muestra tamaños si existen; stock mostrado solo desde p.stock)
const generateProductCard = (p) => {
    let bestSellerTag = '';
    if (p.bestSeller) {
        bestSellerTag = `<div class="best-seller-tag">Lo más vendido</div>`;
    }

    let stockOverlay = '';
    let stockClass = '';
    const availableSizes = Array.isArray(p.sizes) ? p.sizes : [];
    const sizesLabels = availableSizes.length > 0 ? availableSizes.map(s => s.name).join(', ') : '';
    const totalStock = Number(p.stock || 0);

    if (totalStock <= 0) {
        stockOverlay = `<div class="out-of-stock-overlay">Agotado</div>`;
        stockClass = ' out-of-stock';
    }

    const descriptionText = p.description ? p.description : '';
    const sizesInfoHtml = sizesLabels ? `<div style="margin-top:6px;font-size:.85rem;color:#555;"><strong>tamaños:</strong> ${escapeHtml(sizesLabels)}</div>` : '';

    return `
      <div class="product-card${stockClass}" data-product-id="${p.id}">
        ${bestSellerTag}
        <div class="image-wrap">
          <img src="${p.image && p.image[0] ? p.image[0] : 'img/favicon.png'}" alt="${escapeHtml(p.name)}" class="product-image modal-trigger" data-id="${p.id}" loading="lazy" />
          <div class="image-hint" aria-hidden="true">
            <i class="fas fa-hand-point-up" aria-hidden="true"></i>
            <span>Presiona para ver</span>
          </div>
        </div>
        ${stockOverlay}
        <div class="product-info">
          <div>
            <div class="product-name">${escapeHtml(p.name)}</div>
            <div class="product-description">${escapeHtml(descriptionText)}</div>
            ${sizesInfoHtml}
          </div>
          <div style="margin-top:8px">
            <div class="product-price">$${money(p.price || (availableSizes[0] ? availableSizes[0].price : 0))}</div>
            <div style="font-size:.82rem;color:#777">Stock: ${totalStock}</div>
          </div>
        </div>
      </div>
    `;
};

function renderProducts(container, data, page = 1, perPage = 20, withPagination = false) {
    container.innerHTML = '';
    const paginationContainer = document.getElementById('pagination-container');
    if (!data || data.length === 0) {
        noProductsMessage.style.display = 'block';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }
    noProductsMessage.style.display = 'none';
    const totalPages = Math.ceil(data.length / perPage);
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const currentProducts = data.slice(start, end);
    currentProducts.forEach(p => container.innerHTML += generateProductCard(p));
    if (withPagination && totalPages > 1) {
        renderPagination(page, totalPages, data, perPage);
    } else {
        if (paginationContainer) paginationContainer.innerHTML = '';
    }
}

function renderPagination(currentPage, totalPages, data, perPage) {
    const paginationContainer = document.getElementById('pagination-container');
    paginationContainer.innerHTML = '';

    function createBtn(label, page, active = false) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.className = 'pagination-btn';
        if (active) btn.classList.add('active');
        btn.addEventListener('click', () => {
            renderProducts(allFilteredContainer, data, page, perPage, true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        return btn;
    }
    if (currentPage > 1) paginationContainer.appendChild(createBtn('Primera', 1));
    if (currentPage > 3) paginationContainer.appendChild(document.createTextNode('...'));
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) {
        paginationContainer.appendChild(createBtn(i, i, i === currentPage));
    }
    if (currentPage < totalPages - 2) paginationContainer.appendChild(document.createTextNode('...'));
    if (currentPage < totalPages) paginationContainer.appendChild(createBtn('Última', totalPages));
}

const generateCategoryCarousel = () => {
    categoryCarousel.innerHTML = '';
    const categories = Array.from(new Set(products.map(p => p.category))).map(c => ({ label: c }));
    const allItem = document.createElement('div');
    allItem.className = 'category-item';
    const allIconPath = 'img/icons/all.webp';
    allItem.innerHTML = `<img class="category-image" src="${allIconPath}" alt="Todo" data-category="__all"><span class="category-name">Todo</span>`;
    categoryCarousel.appendChild(allItem);
    categories.forEach(c => {
        const el = document.createElement('div');
        el.className = 'category-item';
        const fileName = `img/icons/${c.label.toLowerCase().replace(/\s+/g, '_')}.webp`;
        el.innerHTML = `<img class="category-image" src="${fileName}" alt="${c.label}" data-category="${c.label}"><span class="category-name">${c.label}</span>`;
        categoryCarousel.appendChild(el);
    });
};

searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
        showDefaultSections();
        return;
    }
    const filtered = products.filter(p => (p.name||'').toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q));
    filteredSection.style.display = 'block';
    featuredSection.style.display = 'none';
    offersSection.style.display = 'none';
    searchResultsTitle.textContent = `Resultados para "${q}"`;
    renderProducts(allFilteredContainer, filtered, 1, 20, true);
});

const showDefaultSections = () => {
    featuredSection.style.display = 'block';
    offersSection.style.display = 'block';
    filteredSection.style.display = 'none';
    const featured = shuffleArray(products.filter(p => p.featured)).slice(0, 25);
    const offers = shuffleArray(products.filter(p => p.isOffer)).slice(0, 25);
    renderProducts(featuredContainer, featured, 1, 25, false);
    renderProducts(offersGrid, offers, 1, 25, false);
};

categoryCarousel.addEventListener('click', (ev) => {
    const img = ev.target.closest('.category-image');
    if (!img) return;
    const cat = img.dataset.category;
    searchInput.value = '';
    if (cat === '__all') {
        showDefaultSections();
        return;
    }
    const filtered = products.filter(p => p.category && p.category.toLowerCase() === cat.toLowerCase());
    filteredSection.style.display = 'block';
    featuredSection.style.display = 'none';
    offersSection.style.display = 'none';
    searchResultsTitle.textContent = cat;
    renderProducts(allFilteredContainer, filtered, 1, 20, true);
});

(function makeCarouselDraggable() {
    let isDown = false,
        startX, scrollLeft;
    categoryCarousel.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - categoryCarousel.offsetLeft;
        scrollLeft = categoryCarousel.scrollLeft;
    });
    window.addEventListener('mouseup', () => {
        isDown = false;
    });
    categoryCarousel.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - categoryCarousel.offsetLeft;
        const walk = (x - startX) * 1.5;
        categoryCarousel.scrollLeft = scrollLeft - walk;
    });
    categoryCarousel.addEventListener('touchstart', (e) => {
        startX = e.touches[0].pageX - categoryCarousel.offsetLeft;
        scrollLeft = categoryCarousel.scrollLeft;
    });
    categoryCarousel.addEventListener('touchmove', (e) => {
        const x = e.touches[0].pageX - categoryCarousel.offsetLeft;
        const walk = (x - startX) * 1.2;
        categoryCarousel.scrollLeft = scrollLeft - walk;
    });
})();

document.addEventListener('click', (e) => {
    if (e.target.closest('.modal-trigger')) {
        const id = e.target.dataset.id;
        openProductModal(id);
    }
    if (e.target.id === 'modal-add-to-cart-btn') {
        const qty = Math.max(1, parseInt(qtyInput.value) || 1);
        const selectedSizeInput = sizeOptionsContainer ? sizeOptionsContainer.querySelector('input[name="size-option"]:checked') : null;
        if (requireSizeSelection && (!selectedSizeInput || !selectedSizeInput.value)) {
            alert('Selecciona un tamaño antes de añadir al carrito.');
            return;
        }
        const selectedSize = selectedSizeInput ? selectedSizeInput.value : null;
        addToCart(currentProduct.id, qty, selectedSize);
        closeModal(productModal);
    }
});

// Modales
function showModal(modal) {
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
}
function closeModal(modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}
[productModal, cartModal, checkoutModal, orderSuccessModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-close')) {
            closeModal(modal);
        }
    });
});
closeSuccessBtn.addEventListener('click', () => closeModal(orderSuccessModal));

function openProductModal(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    currentProduct = product;
    modalProductName.textContent = product.name;
    modalProductDescription.textContent = product.description || '';
    const availableSizes = Array.isArray(product.sizes) ? product.sizes : [];
    if (availableSizes.length > 0) {
        modalProductPrice.textContent = `$${money(availableSizes[0].price || 0)}`;
    } else {
        modalProductPrice.textContent = `$${money(product.price || 0)}`;
    }
    qtyInput.value = 1;
    modalAddToCartBtn.dataset.id = product.id;
    renderSizeOptions(availableSizes);
    updateCarousel(product.image || []);
    showModal(productModal);
}

function renderSizeOptions(sizes = []) {
    if (!sizeOptionsContainer) return;
    sizeOptionsContainer.innerHTML = '';
    if (!sizes || sizes.length === 0) {
        sizeOptionsContainer.innerHTML = `<div class="form-group"><small>Este producto no requiere selección de tamaño.</small></div>`;
        return;
    }
    const group = document.createElement('div');
    group.className = 'form-group';
    const label = document.createElement('label');
    label.textContent = requireSizeSelection ? 'Selecciona un tamaño (obligatorio)' : 'Selecciona un tamaño';
    group.appendChild(label);

    sizes.forEach((s, idx) => {
        const id = `size-opt-${idx}-${String(Math.random()).slice(2,8)}`;
        const wrapper = document.createElement('div');
        wrapper.style = 'display:flex;align-items:center;gap:8px;margin:6px 0;';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'size-option';
        radio.value = s.name;
        radio.id = id;
        radio.dataset.price = s.price;
        const text = document.createElement('label');
        text.htmlFor = id;
        text.style = 'font-size:.95rem';
        text.innerHTML = `${escapeHtml(s.name)} — $${money(s.price || 0)}`;
        wrapper.appendChild(radio);
        wrapper.appendChild(text);
        group.appendChild(wrapper);

        radio.addEventListener('change', () => {
            modalProductPrice.textContent = `$${money(Number(radio.dataset.price || 0))}`;
        });
    });

    sizeOptionsContainer.appendChild(group);
}

// Carousel modal
function updateCarousel(images) {
    carouselImagesContainer.innerHTML = '';
    if (!images || images.length === 0) {
        carouselImagesContainer.innerHTML = `<div class="carousel-image" style="display:flex;align-items:center;justify-content:center;background:#f3f3f3">Sin imagen</div>`;
        return;
    }
    images.forEach(src => {
        const img = document.createElement('img');
        img.src = src;
        img.className = 'carousel-image';
        carouselImagesContainer.appendChild(img);
    });
    currentImageIndex = 0;
    carouselImagesContainer.style.transform = `translateX(0)`;
}
prevBtn.addEventListener('click', () => { if (currentImageIndex > 0) currentImageIndex--; updateCarouselPosition(); });
nextBtn.addEventListener('click', () => { const imgs = carouselImagesContainer.querySelectorAll('.carousel-image'); if (currentImageIndex < imgs.length - 1) currentImageIndex++; updateCarouselPosition(); });
function updateCarouselPosition() {
    const imgs = carouselImagesContainer.querySelectorAll('.carousel-image');
    if (imgs.length === 0) return;
    const imgWidth = imgs[0].clientWidth || carouselImagesContainer.clientWidth;
    carouselImagesContainer.style.transform = `translateX(-${currentImageIndex * imgWidth}px)`;
}
window.addEventListener('resize', updateCarouselPosition);

// Cart UI
function updateCart() {
    cartItemsContainer.innerHTML = '';
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Tu carrito está vacío.</p>';
        cartBadge.style.display = 'none';
        cartBadge.textContent = '0';
        cartTotalElement.textContent = money(0);
        return;
    }
    let total = 0, totalItems = 0;
    cart.forEach((item, idx) => {
        total += item.price * item.qty;
        totalItems += item.qty;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `<div style="display:flex;align-items:center;gap:8px;">
            <img src="${item.image}" alt="${escapeHtml(item.name)}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">
            <div>
              <div style="font-weight:700">${escapeHtml(item.name)}</div>
              <div style="font-size:.9rem;color:#666">${escapeHtml(item.size || '')}</div>
              <div style="font-size:.9rem;color:#333">$${money(item.price)} x ${item.qty}</div>
            </div>
          </div>
          <div class="controls">
            <button class="qty-btn" data-idx="${idx}" data-op="dec">-</button>
            <span style="min-width:28px;text-align:center;display:inline-block">${item.qty}</span>
            <button class="qty-btn" data-idx="${idx}" data-op="inc">+</button>
          </div>`;
        cartItemsContainer.appendChild(div);
    });
    cartBadge.style.display = 'flex';
    cartBadge.textContent = String(totalItems);
    cartTotalElement.textContent = money(total);
}

function addToCart(id, qty = 1, sizeName = null) {
    const p = products.find(x => x.id === id);
    if (!p) return;

    // No se toca products.stock desde la PWA; sólo hacemos chequeo ligero basado en p.stock si quieres mostrar advertencia.
    // En este flujo, el admin controla stock. Aquí solo agregamos item al carrito y guardamos size en el order_item.
    if (sizeName) {
        const existing = cart.find(i => i.id === id && String(i.size).toLowerCase() === String(sizeName).toLowerCase());
        if (existing) {
            existing.qty += qty;
        } else {
            const priceForSize = (p.sizes && Array.isArray(p.sizes)) ? ((p.sizes.find(s => String(s.name).toLowerCase() === String(sizeName).toLowerCase()) || {}).price || p.price || 0) : p.price || 0;
            cart.push({
                id: p.id,
                name: p.name,
                price: Number(priceForSize),
                qty,
                image: p.image && p.image[0] ? p.image[0] : 'img/favicon.png',
                size: sizeName
            });
        }
    } else {
        const existing = cart.find(i => i.id === id && !i.size);
        if (existing) {
            existing.qty += qty;
        } else {
            cart.push({
                id: p.id,
                name: p.name,
                price: Number(p.price || 0),
                qty,
                image: p.image && p.image[0] ? p.image[0] : 'img/favicon.png',
                size: null
            });
        }
    }

    updateCart();
    showAddToCartToast({ image: p.image && p.image[0] ? p.image[0] : 'img/favicon.png', name: p.name, qty });
}

function showAddToCartToast({ image, name, qty = 1 }) {
    const existing = document.getElementById('add-to-cart-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'add-to-cart-toast';
    toast.className = 'add-to-cart-toast';
    const safeName = escapeHtml(name);
    toast.innerHTML = `<img src="${image}" alt="${safeName}" class="toast-img" loading="lazy" />
      <div class="toast-text">
        <div class="toast-title">${safeName}</div>
        <div class="toast-sub">Añadido x${qty}</div>
      </div>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    const VISIBLE_MS = 2000;
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, VISIBLE_MS);
}

cartItemsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-idx]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const op = btn.dataset.op;
    const productInCart = cart[idx];
    if (!productInCart) return;
    if (op === 'inc') {
        productInCart.qty++;
    }
    if (op === 'dec') {
        productInCart.qty--;
        if (productInCart.qty <= 0) cart.splice(idx, 1);
    }
    updateCart();
});

cartBtn.addEventListener('click', () => { showModal(cartModal); updateCart(); });

checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) { alert('El carrito está vacío'); return; }
    showModal(checkoutModal);
});

finalizeBtn.addEventListener('click', () => {
    const name = customerNameInput.value.trim();
    const address = customerAddressInput.value.trim();
    const payment = document.querySelector('input[name="payment"]:checked')?.value || '';

    if (!termsConsentCheckbox.checked) {
        alert('Debes aceptar los Términos y Condiciones y la Política de Datos para continuar.');
        return;
    }
    if (!name || !address) {
        alert('Por favor completa nombre y dirección');
        return;
    }

    orderDetails = {
        name,
        address,
        payment,
        items: cart.map(i => ({
            id: i.id,
            name: i.name,
            qty: i.qty,
            price: i.price,
            size: i.size
        })),
        total: cart.reduce((acc, item) => acc + item.price * item.qty, 0)
    };

    closeModal(checkoutModal);
    closeModal(cartModal);
    showOrderSuccessModal();
});

function showOrderSuccessModal() {
    if (orderDetails.total) orderSuccessTotal.textContent = money(orderDetails.total);
    showModal(orderSuccessModal);
}

// Enviar pedido al servidor (api/place-order), PWA no modifica products
whatsappBtn.addEventListener('click', async () => {
    if (Object.keys(orderDetails).length === 0) {
        alert('No hay detalles del pedido para enviar.');
        return;
    }

    try {
        // Llamada al API route que solo inserta orden en orders
        const response = await fetch('/api/place-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderDetails })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API place-order falló:', response.status, errorText);
            alert('Error al guardar el pedido en el servidor: ' + (errorText || response.statusText));
            return;
        }

        // Lee respuesta si es JSON
        let result = {};
        try { result = await response.json(); } catch (e) {}

        // Preparar mensaje de WhatsApp
        const whatsappNumber = '573227671829';
        let message = `Hola mi nombre es ${encodeURIComponent(orderDetails.name)}.%0AHe realizado un pedido para la dirección ${encodeURIComponent(orderDetails.address)}.%0A%0A`;
        orderDetails.items.forEach(item => {
            const sizeText = item.size ? ` (${item.size})` : '';
            message += `- ${encodeURIComponent(item.name + sizeText)} x${item.qty} = $${money(item.price * item.qty)}%0A`;
        });
        message += `%0ATotal: $${money(orderDetails.total)}`;
        const link = `https://wa.me/${whatsappNumber}?text=${message}`;
        window.open(link, '_blank');

        // limpiar y refrescar
        cart = [];
        orderDetails = {};
        products = await fetchProductsFromSupabase();
        showDefaultSections();
        updateCart();
        closeModal(orderSuccessModal);

    } catch (error) {
        console.error('Error al procesar el pedido:', error);
        alert('Error al procesar el pedido: ' + error.message);
    }
});

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBanner.classList.add('visible');
});
installPromptBtn && installPromptBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    installBanner.classList.remove('visible');
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
});
installCloseBtn && installCloseBtn.addEventListener('click', () => installBanner.classList.remove('visible'));

// DB functions
const fetchProductsFromSupabase = async () => {
    if (!supabaseClient) return [];
    try {
        const { data, error } = await supabaseClient.from('products').select('*');
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error al cargar productos:', err.message);
        alert('Hubo un error al cargar los productos. Revisa consola.');
        return [];
    }
};

const loadConfigAndInitSupabase = async () => {
    try {
        const response = await fetch('/api/get-config');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Fallo al cargar configuración: ${response.status} ${errorText}`);
        }
        const config = await response.json();
        if (!config.url || !config.anonKey) throw new Error("get-config no devolvió claves.");
        SB_URL = config.url;
        SB_ANON_KEY = config.anonKey;
        requireSizeSelection = Boolean(config.requireSizeSelection);
        supabaseClient = createClient(SB_URL, SB_ANON_KEY);
        products = await fetchProductsFromSupabase();
        if (products.length > 0) {
            showDefaultSections();
            generateCategoryCarousel();
        }
        updateCart();
    } catch (error) {
        console.error('Error al iniciar app:', error);
        const loadingMessage = document.createElement('div');
        loadingMessage.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;display:flex;align-items:center;justify-content:center;color:red;font-weight:bold;text-align:center;padding:16px;z-index:9999';
        loadingMessage.textContent = 'ERROR DE INICIALIZACIÓN: No se pudo cargar la configuración. Revisa la consola.';
        document.body.appendChild(loadingMessage);
    }
};

document.addEventListener('DOMContentLoaded', loadConfigAndInitSupabase);