"use strict";
(() => {
  const MEASUREMENT_ID = "G-C7QV2JBGPY";
  if (window.__mobunagaGaLoaded) return;
  window.__mobunagaGaLoaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(script);
})();
