(async function () {
  const watcherCounts = {}; // Stores watcher count per slug
  const activeSockets = {}; // Keep track of active WebSockets
  let pendingSlugs = new Set();
  let activeRequests = 0;
  const DELAY_BETWEEN_REQUESTS = 50;
  let topQuestions = [];

  function fetchWatcherCount(slug) {
    if (watcherCounts[slug] !== undefined || activeSockets[slug]) return;

    updateUI(slug, "⏳");

    const ws = new WebSocket(
      `wss://collaboration-ws.leetcode.com/problems/${slug}`,
    );

    activeSockets[slug] = ws;

    ws.onmessage = function (event) {
      try {
        const data = JSON.parse(event.data);
        watcherCounts[slug] = data;
        // updateTopQuestions();
        updateUI(slug, data);
      } catch (error) {
        console.error(`Error parsing WebSocket message for ${slug}:`, error);
      }
    };

    ws.onerror = function (error) {
      console.error("WebSocket error for:", slug, error);
    };

    ws.onclose = function () {
      delete activeSockets[slug];
    };
  }

  function updateTopQuestions() {
    topQuestions = Object.entries(watcherCounts)
      .sort((a, b) => b[1] - a[1]) // Sort by count (descending)
      .slice(0, 5) // Get top 5
      .map(([slug]) => slug);
  }

  function updateUI(slug, count) {
    document
      .querySelectorAll(`a[href*="/problems/${slug}/"]`)
      .forEach((link) => {
        let watcherSpan = link.parentElement.querySelector(".watcher-count");
        if (!watcherSpan) {
          watcherSpan = document.createElement("span");
          watcherSpan.className = "watcher-count";
          watcherSpan.style.marginLeft = "10px";
          watcherSpan.style.fontWeight = "bold";
          link.parentElement.appendChild(watcherSpan);
        }

        watcherSpan.textContent = `${count}`;

        // Highlight top 5
        if (topQuestions.includes(slug)) {
          watcherSpan.style.color = "red";
          watcherSpan.style.fontSize = "14px";
        } else {
          watcherSpan.style.color = "green";
          watcherSpan.style.fontSize = "12px";
        }
      });
  }

  function triggerRequests() {
    if (activeRequests > 0 || pendingSlugs.size === 0) return;

    activeRequests++;
    const slug = pendingSlugs.values().next().value;
    pendingSlugs.delete(slug);

    fetchWatcherCount(slug);

    setTimeout(() => {
      activeRequests--;
      triggerRequests();
    }, DELAY_BETWEEN_REQUESTS);
  }

  function queueRequests() {
    document
      .querySelectorAll("a[href^='/problems/']:not([href$='/solution'])")
      .forEach((link) => {
        const slug = link.href.split("/problems/")[1].replace("/", "");
        if (!watcherCounts[slug] && !activeSockets[slug]) {
          pendingSlugs.add(slug);
        }
      });
    triggerRequests();
  }

  const observer = new MutationObserver(queueRequests);
  observer.observe(document.body, { childList: true, subtree: true });

  queueRequests();
})();
