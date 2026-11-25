# Postbox · Malawi Posts

Responsive React + Vite implementation of the Postbox customer, delivery-courier and hub-supervisor workflows.

## Run locally

```sh
npm install
npm run dev
```

For a production build, use `npm run build`.

The app stores its demo data in browser local storage. Delivery scanning uses the browser `BarcodeDetector` API when available and camera permission is granted; manual tracking-number lookup is available as a fallback. Checkout is a local demo and does not collect card data or submit payments.
