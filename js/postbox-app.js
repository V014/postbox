// Postbox Main Application Controller & View Orchestrator
// Coordinates Customer, Driver, and Admin views, real-time tracking, modals, and scanner

(function () {
  class PostboxApp {
    constructor() {
      this.currentView = 'inbox'; // inbox, track, send, scan, payment
      this.activeTrackingItemId = 'AZ-9921-X01';
      this.currentFilter = 'all';
      this.searchQuery = '';
      this.customerMap = null;
      this.driverMap = null;
      this.signaturePad = null;
      this.cameraStream = null;
      this.isTorchOn = false;

      this.init();
    }

    init() {
      // Subscribe to central store
      window.postboxStore.subscribe((state, source) => {
        this.renderState(state, source);
      });

      // Bind UI navigation & role switching
      this.bindEvents();

      // Check URL parameters (e.g. ?view=track or ?item=AZ-9921-X01 or ?role=driver)
      const params = new URLSearchParams(window.location.search);
      if (params.get('role')) {
        window.postboxStore.setRole(params.get('role'));
      }
      if (params.get('item')) {
        this.activeTrackingItemId = params.get('item');
      }
      if (params.get('view')) {
        this.switchView(params.get('view'));
      } else {
        this.switchView('inbox');
      }

      // Initialize initial view
      this.render();
    }

    bindEvents() {
      // Role Switchers
      document.querySelectorAll('[data-role-switch]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const role = btn.getAttribute('data-role-switch');
          window.postboxStore.setRole(role);
        });
      });

      // Bottom Nav tabs
      document.querySelectorAll('[data-nav-view]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const target = btn.getAttribute('data-nav-view');
          this.switchView(target);
        });
      });

      // Search input
      const searchInput = document.getElementById('mail-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.searchQuery = e.target.value.toLowerCase().trim();
          this.renderMailList();
        });
      }

      // Filter pills
      document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-filter]').forEach(b => {
            b.classList.remove('bg-primary', 'text-on-primary');
            b.classList.add('bg-surface-container-high', 'text-on-surface-variant');
          });
          btn.classList.remove('bg-surface-container-high', 'text-on-surface-variant');
          btn.classList.add('bg-primary', 'text-on-primary');

          this.currentFilter = btn.getAttribute('data-filter');
          this.renderMailList();
          if (window.PostboxAudio) window.PostboxAudio.play('click');
        });
      });

      // Mobile frame toggle (desktop preview)
      const frameToggle = document.getElementById('toggle-mobile-frame');
      if (frameToggle) {
        frameToggle.addEventListener('click', () => {
          const wrapper = document.getElementById('app-shell-wrapper');
          if (wrapper) {
            wrapper.classList.toggle('max-w-md');
            wrapper.classList.toggle('border-8');
            wrapper.classList.toggle('border-gray-800');
            wrapper.classList.toggle('rounded-[3rem]');
            wrapper.classList.toggle('shadow-2xl');
            wrapper.classList.toggle('my-6');
            if (window.PostboxAudio) window.PostboxAudio.play('click');
          }
        });
      }

      // Driver route toggle
      const driverToggleBtn = document.getElementById('driver-start-route-btn');
      if (driverToggleBtn) {
        driverToggleBtn.addEventListener('click', () => {
          window.postboxStore.toggleDriverDriving();
        });
      }

      // Customer simulate driver button
      const simBtn = document.getElementById('sim-driver-movement-btn');
      if (simBtn) {
        simBtn.addEventListener('click', () => {
          window.postboxStore.toggleDriverDriving();
        });
      }

      // Notifications toggle
      const notifBtn = document.getElementById('notif-bell-btn');
      if (notifBtn) {
        notifBtn.addEventListener('click', () => {
          this.toggleNotificationsModal();
        });
      }
    }

    switchView(viewName) {
      this.currentView = viewName;

      // Update bottom nav active indicators
      document.querySelectorAll('[data-nav-view]').forEach(btn => {
        const v = btn.getAttribute('data-nav-view');
        const icon = btn.querySelector('.material-symbols-outlined');
        if (v === viewName) {
          btn.classList.remove('text-[#271816]/60', 'hover:bg-[#AF101A]/5');
          btn.classList.add('bg-gradient-to-br', 'from-[#AF101A]', 'to-[#D32F2F]', 'text-white', 'rounded-lg', 'scale-105');
          if (icon) icon.style.fontVariationSettings = "'FILL' 1";
        } else {
          btn.classList.add('text-[#271816]/60');
          btn.classList.remove('bg-gradient-to-br', 'from-[#AF101A]', 'to-[#D32F2F]', 'text-white', 'rounded-lg', 'scale-105');
          if (icon) icon.style.fontVariationSettings = "'FILL' 0";
        }
      });

      // Show/hide view containers
      const views = ['inbox', 'track', 'send', 'scan', 'payment', 'driver', 'admin'];
      views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) {
          if (v === viewName) {
            el.classList.remove('hidden');
          } else {
            el.classList.add('hidden');
          }
        }
      });

      // Scroll to top
      window.scrollTo(0, 0);

      // View-specific initializations
      if (viewName === 'track') {
        this.initCustomerMap();
      } else if (viewName === 'driver') {
        this.initDriverMap();
      } else if (viewName === 'scan') {
        this.initScanner();
      }

      if (window.PostboxAudio) window.PostboxAudio.play('click');
    }

    renderState(state, source) {
      // Update role UI
      this.updateRoleUI(state.currentRole);

      // Update Subscription card
      const subDaysEl = document.getElementById('subscription-days-count');
      if (subDaysEl) {
        subDaysEl.textContent = `Membership active • ${state.user.daysRemaining} days remaining`;
      }

      // Update Driver status badge & controls
      const driverBadge = document.getElementById('driver-live-status-badge');
      const driverBtn = document.getElementById('driver-start-route-btn');
      const simBtn = document.getElementById('sim-driver-movement-btn');
      const isDriving = state.driver.isDriving;

      if (driverBadge) {
        if (isDriving) {
          driverBadge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping mr-1"></span> Live GPS Broadcasting (${state.driver.speedKmh} km/h)`;
          driverBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800';
        } else {
          driverBadge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1"></span> Van Parked / At Hub`;
          driverBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800';
        }
      }

      if (driverBtn) {
        driverBtn.innerHTML = isDriving
          ? `<span class="material-symbols-outlined">pause_circle</span> Pause Driving Broadcast`
          : `<span class="material-symbols-outlined">play_circle</span> Start Driving / Broadcast Live GPS`;
        driverBtn.className = isDriving
          ? 'w-full py-4 px-6 rounded-xl bg-amber-600 text-white font-headline font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all'
          : 'w-full py-4 px-6 rounded-xl bg-gradient-to-br from-[#AF101A] to-[#D32F2F] text-white font-headline font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all';
      }

      if (simBtn) {
        simBtn.innerHTML = isDriving
          ? `<span class="material-symbols-outlined text-sm">pause</span> Pause Live Van Route`
          : `<span class="material-symbols-outlined text-sm">play_arrow</span> Watch Van Move in Real-Time`;
      }

      // Update customer tracking ETA
      const trackingEtaEl = document.getElementById('tracking-eta-display');
      const activeItem = state.mailItems.find(i => i.id === this.activeTrackingItemId);
      if (trackingEtaEl && activeItem) {
        trackingEtaEl.textContent = activeItem.eta || 'On Route';
      }

      // Update notifications counter
      const notifCountEl = document.getElementById('notif-badge-count');
      const unreadCount = state.notifications.filter(n => n.unread).length;
      if (notifCountEl) {
        notifCountEl.textContent = unreadCount;
        notifCountEl.style.display = unreadCount > 0 ? 'flex' : 'none';
      }

      // Re-render active mail list
      this.renderMailList();
      this.renderDriverManifest();
      this.renderAdminLockerGrid();
    }

    updateRoleUI(role) {
      // Highlight active role pill in top bar
      document.querySelectorAll('[data-role-switch]').forEach(btn => {
        const r = btn.getAttribute('data-role-switch');
        if (r === role) {
          btn.classList.add('bg-white', 'text-[#AF101A]', 'shadow-sm', 'font-bold');
          btn.classList.remove('text-[#271816]/70');
        } else {
          btn.classList.remove('bg-white', 'text-[#AF101A]', 'shadow-sm', 'font-bold');
          btn.classList.add('text-[#271816]/70');
        }
      });

      // Show/hide role-specific views
      const roleBanner = document.getElementById('role-indicator-banner');
      if (roleBanner) {
        if (role === 'driver') {
          roleBanner.innerHTML = `
            <div class="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2 text-xs flex justify-between items-center shadow-md">
              <span class="flex items-center gap-2 font-semibold"><span class="material-symbols-outlined text-sm">local_shipping</span> Driver View: Kondwani Banda (Van #04)</span>
              <button onclick="window.postboxStore.setRole('customer')" class="underline hover:text-white/80 text-[11px] font-bold">Switch to Customer</button>
            </div>
          `;
          roleBanner.classList.remove('hidden');
          this.switchView('driver');
        } else if (role === 'admin') {
          roleBanner.innerHTML = `
            <div class="bg-gradient-to-r from-indigo-900 to-purple-800 text-white px-4 py-2 text-xs flex justify-between items-center shadow-md">
              <span class="flex items-center gap-2 font-semibold"><span class="material-symbols-outlined text-sm">admin_panel_settings</span> Supervisor View: Blantyre Hub</span>
              <button onclick="window.postboxStore.setRole('customer')" class="underline hover:text-white/80 text-[11px] font-bold">Switch to Customer</button>
            </div>
          `;
          roleBanner.classList.remove('hidden');
          this.switchView('admin');
        } else {
          roleBanner.classList.add('hidden');
          if (this.currentView === 'driver' || this.currentView === 'admin') {
            this.switchView('inbox');
          }
        }
      }
    }

    renderMailList() {
      const container = document.getElementById('mail-items-container');
      if (!container) return;

      const state = window.postboxStore.state;
      let items = state.mailItems.filter(item => item.direction === 'incoming');

      // Filter by category
      if (this.currentFilter !== 'all') {
        items = items.filter(i => {
          if (this.currentFilter === 'letters') return i.type === 'letter';
          if (this.currentFilter === 'packages') return i.type === 'package';
          if (this.currentFilter === 'magazines') return i.type === 'magazine';
          return true;
        });
      }

      // Search query
      if (this.searchQuery) {
        items = items.filter(i =>
          (i.title && i.title.toLowerCase().includes(this.searchQuery)) ||
          (i.sender && i.sender.toLowerCase().includes(this.searchQuery)) ||
          (i.trackingNumber && i.trackingNumber.toLowerCase().includes(this.searchQuery))
        );
      }

      const countBadge = document.getElementById('mail-items-count-badge');
      if (countBadge) {
        countBadge.textContent = `${items.length} Items`;
      }

      if (items.length === 0) {
        container.innerHTML = `
          <div class="text-center py-12 px-6 bg-surface-container-lowest rounded-2xl border border-surface-container">
            <span class="material-symbols-outlined text-4xl text-outline mb-2">mark_email_unread</span>
            <p class="font-headline font-bold text-on-surface">No mail matching criteria</p>
            <p class="text-xs text-on-surface-variant mt-1">Try another search keyword or category tab.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = items.map(item => {
        const isPackage = item.type === 'package';
        const isActionReq = item.status === 'action_required';
        const isDelivered = item.status === 'delivered';
        const isOutForDelivery = item.status === 'out_for_delivery';

        let statusHtml = '';
        if (isOutForDelivery) {
          statusHtml = `
            <div class="flex items-center gap-1.5 text-primary">
              <span class="w-2.5 h-2.5 rounded-full bg-primary animate-ping"></span>
              <span class="font-label text-[11px] font-bold uppercase tracking-wider">${item.statusLabel}</span>
            </div>
          `;
        } else if (isActionReq) {
          statusHtml = `
            <div class="flex items-center gap-1.5 text-primary">
              <span class="material-symbols-outlined text-sm">priority_high</span>
              <span class="font-label text-[11px] font-bold uppercase tracking-wider">Action Required</span>
            </div>
          `;
        } else if (isDelivered) {
          statusHtml = `
            <div class="flex items-center gap-1.5 text-outline">
              <span class="material-symbols-outlined text-sm">check_circle</span>
              <span class="font-label text-[11px] font-medium uppercase tracking-wider">${item.statusLabel}</span>
            </div>
          `;
        } else {
          statusHtml = `
            <div class="flex items-center gap-1.5 text-outline">
              <span class="w-2 h-2 rounded-full bg-primary/80"></span>
              <span class="font-label text-[11px] font-medium uppercase tracking-wider">${item.statusLabel}</span>
            </div>
          `;
        }

        let iconName = 'description';
        if (isPackage) iconName = 'package_2';
        else if (item.type === 'magazine') iconName = 'menu_book';
        else if (item.sender.toLowerCase().includes('bank')) iconName = 'account_balance';
        else if (item.sender.toLowerCase().includes('gov')) iconName = 'policy';

        return `
          <div onclick="window.postboxApp.handleMailItemClick('${item.id}')"
               class="bg-surface-container-lowest rounded-[1.5rem] p-5 shadow-sm flex items-center gap-4 group cursor-pointer hover:shadow-md transition-all active:scale-[0.98] border border-surface-container">
            <div class="w-14 h-14 ${isPackage ? 'bg-secondary-container text-primary' : 'bg-surface-container-high text-on-surface-variant'} flex items-center justify-center rounded-2xl shrink-0 group-hover:scale-105 transition-transform">
              <span class="material-symbols-outlined text-2xl">${iconName}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-start mb-0.5">
                <h4 class="font-headline font-bold text-on-background truncate text-base">${item.sender}</h4>
                <span class="${isPackage ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-on-surface-variant'} px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  ${item.type}
                </span>
              </div>
              <p class="font-body text-xs text-on-surface-variant truncate mb-2">${item.title}</p>
              ${statusHtml}
            </div>
            <div class="text-outline group-hover:text-primary transition-colors">
              <span class="material-symbols-outlined text-xl">chevron_right</span>
            </div>
          </div>
        `;
      }).join('');
    }

    handleMailItemClick(itemId) {
      const item = window.postboxStore.getItemById(itemId);
      if (!item) return;

      if (item.type === 'package') {
        this.activeTrackingItemId = item.id;
        this.updatePackageDetailView(item);
        this.switchView('track');
      } else {
        // Show Digitized Mail inspection modal
        this.showLetterModal(item);
      }
    }

    updatePackageDetailView(item) {
      const titleEl = document.getElementById('track-package-title');
      const numEl = document.getElementById('track-package-number');
      const senderEl = document.getElementById('track-package-sender');
      const weightEl = document.getElementById('track-package-weight');
      const dimEl = document.getElementById('track-package-dim');
      const lockerEl = document.getElementById('track-package-locker');

      if (titleEl) titleEl.textContent = item.title;
      if (numEl) numEl.textContent = item.trackingNumber;
      if (senderEl) senderEl.textContent = item.sender;
      if (weightEl) weightEl.textContent = item.weight || '2.4 kg';
      if (dimEl) dimEl.textContent = item.dimensions || '30 × 20 × 15 cm';
      if (lockerEl) lockerEl.textContent = item.pickupPoint || 'Locker #42';
    }

    showLetterModal(item) {
      const modal = document.getElementById('letter-preview-modal');
      const title = document.getElementById('letter-modal-title');
      const sender = document.getElementById('letter-modal-sender');
      const summary = document.getElementById('letter-modal-summary');

      if (title) title.textContent = item.title;
      if (sender) sender.textContent = `${item.sender} (${item.trackingNumber})`;
      if (summary) summary.textContent = item.summary || 'Physical mail securely digitized and verified by Malawi Posts Corporation.';

      if (modal) {
        modal.classList.remove('hidden');
        if (window.PostboxAudio) window.PostboxAudio.play('beep');
      }
    }

    closeLetterModal() {
      const modal = document.getElementById('letter-preview-modal');
      if (modal) modal.classList.add('hidden');
      if (window.PostboxAudio) window.PostboxAudio.play('click');
    }

    initCustomerMap() {
      setTimeout(() => {
        if (!this.customerMap) {
          this.customerMap = new window.PostboxLiveMap('live-driver-map', {
            interactive: true,
            showControls: true,
            zoom: 14,
            role: 'customer'
          });
        } else {
          this.customerMap.map.invalidateSize();
          this.customerMap.fitRoute();
        }
      }, 100);
    }

    initDriverMap() {
      setTimeout(() => {
        if (!this.driverMap) {
          this.driverMap = new window.PostboxLiveMap('driver-route-map', {
            interactive: true,
            showControls: false,
            zoom: 15,
            role: 'driver'
          });
        } else {
          this.driverMap.map.invalidateSize();
          this.driverMap.recenterOnVan();
        }
      }, 100);
    }

    // Driver Manifest rendering
    renderDriverManifest() {
      const container = document.getElementById('driver-manifest-container');
      if (!container) return;

      const state = window.postboxStore.state;
      const assigned = state.mailItems.filter(i => i.type === 'package');

      container.innerHTML = assigned.map((item, idx) => {
        const isCurrent = item.id === state.driver.activeItemId;
        const isDone = item.status === 'delivered';

        return `
          <div class="p-4 rounded-2xl ${isCurrent ? 'bg-amber-50 border-2 border-amber-400' : 'bg-surface-container-lowest border border-surface-container'} flex items-start justify-between gap-3">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-full ${isDone ? 'bg-emerald-600 text-white' : isCurrent ? 'bg-amber-500 text-white font-bold' : 'bg-gray-200 text-gray-700'} flex items-center justify-center text-xs shrink-0 mt-0.5">
                ${isDone ? '<span class="material-symbols-outlined text-sm">check</span>' : idx + 1}
              </div>
              <div>
                <p class="font-bold text-xs uppercase tracking-wider text-outline mb-0.5">${item.trackingNumber}</p>
                <h5 class="font-headline font-bold text-sm text-on-surface">${item.recipient || item.sender}</h5>
                <p class="text-xs text-on-surface-variant">${item.pickupPoint || 'Sunnyside Postbox'}</p>
                <span class="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold ${isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                  ${isDone ? 'Delivered' : item.statusLabel}
                </span>
              </div>
            </div>
            ${isCurrent && !isDone ? `
              <button onclick="window.postboxApp.openSignatureModal('${item.id}')"
                      class="px-3 py-2 bg-gradient-to-br from-[#AF101A] to-[#D32F2F] text-white rounded-xl text-xs font-bold active:scale-95 shadow">
                Deliver
              </button>
            ` : ''}
          </div>
        `;
      }).join('');
    }

    // Admin Locker Grid rendering
    renderAdminLockerGrid() {
      const grid = document.getElementById('admin-locker-grid');
      if (!grid) return;

      const state = window.postboxStore.state;
      grid.innerHTML = state.lockers.map(l => {
        const isOccupied = l.status === 'occupied';
        const isReserved = l.status === 'reserved';
        let bg = 'bg-emerald-50 border-emerald-300 text-emerald-800';
        let statusBadge = 'Available';

        if (isOccupied) {
          bg = 'bg-red-50 border-red-300 text-red-900';
          statusBadge = `Box: ${l.assignedItem}`;
        } else if (isReserved) {
          bg = 'bg-amber-50 border-amber-300 text-amber-900';
          statusBadge = 'Reserved';
        }

        return `
          <div class="border rounded-xl p-3 flex flex-col justify-between ${bg} min-h-[95px] relative group">
            <div class="flex justify-between items-center">
              <span class="font-headline font-bold text-sm">#${l.id}</span>
              <span class="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold bg-white/70">${l.size}</span>
            </div>
            <div class="text-[11px] font-semibold truncate my-1">
              ${statusBadge}
            </div>
            <div class="flex justify-between items-center text-[10px]">
              <span class="font-mono text-gray-500">PIN: ${l.pin}</span>
              <button onclick="window.postboxApp.handleAdminUnlockLocker(${l.id})" class="text-primary hover:underline font-bold">
                Unlock
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    handleAdminUnlockLocker(lockerId) {
      const res = window.postboxStore.unlockLocker(lockerId);
      if (res.success) {
        alert(`Locker #${lockerId} door successfully unlocked! PIN: ${res.pin}`);
      }
    }

    // Signature Modal for Driver
    openSignatureModal(itemId) {
      const modal = document.getElementById('signature-modal');
      if (!modal) return;
      modal.classList.remove('hidden');

      setTimeout(() => {
        if (!this.signaturePad) {
          this.signaturePad = new window.PostboxSignaturePad('signature-canvas');
        } else {
          this.signaturePad.clear();
        }
      }, 100);

      if (window.PostboxAudio) window.PostboxAudio.play('beep');
    }

    closeSignatureModal() {
      const modal = document.getElementById('signature-modal');
      if (modal) modal.classList.add('hidden');
    }

    clearSignature() {
      if (this.signaturePad) {
        this.signaturePad.clear();
        if (window.PostboxAudio) window.PostboxAudio.play('click');
      }
    }

    submitDeliveryProof() {
      const state = window.postboxStore.state;
      const itemId = state.driver.activeItemId;
      const recipientInput = document.getElementById('sig-recipient-name');
      const recipientName = recipientInput ? recipientInput.value.trim() : 'Alex Banda';
      const sigData = this.signaturePad ? this.signaturePad.getDataURL() : null;

      window.postboxStore.confirmDelivery(itemId, sigData, recipientName, 'Handed directly to recipient at residence');
      this.closeSignatureModal();
    }

    // Smart Locker Unlock Dialog
    promptUnlockLocker(lockerId = 42) {
      const res = window.postboxStore.unlockLocker(lockerId);
      const modal = document.getElementById('locker-unlocked-modal');
      const numEl = document.getElementById('unlocked-locker-num');

      if (numEl) numEl.textContent = lockerId;
      if (modal) {
        modal.classList.remove('hidden');
      }
    }

    closeLockerUnlockedModal() {
      const modal = document.getElementById('locker-unlocked-modal');
      if (modal) modal.classList.add('hidden');
      if (window.PostboxAudio) window.PostboxAudio.play('click');
    }

    // QR Camera Viewfinder initialization
    initScanner() {
      const video = document.getElementById('scanner-video-feed');
      const fallback = document.getElementById('scanner-fallback-feed');

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          .then(stream => {
            this.cameraStream = stream;
            if (video) {
              video.srcObject = stream;
              video.play();
              video.classList.remove('hidden');
              if (fallback) fallback.classList.add('hidden');
            }
            this.startBarcodeDetection(video);
          })
          .catch(err => {
            console.log('WebRTC camera not permitted or not present, showing animated postal scanner simulation:', err);
            if (video) video.classList.add('hidden');
            if (fallback) fallback.classList.remove('hidden');
          });
      } else {
        if (video) video.classList.add('hidden');
        if (fallback) fallback.classList.remove('hidden');
      }
    }

    startBarcodeDetection(video) {
      if (!('BarcodeDetector' in window) || !video) return;

      const detector = new window.BarcodeDetector({
        formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'itf', 'pdf417']
      });
      let scanning = true;

      const scanFrame = async () => {
        if (!scanning || this.currentView !== 'scan') return;
        try {
          const codes = await detector.detect(video);
          if (codes.length) {
            scanning = false;
            const raw = codes[0].rawValue.replace(/\s+/g, '');
            this.triggerTestScan(raw);
            setTimeout(() => { scanning = true; }, 2500);
          }
        } catch (_) {}
        requestAnimationFrame(scanFrame);
      };
      requestAnimationFrame(scanFrame);
    }

    triggerTestScan(code) {
      if (window.PostboxAudio) window.PostboxAudio.play('scan');

      // Visual pulse
      const reticle = document.getElementById('scanner-reticle-box');
      if (reticle) {
        reticle.classList.add('ring-4', 'ring-emerald-400');
        setTimeout(() => {
          reticle.classList.remove('ring-4', 'ring-emerald-400');
        }, 600);
      }

      setTimeout(() => {
        if (code.includes('LOCKER') || code === '42') {
          this.promptUnlockLocker(42);
        } else {
          const item = window.postboxStore.getItemById(code);
          if (item) {
            this.openDeliveryVerification(item.id);
          } else {
            this.openUnknownScanModal(code);
          }
        }
      }, 250);
    }

    openDeliveryVerification(itemId) {
      const item = window.postboxStore.getItemById(itemId);
      if (!item) return;

      document.getElementById('verify-item-name').textContent = item.title;
      document.getElementById('verify-tracking-number').textContent = item.trackingNumber;
      document.getElementById('verify-sender').textContent = item.sender;
      document.getElementById('verify-destination').textContent = item.pickupPoint || 'Customer postbox';
      const action = document.getElementById('confirm-delivery-button');
      action.setAttribute('data-item-id', item.id);
      action.disabled = item.status === 'delivered';
      action.innerHTML = item.status === 'delivered'
        ? '<span class="material-symbols-outlined">check_circle</span> Already delivered'
        : '<span class="material-symbols-outlined">verified</span> Confirm delivery';

      document.getElementById('delivery-verification-modal').classList.remove('hidden');
      if (window.PostboxAudio) window.PostboxAudio.play('beep');
    }

    confirmScannedDelivery() {
      const button = document.getElementById('confirm-delivery-button');
      const itemId = button.getAttribute('data-item-id');
      if (!itemId) return;
      const result = window.postboxStore.verifyDelivery(itemId);
      if (!result.success) return;

      document.getElementById('delivery-verification-modal').classList.add('hidden');
      const success = document.getElementById('delivery-verified-modal');
      document.getElementById('verified-tracking-number').textContent = result.item.trackingNumber;
      success.classList.remove('hidden');
    }

    closeDeliveryVerification() {
      document.getElementById('delivery-verification-modal').classList.add('hidden');
    }

    closeDeliveryVerified() {
      document.getElementById('delivery-verified-modal').classList.add('hidden');
      this.switchView('inbox');
    }

    openUnknownScanModal(code) {
      document.getElementById('unknown-scan-code').textContent = code;
      document.getElementById('unknown-scan-modal').classList.remove('hidden');
    }

    closeUnknownScanModal() {
      document.getElementById('unknown-scan-modal').classList.add('hidden');
    }

    toggleTorch() {
      this.isTorchOn = !this.isTorchOn;
      const torchIcon = document.getElementById('torch-toggle-icon');
      if (torchIcon) {
        torchIcon.textContent = this.isTorchOn ? 'flash_off' : 'flash_on';
      }
      if (window.PostboxAudio) window.PostboxAudio.play('click');
    }

    // Outgoing Mail Creator Form
    submitOutgoingMail(e) {
      e.preventDefault();
      const form = document.getElementById('send-mail-form');
      if (!form) return;

      const data = {
        recipientName: form.recipientName.value,
        destinationAddress: form.destinationAddress.value,
        description: form.description.value,
        weight: form.weight.value + ' kg',
        serviceType: form.serviceType.value,
        type: form.itemType.value
      };

      const newItem = window.postboxStore.createOutgoingItem(data);

      // Show success modal
      const modal = document.getElementById('outgoing-success-modal');
      const trackEl = document.getElementById('outgoing-new-tracking-num');
      if (trackEl) trackEl.textContent = newItem.trackingNumber;
      if (modal) modal.classList.remove('hidden');

      form.reset();
    }

    closeOutgoingSuccessModal() {
      const modal = document.getElementById('outgoing-success-modal');
      if (modal) modal.classList.add('hidden');
      this.switchView('inbox');
    }

    // Admin Mail Intake Form
    submitAdminIntake(e) {
      e.preventDefault();
      const form = document.getElementById('admin-intake-form');
      if (!form) return;

      const data = {
        sender: form.sender.value,
        title: form.title.value,
        type: form.type.value,
        summary: form.summary.value,
        urgent: form.urgent.checked
      };

      const item = window.postboxStore.intakeMail(data);
      alert(`Mail ${item.trackingNumber} successfully scanned & deposited into Postbox #104!`);
      form.reset();
    }

    // Payment & Subscription
    handlePaymentSubmit(e) {
      e.preventDefault();
      const form = document.getElementById('payment-form');
      const submitBtn = document.getElementById('confirm-pay-btn');
      const origText = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="inline-block animate-spin material-symbols-outlined text-lg">progress_activity</span>
        Processing Bank Payment...
      `;

      setTimeout(() => {
        const isAnnual = form.billingPlan ? form.billingPlan.value === 'annual' : false;
        window.postboxStore.renewSubscription(isAnnual ? 'annual' : 'monthly');

        submitBtn.disabled = false;
        submitBtn.innerHTML = origText;

        // Show receipt modal
        const modal = document.getElementById('payment-success-modal');
        if (modal) modal.classList.remove('hidden');
      }, 1200);
    }

    closePaymentSuccessModal() {
      const modal = document.getElementById('payment-success-modal');
      if (modal) modal.classList.add('hidden');
      this.switchView('inbox');
    }

    toggleNotificationsModal() {
      const modal = document.getElementById('notifications-modal');
      if (!modal) return;
      modal.classList.toggle('hidden');

      // Mark all read
      const state = window.postboxStore.state;
      state.notifications.forEach(n => n.unread = false);
      window.postboxStore.saveState(false);
      this.renderNotificationsList();
    }

    renderNotificationsList() {
      const container = document.getElementById('notifications-list');
      if (!container) return;

      const notifs = window.postboxStore.state.notifications;
      container.innerHTML = notifs.map(n => `
        <div class="p-3 bg-surface-container-low rounded-xl text-left border border-surface-container">
          <p class="font-headline font-bold text-xs text-primary">${n.title}</p>
          <p class="text-xs text-on-surface-variant mt-0.5">${n.text}</p>
          <p class="text-[10px] text-outline mt-1 font-mono">${n.time}</p>
        </div>
      `).join('');
    }

    render() {
      this.renderState(window.postboxStore.state, 'init');
    }
  }

  // Export singleton instance
  window.postboxApp = new PostboxApp();
})();
