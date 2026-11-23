// Postbox Interactive Leaflet Map for Real-Time Courier Tracking
// Displays driver van, customer drop-off pin, depot, and animated route progress

(function () {
  class PostboxLiveMap {
    constructor(elementId, options = {}) {
      this.elementId = elementId;
      this.options = Object.assign({
        interactive: true,
        showControls: true,
        zoom: 14,
        role: 'customer' // 'customer' or 'driver'
      }, options);

      this.map = null;
      this.vanMarker = null;
      this.destMarker = null;
      this.depotMarker = null;
      this.routePolyline = null;
      this.passedPolyline = null;
      this.lastCoords = null;

      this.init();
    }

    init() {
      const container = document.getElementById(this.elementId);
      if (!container || typeof L === 'undefined') {
        console.warn('Map container or Leaflet not available:', this.elementId);
        return;
      }

      // Avoid double initialization
      if (container._leaflet_id) {
        return;
      }

      const store = window.postboxStore;
      const waypoints = store ? store.state.routeWaypoints : [];
      const center = waypoints.length ? [waypoints[2].lat, waypoints[2].lng] : [-15.7942, 35.0135];

      // Create Leaflet map instance
      this.map = L.map(this.elementId, {
        center: center,
        zoom: this.options.zoom,
        zoomControl: false,
        attributionControl: false
      });

      // Warm custom map tiles (CartoDB Positron / OSM clean tiles)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(this.map);

      // Custom Zoom Control placed neatly
      if (this.options.showControls) {
        L.control.zoom({ position: 'topright' }).addTo(this.map);
      }

      // Draw initial waypoints & route
      this.setupRoute();

      // Listen to store updates
      if (store) {
        this.unsubscribe = store.subscribe((state) => {
          this.updateFromState(state);
        });
      }

      // Invalidate size after animation
      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, 300);
    }

    setupRoute() {
      const store = window.postboxStore;
      if (!store) return;

      const waypoints = store.state.routeWaypoints;
      const latlngs = waypoints.map(w => [w.lat, w.lng]);

      // Route Polyline (Remaining Path)
      this.routePolyline = L.polyline(latlngs, {
        color: '#AF101A',
        weight: 5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '8, 8'
      }).addTo(this.map);

      // Depot Marker (Origin)
      const depotIcon = L.divIcon({
        className: 'custom-depot-marker',
        html: `
          <div class="w-8 h-8 rounded-full bg-[#271816] text-white flex items-center justify-center shadow-lg border-2 border-white">
            <span class="material-symbols-outlined text-sm">domain</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      const first = waypoints[0];
      this.depotMarker = L.marker([first.lat, first.lng], { icon: depotIcon })
        .bindPopup(`<b>Blantyre GPO Central Depot</b><br>Origin of dispatch`)
        .addTo(this.map);

      // Destination Marker (Customer Postbox / Home)
      const destIcon = L.divIcon({
        className: 'custom-dest-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-8 h-8 rounded-full bg-[#AF101A]/30 animate-ping"></span>
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-[#AF101A] to-[#D32F2F] text-white flex items-center justify-center shadow-xl border-2 border-white z-10">
              <span class="material-symbols-outlined text-base">home_pin</span>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      const last = waypoints[waypoints.length - 1];
      this.destMarker = L.marker([last.lat, last.lng], { icon: destIcon })
        .bindPopup(`<b>Your Drop-Off Location</b><br>Locker #42 / Sunnyside Area`)
        .addTo(this.map);

      // Driver Van Marker
      this.createVanMarker(store.state.driver.currentCoords);

      // Fit map bounds to encompass route nicely
      this.map.fitBounds(this.routePolyline.getBounds(), { padding: [40, 40] });
    }

    createVanMarker(coords) {
      const heading = this.calculateBearing(this.lastCoords || coords, coords) || 45;
      const vanIcon = L.divIcon({
        className: 'custom-van-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group">
            <div class="absolute -inset-2 bg-[#AF101A]/20 rounded-full blur-sm animate-pulse"></div>
            <div id="van-icon-inner" style="transform: rotate(${heading}deg); transition: transform 0.5s ease;"
                 class="w-11 h-11 rounded-full bg-[#AF101A] text-white flex items-center justify-center shadow-2xl border-2 border-white ring-4 ring-[#AF101A]/20">
              <span class="material-symbols-outlined text-xl">local_shipping</span>
            </div>
            <div class="absolute -top-7 whitespace-nowrap bg-[#271816] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md pointer-events-none">
              Van #04
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      this.vanMarker = L.marker(coords, { icon: vanIcon, zIndexOffset: 1000 }).addTo(this.map);
      this.vanMarker.bindPopup(`
        <div class="p-1 font-['Inter']">
          <p class="font-bold text-[#AF101A] font-['Manrope']">Driver: Kondwani Banda</p>
          <p class="text-xs text-gray-700">Vehicle: Van #04 • En Route</p>
          <p class="text-xs text-gray-500 mt-1">Status: Active GPS Broadcast</p>
        </div>
      `);
      this.lastCoords = coords;
    }

    updateFromState(state) {
      if (!this.map || !this.vanMarker) return;

      const coords = state.driver.currentCoords;
      if (!coords || !coords[0]) return;

      // Update bearing angle
      if (this.lastCoords) {
        const bearing = this.calculateBearing(this.lastCoords, coords);
        const inner = document.getElementById('van-icon-inner');
        if (inner && bearing !== null) {
          inner.style.transform = `rotate(${bearing}deg)`;
        }
      }

      // Smoothly animate marker to new position
      this.vanMarker.setLatLng(coords);
      this.lastCoords = coords;

      // Update popup if open
      if (this.vanMarker.isPopupOpen()) {
        const activeItem = state.mailItems.find(i => i.id === state.driver.activeItemId);
        this.vanMarker.setPopupContent(`
          <div class="p-1 font-['Inter']">
            <p class="font-bold text-[#AF101A] font-['Manrope']">Driver: ${state.driver.name}</p>
            <p class="text-xs text-gray-700">${state.driver.van}</p>
            <p class="text-xs text-[#AF101A] font-semibold mt-1">${activeItem ? activeItem.eta : 'On Route'}</p>
          </div>
        `);
      }
    }

    calculateBearing(start, end) {
      if (!start || !end) return 0;
      const lat1 = start[0] * Math.PI / 180;
      const lat2 = end[0] * Math.PI / 180;
      const dLon = (end[1] - start[1]) * Math.PI / 180;

      const y = Math.sin(dLon) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      const brng = Math.atan2(y, x) * 180 / Math.PI;
      return (brng + 360) % 360;
    }

    recenterOnVan() {
      if (this.map && this.vanMarker) {
        this.map.panTo(this.vanMarker.getLatLng(), { animate: true, duration: 0.8 });
      }
    }

    recenterOnDestination() {
      if (this.map && this.destMarker) {
        this.map.panTo(this.destMarker.getLatLng(), { animate: true, duration: 0.8 });
      }
    }

    fitRoute() {
      if (this.map && this.routePolyline) {
        this.map.fitBounds(this.routePolyline.getBounds(), { padding: [40, 40] });
      }
    }

    destroy() {
      if (this.unsubscribe) {
        this.unsubscribe();
      }
      if (this.map) {
        this.map.remove();
        this.map = null;
      }
    }
  }

  window.PostboxLiveMap = PostboxLiveMap;
})();
