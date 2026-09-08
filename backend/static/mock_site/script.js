document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Bug Injection Logic for OmniSight Testing ---
    const params = new URLSearchParams(window.location.search);
    const bug = params.get('bug');

    const checkoutBtn = document.getElementById('checkout-btn');
    const actionWrapper = document.getElementById('action-wrapper');
    const formDesc = document.getElementById('form-desc');
    const totalsBlock = document.getElementById('totals-block');

    if (checkoutBtn && actionWrapper && formDesc && totalsBlock) {
        checkoutBtn.classList.remove('bug-clipping', 'bug-hidden');
        actionWrapper.classList.remove('bug-clipping');
        formDesc.classList.remove('bug-overlap');
        totalsBlock.classList.remove('bug-contrast');

        if (bug === 'clipping') {
            actionWrapper.classList.add('bug-clipping');
            checkoutBtn.classList.add('bug-clipping');
            console.log('[OmniSight Mock Site] Clipping bug injected.');
        } else if (bug === 'overlap') {
            formDesc.classList.add('bug-overlap');
            console.log('[OmniSight Mock Site] Overlap bug injected.');
        } else if (bug === 'contrast') {
            totalsBlock.classList.add('bug-contrast');
            console.log('[OmniSight Mock Site] Low contrast bug injected.');
        } else if (bug === 'hidden') {
            checkoutBtn.classList.add('bug-hidden');
            console.log('[OmniSight Mock Site] Hidden button bug injected.');
        }
    }

    // --- 2. Tab Navigation Logic ---
    const navProducts = document.getElementById('nav-products');
    const navCategories = document.getElementById('nav-categories');
    const navCart = document.getElementById('nav-cart');
    const navOrders = document.getElementById('nav-orders');

    const viewProducts = document.getElementById('view-products');
    const viewCategories = document.getElementById('view-categories');
    const viewCart = document.getElementById('view-cart');
    const viewOrders = document.getElementById('view-orders');

    const tabs = [
        { btn: navProducts, view: viewProducts, display: 'block' },
        { btn: navCategories, view: viewCategories, display: 'block' },
        { btn: navCart, view: viewCart, display: 'grid' },
        { btn: navOrders, view: viewOrders, display: 'block' }
    ];

    function switchTab(activeBtn, activeView, displayMode) {
        tabs.forEach(t => {
            if (t.btn) t.btn.classList.remove('active');
            if (t.view) t.view.style.display = 'none';
        });
        if (activeBtn) activeBtn.classList.add('active');
        if (activeView) activeView.style.display = displayMode;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    tabs.forEach(tab => {
        if (tab.btn) {
            tab.btn.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab(tab.btn, tab.view, tab.display);
            });
        }
    });

    // Category cards click -> switch to Products tab
    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => {
            switchTab(navProducts, viewProducts, 'block');
        });
    });

    // --- 3. Input Persistence Logic (localStorage) ---
    const fields = ['firstname', 'lastname', 'address', 'city', 'postal', 'phone'];
    fields.forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            try {
                const savedValue = localStorage.getItem(`omnisight_site_${fieldId}`);
                if (savedValue !== null) {
                    input.value = savedValue;
                }
                input.addEventListener('input', () => {
                    try {
                        localStorage.setItem(`omnisight_site_${fieldId}`, input.value);
                    } catch (e) {
                        console.warn('Failed to save to localStorage:', e);
                    }
                });
            } catch (e) {
                console.warn('localStorage is blocked or unavailable:', e);
            }
        }
    });

    // --- 4. Product Catalog & Dynamic Cart State ---
    const CATALOG = {
        'omnibuds': { id: 'omnibuds', name: 'OmniBuds Pro Wireless', price: 149.00, meta: 'Color: Space Grey', icon: '🎧' },
        'deskmat': { id: 'deskmat', name: 'Glassmorphic Desk Mat', price: 35.00, meta: 'Size: XL', icon: '⌨️' },
        'mouse': { id: 'mouse', name: 'Precision Glide Mouse', price: 89.00, meta: 'Color: Matte Black', icon: '🖱️' },
        'display': { id: 'display', name: 'UltraWide Display', price: 499.00, meta: 'Resolution: 4K Curved', icon: '🖥️' }
    };

    const DEFAULT_CART = [
        { id: 'omnibuds', name: 'OmniBuds Pro Wireless', price: 149.00, meta: 'Color: Space Grey', icon: '🎧', qty: 1 },
        { id: 'deskmat', name: 'Glassmorphic Desk Mat', price: 35.00, meta: 'Size: XL', icon: '⌨️', qty: 1 }
    ];

    let cart = [];
    try {
        const savedCart = localStorage.getItem('omnisight_site_cart');
        if (savedCart) {
            const parsed = JSON.parse(savedCart);
            cart = Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_CART];
        } else {
            cart = [...DEFAULT_CART];
        }
    } catch (e) {
        cart = [...DEFAULT_CART];
    }

    function saveCart() {
        try {
            localStorage.setItem('omnisight_site_cart', JSON.stringify(cart));
        } catch (e) {
            console.warn('Unable to persist cart to localStorage:', e);
        }
    }

    function updateCartBadge() {
        const badge = document.getElementById('cart-count-badge');
        const summaryCount = document.getElementById('order-summary-count');
        const totalItems = cart.reduce((sum, item) => sum + (item.qty || 1), 0);

        if (badge) {
            badge.textContent = totalItems;
            badge.style.display = totalItems > 0 ? 'inline-flex' : 'none';
        }
        if (summaryCount) {
            summaryCount.textContent = `${totalItems} item${totalItems === 1 ? '' : 's'}`;
        }
    }

    function showToast(messageHtml) {
        const toast = document.getElementById('cart-toast');
        if (!toast) return;
        toast.innerHTML = messageHtml;
        toast.style.display = 'flex';

        const viewCartLink = toast.querySelector('#toast-view-cart');
        if (viewCartLink) {
            viewCartLink.addEventListener('click', () => {
                switchTab(navCart, viewCart, 'grid');
                toast.style.display = 'none';
            });
        }

        const viewOrdersLink = toast.querySelector('#toast-view-orders');
        if (viewOrdersLink) {
            viewOrdersLink.addEventListener('click', () => {
                switchTab(navOrders, viewOrders, 'block');
                toast.style.display = 'none';
            });
        }

        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.display = 'none';
        }, 4000);
    }

    function renderCart() {
        const cartList = document.getElementById('cart-items-list');
        const subtotalEl = document.getElementById('cart-subtotal');
        const grandtotalEl = document.getElementById('cart-grandtotal');

        if (!cartList) return;

        updateCartBadge();

        if (cart.length === 0) {
            cartList.innerHTML = `
                <div class="cart-empty-msg">
                    <p>Your order summary is currently empty.</p>
                    <a id="btn-browse-empty">Browse Products &rarr;</a>
                </div>
            `;
            const browseBtn = document.getElementById('btn-browse-empty');
            if (browseBtn) {
                browseBtn.addEventListener('click', () => switchTab(navProducts, viewProducts, 'block'));
            }
            if (subtotalEl) subtotalEl.textContent = '$0.00';
            if (grandtotalEl) grandtotalEl.textContent = '$0.00';
            return;
        }

        let subtotal = 0;
        cartList.innerHTML = '';

        cart.forEach(item => {
            const itemTotal = item.price * (item.qty || 1);
            subtotal += itemTotal;

            const itemEl = document.createElement('div');
            itemEl.className = 'cart-item';
            itemEl.setAttribute('data-id', item.id);
            itemEl.innerHTML = `
                <div class="item-img-placeholder">${item.icon || '📦'}</div>
                <div class="item-details">
                    <h4 class="item-name">${item.name}</h4>
                    <p class="item-meta">
                        ${item.meta || ''}
                        <span class="qty-control-group">
                            <button class="qty-btn" data-action="dec" data-id="${item.id}" title="Decrease quantity">&minus;</button>
                            <span class="qty-count">${item.qty || 1}</span>
                            <button class="qty-btn" data-action="inc" data-id="${item.id}" title="Increase quantity">&plus;</button>
                        </span>
                    </p>
                </div>
                <span class="item-price">$${itemTotal.toFixed(2)}</span>
                <button class="item-remove-btn" title="Remove item" data-remove-id="${item.id}">&times;</button>
            `;
            cartList.appendChild(itemEl);
        });

        // Bind increment and decrement buttons
        cartList.querySelectorAll('.qty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.getAttribute('data-action');
                const productId = btn.getAttribute('data-id');
                if (action === 'inc') {
                    changeItemQuantity(productId, 1);
                } else if (action === 'dec') {
                    changeItemQuantity(productId, -1);
                }
            });
        });

        // Bind remove buttons
        cartList.querySelectorAll('.item-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const removeId = btn.getAttribute('data-remove-id');
                removeFromCart(removeId);
            });
        });

        if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
        if (grandtotalEl) grandtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    }

    function addToCart(product) {
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            existing.qty = (existing.qty || 1) + 1;
        } else {
            cart.push({ ...product, qty: 1 });
        }
        saveCart();
        renderCart();
        showToast(`✅ Added <strong>${product.name}</strong> to Order Summary! <a id="toast-view-cart">View Summary &rarr;</a>`);
    }

    function changeItemQuantity(productId, delta) {
        const item = cart.find(i => i.id === productId);
        if (!item) return;
        item.qty = (item.qty || 1) + delta;
        if (item.qty <= 0) {
            cart = cart.filter(i => i.id !== productId);
        }
        saveCart();
        renderCart();
    }

    function removeFromCart(productId) {
        const itemToRemove = cart.find(item => item.id === productId);
        cart = cart.filter(item => item.id !== productId);
        saveCart();
        renderCart();
        if (itemToRemove) {
            showToast(`🗑️ Removed <strong>${itemToRemove.name}</strong> from order.`);
        }
    }

    // Attach listeners to "Add to Cart" buttons in Products tab
    document.querySelectorAll('.btn-add-to-cart').forEach(btn => {
        btn.addEventListener('click', () => {
            const prodId = btn.getAttribute('data-id');
            const product = CATALOG[prodId] || {
                id: prodId,
                name: btn.getAttribute('data-name'),
                price: parseFloat(btn.getAttribute('data-price') || '0'),
                meta: btn.getAttribute('data-meta') || '',
                icon: btn.getAttribute('data-icon') || '📦'
            };
            addToCart(product);
        });
    });

    // Quick-Add button in the Order Summary section
    const quickAddBtn = document.getElementById('quick-add-btn');
    const quickAddSelect = document.getElementById('quick-add-select');
    if (quickAddBtn && quickAddSelect) {
        quickAddBtn.addEventListener('click', () => {
            const selectedId = quickAddSelect.value;
            const product = CATALOG[selectedId];
            if (product) {
                addToCart(product);
            }
        });
    }

    // --- 5. Order History Management ---
    const DEFAULT_ORDERS = [
        {
            id: 'ORD-72941',
            date: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            customer: {
                name: 'John Doe',
                address: '123 Innovation Drive, San Francisco, 94107',
                phone: '+1 (555) 019-2834'
            },
            items: [
                { name: 'OmniBuds Pro Wireless', icon: '🎧', qty: 1, price: 149.00 },
                { name: 'Glassmorphic Desk Mat', icon: '⌨️', qty: 1, price: 35.00 }
            ],
            total: 184.00,
            status: 'Confirmed'
        }
    ];

    let orders = [];
    try {
        const savedOrders = localStorage.getItem('omnisight_site_orders');
        if (savedOrders) {
            const parsed = JSON.parse(savedOrders);
            orders = Array.isArray(parsed) ? parsed : [...DEFAULT_ORDERS];
        } else {
            orders = [...DEFAULT_ORDERS];
        }
    } catch (e) {
        orders = [...DEFAULT_ORDERS];
    }

    function saveOrders() {
        try {
            localStorage.setItem('omnisight_site_orders', JSON.stringify(orders));
        } catch (e) {
            console.warn('Unable to persist orders to localStorage:', e);
        }
    }

    function renderOrders() {
        const container = document.getElementById('orders-list-container');
        const badge = document.getElementById('orders-count-badge');
        if (!container) return;

        if (badge) {
            badge.textContent = orders.length;
            badge.style.display = orders.length > 0 ? 'inline-flex' : 'none';
        }

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="orders-empty-state">
                    <div class="empty-icon">📦</div>
                    <h3>No Orders Placed Yet</h3>
                    <p>When you complete a checkout in the Cart view, your confirmed orders and delivery details will appear right here.</p>
                    <button class="btn-shop-now" id="btn-start-shopping">Start Shopping &rarr;</button>
                </div>
            `;
            const shopBtn = document.getElementById('btn-start-shopping');
            if (shopBtn) {
                shopBtn.addEventListener('click', () => switchTab(navProducts, viewProducts, 'block'));
            }
            return;
        }

        container.innerHTML = '';
        orders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'order-card';

            const itemsHtml = order.items.map(item => `
                <div class="order-item-line">
                    <div class="order-item-left">
                        <span>${item.icon || '📦'}</span>
                        <strong>${item.name}</strong>
                        <span style="color: var(--text-muted); font-size: 0.8rem;">(Qty: ${item.qty || 1})</span>
                    </div>
                    <span>$${((item.price || 0) * (item.qty || 1)).toFixed(2)}</span>
                </div>
            `).join('');

            card.innerHTML = `
                <div class="order-card-header">
                    <div class="order-id-group">
                        <span class="order-id-text">${order.id}</span>
                        <span class="order-date-text">${order.date}</span>
                    </div>
                    <span class="order-status-badge">🟢 ${order.status || 'Confirmed'}</span>
                </div>

                <div class="order-items-breakdown">
                    ${itemsHtml}
                </div>

                <div class="order-card-footer">
                    <div class="order-shipping-summary">
                        <strong>Shipping to:</strong> ${order.customer.name} &bull; ${order.customer.address}
                    </div>
                    <div class="order-total-amount">
                        Total: $${parseFloat(order.total || 0).toFixed(2)}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // Clear Orders button
    const clearOrdersBtn = document.getElementById('clear-orders-btn');
    if (clearOrdersBtn) {
        clearOrdersBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear your order history?')) {
                orders = [];
                saveOrders();
                renderOrders();
            }
        });
    }

    // Proceed to Checkout button -> Places Order & Switches to Orders Tab
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (cart.length === 0) {
                alert('Your order summary is empty! Please add some products first.');
                switchTab(navProducts, viewProducts, 'block');
                return;
            }

            // Grab form values
            const firstname = (document.getElementById('firstname') || {}).value || 'Customer';
            const lastname = (document.getElementById('lastname') || {}).value || '';
            const address = (document.getElementById('address') || {}).value || '123 Main St';
            const city = (document.getElementById('city') || {}).value || 'City';
            const postal = (document.getElementById('postal') || {}).value || '00000';
            const phone = (document.getElementById('phone') || {}).value || 'N/A';

            const totalAmount = cart.reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0);

            const newOrder = {
                id: 'ORD-' + Math.floor(10000 + Math.random() * 90000),
                date: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                customer: {
                    name: `${firstname} ${lastname}`.trim(),
                    address: `${address}, ${city}, ${postal}`,
                    phone: phone
                },
                items: [...cart],
                total: totalAmount,
                status: 'Confirmed'
            };

            // Prepend new order
            orders.unshift(newOrder);
            saveOrders();

            // Clear current cart
            cart = [];
            saveCart();
            renderCart();
            renderOrders();

            // Switch to Orders View automatically
            switchTab(navOrders, viewOrders, 'block');

            // Show celebratory toast
            showToast(`🎉 Order <strong>${newOrder.id}</strong> placed! Details shown below.`);
        });
    }

    // Initial render
    renderCart();
    renderOrders();
});
