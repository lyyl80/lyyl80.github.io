(function() {
  'use strict';

  // Theme Toggle
  var html = document.documentElement;
  var themeBtn = document.querySelector('.theme-toggle');

  // Check system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    html.setAttribute('data-theme', 'dark');
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', function() {
      var current = html.getAttribute('data-theme');
      html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
    });
  }

  // Mobile sidebar toggle
  var mobileBtn = document.querySelector('.mobile-toggle');
  var sidebar = document.querySelector('.sidebar');
  var overlay = document.querySelector('.sidebar-overlay');

  if (mobileBtn) {
    mobileBtn.addEventListener('click', function() {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', function() {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }

  // Keyboard shortcut: Ctrl+K to focus search
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      var searchInput = document.getElementById('sidebar-search-input');
      if (searchInput) searchInput.focus();
    }
  });

  // Sidebar search: redirect to search page
  var searchInput = document.getElementById('sidebar-search-input');
  if (searchInput) {
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && this.value.trim()) {
        window.location.href = '/search/?q=' + encodeURIComponent(this.value.trim());
      }
    });
  }

  // Smooth page transitions (fade in on load)
  var contentBody = document.querySelector('.content-body');
  if (contentBody) {
    contentBody.style.opacity = '0';
    contentBody.style.transform = 'translateY(12px)';
    contentBody.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    requestAnimationFrame(function() {
      contentBody.style.opacity = '1';
      contentBody.style.transform = 'translateY(0)';
    });
  }

  // Active sidebar link based on current URL
  var currentPath = window.location.pathname;
  var navLinks = document.querySelectorAll('.sidebar-nav a');
  navLinks.forEach(function(link) {
    link.classList.remove('active');
    var href = link.getAttribute('href');
    if (href === currentPath || (href !== '/' && currentPath.startsWith(href))) {
      link.classList.add('active');
    }
  });
  // Default: if on homepage, activate first link
  if (currentPath === '/' || currentPath === '') {
    var firstLink = document.querySelector('.sidebar-nav a');
    if (firstLink) firstLink.classList.add('active');
  }

  // ===== Search Page Logic =====
  var searchPageInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');
  var searchIndex = null;

  if (searchPageInput && searchResults) {
    // Load search index
    fetch('/index.json')
      .then(function(r) { return r.json(); })
      .then(function(data) { searchIndex = data; doSearch(); })
      .catch(function() { searchResults.innerHTML = '<p style="text-align:center;color:var(--color-fg-muted)">搜索索引加载失败</p>'; });

    // Read ?q= from URL on load
    var params = new URLSearchParams(window.location.search);
    var initialQuery = params.get('q') || '';
    if (initialQuery) {
      searchPageInput.value = initialQuery;
    }

    // Search on input
    searchPageInput.addEventListener('input', function() {
      doSearch();
    });

    // Tag hint clicks
    document.querySelectorAll('.search-hints .hint').forEach(function(hint) {
      hint.addEventListener('click', function() {
        var tag = this.getAttribute('data-tag');
        searchPageInput.value = tag;
        doSearch();
      });
    });

    function doSearch() {
      if (!searchIndex) return;
      var q = searchPageInput.value.trim().toLowerCase();
      searchResults.innerHTML = '';

      if (!q) {
        searchResults.innerHTML = '<div class="search-results-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>输入关键词开始搜索</p></div>';
        return;
      }

      var results = searchIndex.filter(function(item) {
        return item.title.toLowerCase().indexOf(q) !== -1 ||
               item.content.toLowerCase().indexOf(q) !== -1 ||
               (item.tags && item.tags.some(function(t) { return t.toLowerCase().indexOf(q) !== -1; }));
      });

      if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-results-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>没有找到相关文章</p><span class="suggestion">试试其他关键词</span></div>';
        return;
      }

      var html = '<div class="search-count">找到 ' + results.length + ' 篇相关文章</div>';
      results.forEach(function(item) {
        var snippet = item.content.substring(0, 200).replace(/[\n\r]/g, ' ');
        // Highlight matching text
        var regex = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        snippet = snippet.replace(regex, '<mark>$1</mark>');
        var title = item.title.replace(regex, '<mark>$1</mark>');
        var tags = item.tags ? item.tags.join(' · ') : '';
        html += '<a href="' + item.url + '" class="search-result-item">' +
                  '<h3>' + title + '</h3>' +
                  '<div class="result-meta">' + item.date + (tags ? ' · ' + tags : '') + '</div>' +
                  '<div class="result-snippet">' + snippet + '</div>' +
                '</a>';
      });
      searchResults.innerHTML = html;
    }

    // Run initial search if query exists
    if (initialQuery && searchIndex) doSearch();
  }
})();
