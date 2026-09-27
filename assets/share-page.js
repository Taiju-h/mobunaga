"use strict";
(() => {
  // Open the existing detailed view directly; the server page keeps OGP metadata
  // and a normal link for clients without JavaScript.
  const link = document.querySelector("#open-detail");
  if (link) {
    const target = new URL(link.href, location.href);
    if (target.origin === location.origin && target.searchParams.has("open")) {
      location.replace(target.href);
    }
  }
})();
