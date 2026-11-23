// Postbox Central Reactive Data Store & Multi-Role Sync Engine
// Connects Customer, Driver on route, and Postal Admin Clerk with Live GPS broadcast

(function () {
  const STORAGE_KEY = 'postbox_app_state_v1';
  const CHANNEL_NAME = 'postbox_sync_bus';

  // Default Initial Mock Data
  const defaultState = {
    currentRole: 'customer', // 'customer' | 'driver' | 'admin'
    user: {
      id: 'usr_104',
      name: 'Alex Banda',
      postbox: 'Postbox #104, Blantyre GPO',
      email: 'alex.banda@postbox.mw',
      phone: '+265 88 412 8901',
      subscriptionTier: 'Premium Plus',
      subscriptionStatus: 'ACTIVE',
      daysRemaining: 12,
      billingCycle: 'monthly',
      price: 15.00,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    },
    driver: {
      id: 'drv_04',
      name: 'Kondwani Banda',
      roleTitle: 'Senior Courier Dispatcher',
      phone: '+265 99 123 4567',
      van: 'Van #04 (Reg: BW 4092)',
      depot: 'Blantyre Central Sorting Hub',
      rating: 4.9,
      deliveriesCompletedToday: 11,
      isOnDuty: true,
      isDriving: false,
      speedKmh: 36,
      currentStopIndex: 0,
      activeItemId: 'AZ-9921-X01',
      routeProgress: 0.35, // 0.0 to 1.0 along waypoints
      currentCoords: [-15.7965, 35.0125],
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
    },
    admin: {
      id: 'adm_01',
      name: 'Chifundo Gondwe',
      title: 'Chief Postal Inspector & Hub Manager',
      station: 'Malawi Posts Corporation - Blantyre GPO',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'
    },
    // Route waypoints from Depot to Customer
    routeWaypoints: [
      { lat: -15.7861, lng: 35.0058, name: 'Blantyre Central Depot' },
      { lat: -15.7910, lng: 35.0095, name: 'Victoria Avenue Junction' },
      { lat: -15.7942, lng: 35.0135, name: 'Ginnery Corner' },
      { lat: -15.7988, lng: 35.0210, name: 'Chipembere Highway' },
      { lat: -15.7960, lng: 35.0090, name: 'Sunnyside Avenue' },
      { lat: -15.7915, lng: 35.0022, name: 'Customer Destination (Locker #42 / Home)' }
    ],
    mailItems: [
      {
        id: 'AZ-9921-X01',
        trackingNumber: '#AZ-9921-X01',
        type: 'package',
        direction: 'incoming',
        sender: 'Amazon.com',
        senderSubtitle: 'Verified Merchant • Seattle, WA',
        title: 'TechGear & Home Gadgets',
        weight: '2.4 kg',
        dimensions: '30 × 20 × 15 cm',
        pickupPoint: 'Locker #42',
        terminal: 'Main Terminal',
        status: 'out_for_delivery', // 'in_transit' | 'out_for_delivery' | 'ready_pickup' | 'delivered'
        statusLabel: 'On Route • Out for Delivery',
        eta: 'Arriving Today (Estimated 8 mins)',
        deliveredTime: null,
        driverId: 'drv_04',
        image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80',
        pod: null, // proof of delivery
        history: [
          { time: '07:30 AM', title: 'Package Received at Blantyre GPO Hub', detail: 'Sorted into Courier Bay #4' },
          { time: '09:45 AM', title: 'Assigned to Driver Kondwani Banda', detail: 'Van #04 - Southern District Route' },
          { time: '01:15 PM', title: 'Package Scanned onto Vehicle', detail: 'Out on delivery manifest' },
          { time: '04:15 PM', title: 'Driver En Route to Customer', detail: 'Customer can view live GPS coordinates' }
        ]
      },
      {
        id: 'TG-90210',
        trackingNumber: '#TG-90210',
        type: 'package',
        direction: 'incoming',
        sender: 'TechGear Inc.',
        senderSubtitle: 'Hardware Supplier • Blantyre Park',
        title: 'Electronic Components - TG-90210',
        weight: '1.1 kg',
        dimensions: '20 × 15 × 8 cm',
        pickupPoint: 'Smart Locker #14',
        terminal: 'Central Concourse',
        status: 'in_transit',
        statusLabel: 'In Transit • Arriving Sat',
        eta: 'Saturday, 11:00 AM',
        deliveredTime: null,
        driverId: 'drv_04',
        image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=600&auto=format&fit=crop&q=80',
        pod: null,
        history: [
          { time: 'Yesterday', title: 'Shipping Label Created', detail: 'Processed by TechGear Logistics' },
          { time: '10:00 AM', title: 'Departed Regional Distribution Center', detail: 'Transit to Central Hub' }
        ]
      },
      {
        id: 'MB-48192',
        trackingNumber: '#MB-48192',
        type: 'letter',
        direction: 'incoming',
        sender: 'Metropolitan Bank',
        senderSubtitle: 'Financial Services Division',
        title: 'Annual Financial Statement 2024',
        weight: '45 g',
        dimensions: '22 × 11 cm',
        pickupPoint: 'Postbox #104 (Digital Scan)',
        terminal: 'Blantyre GPO',
        status: 'delivered',
        statusLabel: 'Delivered to Box 2h ago',
        eta: 'Delivered',
        deliveredTime: '2 hours ago',
        isDigitized: true,
        summary: 'Annual statement for Alex Banda. Closing balance: $14,290.00. Account in good standing with zero overdue balance.',
        digitalPages: 3,
        history: [
          { time: '08:00 AM', title: 'Physical Envelope Received at Sorting Desk', detail: 'Scanned via Optical Scanner' },
          { time: '08:15 AM', title: 'Digital Preview Rendered to Customer Box', detail: 'Encrypted document stored safely' }
        ]
      },
      {
        id: 'GOV-77102',
        trackingNumber: '#GOV-77102',
        type: 'letter',
        direction: 'incoming',
        sender: 'Gov Services (MRA)',
        senderSubtitle: 'Malawi Revenue Authority',
        title: 'Tax Registration Renewal Notice',
        weight: '30 g',
        dimensions: '22 × 11 cm',
        pickupPoint: 'Postbox #104 (Digital Scan)',
        terminal: 'Blantyre GPO',
        status: 'action_required',
        statusLabel: 'Action Required',
        eta: 'Due Nov 30',
        deliveredTime: 'Yesterday',
        isDigitized: true,
        summary: 'Notice of Tax Compliance & Annual Renewal Certificate. Please confirm filing before November 30 to avoid statutory penalties.',
        urgent: true,
        digitalPages: 2,
        history: [
          { time: 'Yesterday', title: 'Received from Government Printing Office', detail: 'Priority Official Dispatch' },
          { time: 'Yesterday', title: 'Action Flag Added', detail: 'Requires customer acknowledgement' }
        ]
      },
      {
        id: 'MW-MAG-204',
        trackingNumber: '#MW-MAG-204',
        type: 'magazine',
        direction: 'incoming',
        sender: 'African Geographic',
        senderSubtitle: 'Monthly Publications Group',
        title: 'African Wildlife & Science Digest - Nov Issue',
        weight: '280 g',
        dimensions: '28 × 21 cm',
        pickupPoint: 'Smart Locker #18',
        terminal: 'GPO Concourse',
        status: 'ready_pickup',
        statusLabel: 'Ready for Pickup',
        eta: 'Waiting in Locker',
        deliveredTime: 'Yesterday, 3:00 PM',
        history: [
          { time: 'Yesterday', title: 'Deposited into Smart Locker #18', detail: 'Pickup PIN sent to customer: 8291' }
        ]
      },
      {
        id: 'MW-OUT-8812',
        trackingNumber: '#MW-OUT-8812',
        type: 'package',
        direction: 'outgoing',
        sender: 'Alex Banda (You)',
        recipient: 'Dr. Chimwemwe Phiri',
        destination: 'Lilongwe Central Hospital, Box 149, Lilongwe',
        title: 'Diagnostic Lab Samples (Express Mail)',
        weight: '3.2 kg',
        dimensions: '25 × 20 × 15 cm',
        serviceType: 'Malawi Posts Express Courier',
        status: 'in_transit',
        statusLabel: 'Out for Inter-City Transit',
        eta: 'Tomorrow, 10:30 AM',
        deliveredTime: null,
        history: [
          { time: 'Today 11:30 AM', title: 'Courier Pickup Requested by Customer', detail: 'Van #04 collected from sender' },
          { time: 'Today 02:40 PM', title: 'En Route to Regional Hub (Lilongwe Express)', detail: 'Direct highway dispatch' }
        ]
      }
    ],
    lockers: [
      { id: 42, size: 'M', status: 'occupied', assignedItem: 'AZ-9921-X01', pin: '4291', customer: 'Alex Banda' },
      { id: 14, size: 'S', status: 'reserved', assignedItem: 'TG-90210', pin: '1402', customer: 'Alex Banda' },
      { id: 18, size: 'S', status: 'occupied', assignedItem: 'MW-MAG-204', pin: '8291', customer: 'Alex Banda' },
      { id: 1, size: 'L', status: 'available', assignedItem: null, pin: '---', customer: null },
      { id: 2, size: 'M', status: 'available', assignedItem: null, pin: '---', customer: null },
      { id: 3, size: 'S', status: 'available', assignedItem: null, pin: '---', customer: null },
      { id: 4, size: 'M', status: 'occupied', assignedItem: 'PKG-7711', pin: '9921', customer: 'Tawonga Moyo' },
      { id: 5, size: 'L', status: 'available', assignedItem: null, pin: '---', customer: null },
      { id: 6, size: 'S', status: 'occupied', assignedItem: 'DOC-1022', pin: '3184', customer: 'Grace Mvula' },
      { id: 7, size: 'M', status: 'available', assignedItem: null, pin: '---', customer: null },
      { id: 8, size: 'S', status: 'available', assignedItem: null, pin: '---', customer: null },
      { id: 9, size: 'L', status: 'occupied', assignedItem: 'BOX-9901', pin: '7120', customer: 'James Chirwa' }
    ],
    notifications: [
      { id: 1, title: 'Driver is on route!', text: 'Kondwani Banda is heading your way with package #AZ-9921-X01 (~8 mins)', time: 'Just now', unread: true },
      { id: 2, title: 'New Scanned Mail Available', text: 'Tax Registration Renewal Notice received and scanned into your Postbox', time: '1 hour ago', unread: true },
      { id: 3, title: 'Subscription Reminder', text: '12 days left on Premium Plus plan. Tap to renew.', time: '1 day ago', unread: false }
    ]
  };

  class PostboxStore {
    constructor() {
      this.state = this.loadState();
      this.subscribers = [];
      this.gpsTimer = null;

      // Broadcast channel for cross-tab communication
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          if (event.data && event.data.type === 'STATE_UPDATE') {
            this.state = event.data.payload;
            this.notifySubscribers('remote');
          }
        };
      }

      // If driver was active when loaded, resume simulation
      if (this.state.driver.isDriving) {
        this.startDriverRoute(false);
      }
    }

    loadState() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return Object.assign({}, defaultState, parsed);
        }
      } catch (e) {
        console.warn('Failed to parse saved Postbox state, using default', e);
      }
      return JSON.parse(JSON.stringify(defaultState));
    }

    saveState(broadcast = true) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        if (broadcast && this.channel) {
          this.channel.postMessage({ type: 'STATE_UPDATE', payload: this.state });
        }
      } catch (e) {
        console.error('Failed to save Postbox state', e);
      }
      this.notifySubscribers('local');
    }

    subscribe(fn) {
      this.subscribers.push(fn);
      // Immediately notify subscriber with current state
      fn(this.state, 'init');
      return () => {
        this.subscribers = this.subscribers.filter(s => s !== fn);
      };
    }

    notifySubscribers(source = 'local') {
      this.subscribers.forEach(fn => {
        try {
          fn(this.state, source);
        } catch (err) {
          console.error('Error in subscriber', err);
        }
      });
    }

    // Role Switcher
    setRole(role) {
      if (['customer', 'driver', 'admin'].includes(role)) {
        this.state.currentRole = role;
        this.saveState();
        if (window.PostboxAudio) window.PostboxAudio.play('click');
      }
    }

    // Driver Operations
    toggleDriverDriving() {
      if (this.state.driver.isDriving) {
        this.stopDriverRoute();
      } else {
        this.startDriverRoute(true);
      }
    }

    startDriverRoute(save = true) {
      this.state.driver.isDriving = true;
      this.state.driver.isOnDuty = true;
      if (save) this.saveState();

      if (this.gpsTimer) clearInterval(this.gpsTimer);

      this.gpsTimer = setInterval(() => {
        this.stepDriverGPS();
      }, 1500);

      if (window.PostboxAudio) window.PostboxAudio.play('beep');
    }

    stopDriverRoute() {
      this.state.driver.isDriving = false;
      if (this.gpsTimer) {
        clearInterval(this.gpsTimer);
        this.gpsTimer = null;
      }
      this.saveState();
      if (window.PostboxAudio) window.PostboxAudio.play('click');
    }

    stepDriverGPS() {
      const waypoints = this.state.routeWaypoints;
      if (!waypoints || waypoints.length < 2) return;

      let progress = this.state.driver.routeProgress + 0.04; // Step forward ~4% each tick

      if (progress >= 1.0) {
        progress = 1.0;
        this.stopDriverRoute();
        // Trigger Arrival notification
        this.markDriverArrived();
      }

      this.state.driver.routeProgress = progress;

      // Calculate current interpolated coordinate
      const totalSegments = waypoints.length - 1;
      const currentSegmentIndex = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);
      const segmentProgress = (progress * totalSegments) - currentSegmentIndex;

      const p1 = waypoints[currentSegmentIndex];
      const p2 = waypoints[currentSegmentIndex + 1];

      const curLat = p1.lat + (p2.lat - p1.lat) * segmentProgress;
      const curLng = p1.lng + (p2.lng - p1.lng) * segmentProgress;

      this.state.driver.currentCoords = [curLat, curLng];

      // Update ETA
      const remainingSegments = (1.0 - progress);
      const etaMinutes = Math.max(1, Math.round(remainingSegments * 12));
      const activeItem = this.getItemById(this.state.driver.activeItemId);
      if (activeItem) {
        activeItem.eta = progress >= 0.95 ? 'Driver has Arrived!' : `Arriving in ~${etaMinutes} mins`;
      }

      this.saveState();
    }

    markDriverArrived() {
      const activeItem = this.getItemById(this.state.driver.activeItemId);
      if (activeItem) {
        activeItem.eta = 'Driver has arrived at destination!';
        activeItem.statusLabel = 'Arrived • Awaiting Signature / Pickup';
      }

      this.addNotification({
        title: 'Driver Arrived! 🚚',
        text: 'Kondwani Banda has arrived at Locker #42 with your package #AZ-9921-X01',
        time: 'Just now',
        unread: true
      });

      if (window.PostboxAudio) window.PostboxAudio.play('arrival');
      this.saveState();
    }

    // Complete delivery with digital signature / photo
    confirmDelivery(itemId, signatureData, recipientName, note = '') {
      const item = this.getItemById(itemId);
      if (!item) return;

      item.status = 'delivered';
      item.statusLabel = 'Delivered & Verified';
      item.deliveredTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      item.pod = {
        timestamp: new Date().toISOString(),
        deliveredBy: this.state.driver.name,
        van: this.state.driver.van,
        recipientName: recipientName || this.state.user.name,
        signatureData: signatureData,
        note: note
      };

      item.history.push({
        time: item.deliveredTime,
        title: 'Package Handed Over & Signed',
        detail: `Verified by ${recipientName || this.state.user.name}`
      });

      this.state.driver.deliveriesCompletedToday += 1;
      this.stopDriverRoute();

      this.addNotification({
        title: 'Delivery Complete! 📦',
        text: `Package ${item.trackingNumber} successfully delivered and verified.`,
        time: 'Just now',
        unread: true
      });

      if (window.PostboxAudio) window.PostboxAudio.play('success');
      this.saveState();
    }

    verifyDelivery(itemId) {
      const item = this.getItemById(itemId);
      if (!item) return { success: false, reason: 'Package not found' };

      item.status = 'delivered';
      item.statusLabel = 'Delivered & Verified';
      item.deliveredTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      item.pod = {
        timestamp: new Date().toISOString(),
        deliveredBy: item.driverId ? this.state.driver.name : 'Customer scan verification',
        method: 'barcode_scan',
        recipientName: this.state.user.name,
        signatureData: null,
        note: 'Delivery confirmed from scanned parcel label'
      };
      item.history.push({
        time: item.deliveredTime,
        title: 'Delivery Verified by Barcode Scan',
        detail: `Confirmed by ${this.state.user.name}`
      });

      this.addNotification({
        title: 'Delivery verified',
        text: `${item.trackingNumber} has been marked as delivered and verified.`,
        time: 'Just now',
        unread: true
      });
      this.saveState();
      if (window.PostboxAudio) window.PostboxAudio.play('success');
      return { success: true, item };
    }

    // Smart Locker Unlock Simulation
    unlockLocker(lockerId) {
      const locker = this.state.lockers.find(l => l.id == lockerId);
      if (locker) {
        locker.status = 'available';
        const assignedItem = this.getItemById(locker.assignedItem);
        if (assignedItem) {
          assignedItem.status = 'delivered';
          assignedItem.statusLabel = 'Retrieved from Locker';
          assignedItem.deliveredTime = 'Just now';
        }

        if (window.PostboxAudio) window.PostboxAudio.play('unlock');
        this.saveState();
        return { success: true, lockerNumber: lockerId, pin: locker.pin };
      }
      return { success: false };
    }

    // Subscription Renewal & Payment
    renewSubscription(planType, cardData = {}) {
      if (planType === 'annual') {
        this.state.user.daysRemaining += 365;
        this.state.user.billingCycle = 'annual';
        this.state.user.price = 135.00;
      } else {
        this.state.user.daysRemaining += 30;
        this.state.user.billingCycle = 'monthly';
        this.state.user.price = 15.00;
      }
      this.state.user.subscriptionStatus = 'ACTIVE';

      this.addNotification({
        title: 'Subscription Renewed! ✨',
        text: `Your ${this.state.user.subscriptionTier} Postbox membership has been renewed. Days remaining: ${this.state.user.daysRemaining}.`,
        time: 'Just now',
        unread: true
      });

      if (window.PostboxAudio) window.PostboxAudio.play('payment');
      this.saveState();
    }

    // Outgoing Mail Creation
    createOutgoingItem(itemData) {
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const tracking = `#MW-OUT-${randNum}`;

      const newItem = {
        id: `MW-OUT-${randNum}`,
        trackingNumber: tracking,
        type: itemData.type || 'package',
        direction: 'outgoing',
        sender: `${this.state.user.name} (Postbox #104)`,
        recipient: itemData.recipientName || 'Recipient',
        destination: itemData.destinationAddress || 'Lilongwe GPO',
        title: itemData.description || 'Outgoing Parcel',
        weight: itemData.weight || '1.0 kg',
        dimensions: itemData.dimensions || '20 × 15 × 10 cm',
        serviceType: itemData.serviceType || 'Standard Post',
        status: 'in_transit',
        statusLabel: 'Shipment Created • Awaiting Courier Pickup',
        eta: 'Processing',
        deliveredTime: null,
        history: [
          { time: 'Just now', title: 'Shipment Label Generated by Customer', detail: 'QR Code verified and ready' }
        ]
      };

      this.state.mailItems.unshift(newItem);
      if (window.PostboxAudio) window.PostboxAudio.play('beep');
      this.saveState();
      return newItem;
    }

    // Admin Mail Intake
    intakeMail(itemData) {
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const tracking = `#MW-IN-${randNum}`;

      const newItem = {
        id: `MW-IN-${randNum}`,
        trackingNumber: tracking,
        type: itemData.type || 'letter',
        direction: 'incoming',
        sender: itemData.sender || 'Standard Sender',
        senderSubtitle: itemData.senderSubtitle || 'Postal Intake',
        title: itemData.title || 'Official Correspondence',
        weight: itemData.weight || '50 g',
        dimensions: 'Standard Letter',
        pickupPoint: 'Postbox #104 (Digital Scan)',
        status: itemData.urgent ? 'action_required' : 'delivered',
        statusLabel: itemData.urgent ? 'Action Required' : 'Delivered to Box',
        eta: 'In Postbox',
        deliveredTime: 'Just now',
        isDigitized: true,
        summary: itemData.summary || 'Letter digitized by sorting clerk.',
        urgent: !!itemData.urgent,
        history: [
          { time: 'Just now', title: 'Logged by Postmaster Chifundo Gondwe', detail: 'Digital scan uploaded' }
        ]
      };

      this.state.mailItems.unshift(newItem);
      this.addNotification({
        title: 'New Mail in Postbox! 📬',
        text: `From: ${newItem.sender} - ${newItem.title}`,
        time: 'Just now',
        unread: true
      });

      if (window.PostboxAudio) window.PostboxAudio.play('success');
      this.saveState();
      return newItem;
    }

    addNotification(notif) {
      notif.id = Date.now();
      this.state.notifications.unshift(notif);
      if (this.state.notifications.length > 20) {
        this.state.notifications.pop();
      }
    }

    getItemById(id) {
      if (!id) return null;
      const clean = id.replace('#', '');
      return this.state.mailItems.find(i => i.id === clean || i.trackingNumber === id || i.trackingNumber === `#${clean}`);
    }

    resetToDefaults() {
      this.state = JSON.parse(JSON.stringify(defaultState));
      this.saveState();
      if (window.PostboxAudio) window.PostboxAudio.play('beep');
    }
  }

  // Export singleton instance
  window.postboxStore = new PostboxStore();
})();
