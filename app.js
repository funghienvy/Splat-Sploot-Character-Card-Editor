/* ── Splat-Sploot — app.js ── */
(() => {
  'use strict';

  // ── State ──
  let cardData = null;
  let previewVisible = true;
  let isDirty = false;
  let lastSavedJSON = '';

  // ── DOM Shortcuts ──
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

  const landingScreen   = $('#landing-screen');
  const editorScreen    = $('#editor-screen');
  const dropZone        = $('#drop-zone');
  const fileInput       = $('#file-input');
  const cardNameDisplay = $('#card-name-display');
  const jsonSidebar     = $('#json-sidebar');
  const jsonOutput      = $('#json-output');
  const toastContainer  = $('#toast-container');

  // ── Theme ──
  // Default is light (matching splatsploot.info). Dark is the toggle option.
  function initTheme() {
    const saved = localStorage.getItem('splat-sploot-theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      updateThemeIcons('dark');
    } else {
      updateThemeIcons('light');
    }
  }
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    if (next === 'light') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    localStorage.setItem('splat-sploot-theme', next);
    updateThemeIcons(next);
  }
  function updateThemeIcons(theme) {
    const moon = $('#theme-icon-moon');
    const sun = $('#theme-icon-sun');
    if (theme === 'dark') {
      moon.style.display = 'none';
      sun.style.display = '';
    } else {
      moon.style.display = '';
      sun.style.display = 'none';
    }
  }

  // ── Default Card Template ──
  function blankCard() {
    const now = new Date().toISOString();
    return {
      name: '',
      description: '',
      personality: '',
      scenario: '',
      first_mes: '',
      mes_example: '',
      creatorcomment: '',
      avatar: 'none',
      talkativeness: '0.5',
      fav: false,
      tags: [],
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: '',
        description: '',
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
        creator_notes: '',
        system_prompt: '',
        post_history_instructions: '',
        tags: [],
        creator: '',
        character_version: '',
        alternate_greetings: [],
        extensions: {
          talkativeness: '0.5',
          fav: false,
          world: '',
          depth_prompt: { prompt: '', depth: 4, role: 'system' }
        },
        group_only_greetings: []
      },
      create_date: now
    };
  }

  // ── Deep get/set by dot-path ──
  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
  }
  function setPath(obj, path, val) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => {
      if (o[k] == null) o[k] = {};
      return o[k];
    }, obj);
    target[last] = val;
  }

  // ── Dirty Tracking ──
  function markDirty() {
    if (!isDirty) {
      isDirty = true;
      updateUnsavedIndicator();
    }
  }
  function markClean() {
    isDirty = false;
    lastSavedJSON = cardData ? JSON.stringify(cardData) : '';
    updateUnsavedIndicator();
  }
  function updateUnsavedIndicator() {
    const existing = $('.unsaved-dot');
    if (isDirty && !existing && cardData) {
      const dot = document.createElement('span');
      dot.className = 'unsaved-dot';
      dot.title = 'Unsaved changes';
      cardNameDisplay.parentElement.appendChild(dot);
    } else if (!isDirty && existing) {
      existing.remove();
    }
  }

  // ── Toast ──
  function toast(message, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    toastContainer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 2500);
  }

  // ── Screens ──
  function showEditor() {
    landingScreen.classList.add('hidden');
    editorScreen.classList.remove('hidden');
    populateForm();
    updatePreview();
    updateStatusBar();
    markClean();
  }
  function showLanding() {
    if (isDirty && !confirm('You have unsaved changes. Leave anyway?')) return;
    editorScreen.classList.add('hidden');
    landingScreen.classList.remove('hidden');
    cardData = null;
    isDirty = false;
  }

  // ── Import / Export ──
  function importFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        // Basic validation: accept if it has data.name or top-level name
        if (parsed.data || parsed.name !== undefined) {
          // Ensure data block exists
          if (!parsed.data) {
            parsed.data = {
              name: parsed.name || '',
              description: parsed.description || '',
              personality: parsed.personality || '',
              scenario: parsed.scenario || '',
              first_mes: parsed.first_mes || '',
              mes_example: parsed.mes_example || '',
              creator_notes: parsed.creatorcomment || '',
              system_prompt: '',
              post_history_instructions: '',
              tags: parsed.tags || [],
              creator: '',
              character_version: '',
              alternate_greetings: [],
              extensions: {
                talkativeness: parsed.talkativeness || '0.5',
                fav: parsed.fav || false,
                world: '',
                depth_prompt: { prompt: '', depth: 4, role: 'system' }
              },
              group_only_greetings: []
            };
          }
          // Ensure nested objects exist
          if (!parsed.data.extensions) {
            parsed.data.extensions = { talkativeness: '0.5', fav: false, world: '', depth_prompt: { prompt: '', depth: 4, role: 'system' } };
          }
          if (!parsed.data.extensions.depth_prompt) {
            parsed.data.extensions.depth_prompt = { prompt: '', depth: 4, role: 'system' };
          }
          if (!parsed.data.alternate_greetings) parsed.data.alternate_greetings = [];
          if (!parsed.data.group_only_greetings) parsed.data.group_only_greetings = [];
          if (!parsed.data.tags) parsed.data.tags = [];

          cardData = parsed;
          showEditor();
          toast('Card imported successfully');
        } else {
          toast('Invalid character card format', 'error');
        }
      } catch (err) {
        toast('Failed to parse JSON: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  function syncTopLevel() {
    // Sync top-level fields from data block for v1/v2 compatibility
    const d = cardData.data;
    cardData.name = d.name;
    cardData.description = d.description;
    cardData.personality = d.personality;
    cardData.scenario = d.scenario;
    cardData.first_mes = d.first_mes;
    cardData.mes_example = d.mes_example;
    cardData.creatorcomment = d.creator_notes;
    cardData.creator_notes = d.creator_notes;
    cardData.talkativeness = d.extensions.talkativeness;
    cardData.fav = d.extensions.fav;
    cardData.tags = [...d.tags];
  }

  function exportCard() {
    if (!cardData) return;
    syncTopLevel();
    const json = JSON.stringify(cardData, null, 4);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = cardData.data.name || 'character';
    a.download = name.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Card exported as ' + a.download);
    markClean();
  }

  // ── Populate Form ──
  function populateForm() {
    if (!cardData) return;
    const d = cardData.data;

    // Simple fields via data-path
    $$('[data-path]').forEach(el => {
      const val = getPath(cardData, el.dataset.path);
      if (el.tagName === 'SELECT') {
        el.value = val || el.options[0].value;
      } else if (el.type === 'number') {
        el.value = val != null ? val : 0;
      } else {
        el.value = val || '';
      }
      updateCharCount(el);
    });

    // Card name in header
    cardNameDisplay.textContent = d.name || 'Untitled';

    // Talkativeness
    const talk = parseFloat(d.extensions.talkativeness) || 0.5;
    $('#f-talkativeness').value = talk;
    $('#talkativeness-display').textContent = talk.toFixed(2);

    // Favorite
    const favBtn = $('#f-fav');
    const isFav = d.extensions.fav === true || d.extensions.fav === 'true';
    favBtn.classList.toggle('active', isFav);
    favBtn.setAttribute('aria-checked', isFav);
    $('#fav-label').textContent = isFav ? 'Yes' : 'No';

    // Read-only
    $('#f-spec').value = `${cardData.spec || 'chara_card_v3'} v${cardData.spec_version || '3.0'}`;
    $('#f-created').value = cardData.create_date || '';

    // Tags
    renderTags();

    // Greetings
    renderGreetings('alt-greetings-list', d.alternate_greetings);
    renderGreetings('group-greetings-list', d.group_only_greetings);
  }

  // ── Char Count ──
  function updateCharCount(el) {
    const id = el.id;
    if (!id) return;
    const map = {
      'f-description': 'cc-description',
      'f-personality': 'cc-personality',
      'f-scenario': 'cc-scenario',
      'f-first_mes': 'cc-first_mes',
      'f-mes_example': 'cc-mes_example',
      'f-system_prompt': 'cc-system_prompt',
      'f-post_history': 'cc-post_history',
      'f-depth-prompt': 'cc-depth_prompt',
      'f-creator_notes': 'cc-creator_notes'
    };
    const ccId = map[id];
    if (ccId) {
      const counter = $('#' + ccId);
      if (counter) {
        const len = (el.value || '').length;
        const words = (el.value || '').trim() ? (el.value || '').trim().split(/\s+/).length : 0;
        counter.textContent = `${len} chars · ${words} words`;
      }
    }
  }

  // ── Status Bar ──
  function updateStatusBar() {
    if (!cardData) return;
    const d = cardData.data;

    const specEl = $('#status-spec');
    const fieldEl = $('#status-field-count');
    const charsEl = $('#status-total-chars');

    if (specEl) specEl.textContent = cardData.spec || 'chara_card_v3';

    // Count populated fields
    const fields = ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'creator_notes', 'system_prompt', 'post_history_instructions'];
    const filled = fields.filter(f => (d[f] || '').trim().length > 0).length;
    if (fieldEl) fieldEl.textContent = `${filled}/${fields.length} fields`;

    // Total character count
    const total = fields.reduce((sum, f) => sum + (d[f] || '').length, 0);
    if (charsEl) charsEl.textContent = `${total.toLocaleString()} total chars`;
  }

  // ── Tags ──
  function renderTags() {
    const list = $('#tags-list');
    list.innerHTML = '';
    (cardData.data.tags || []).forEach((tag, i) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `${escHtml(tag)}<button data-idx="${i}" title="Remove tag">&times;</button>`;
      list.appendChild(chip);
    });
  }
  function addTag(text) {
    const t = text.trim();
    if (!t || cardData.data.tags.includes(t)) return;
    cardData.data.tags.push(t);
    renderTags();
    updatePreview();
    markDirty();
  }
  function removeTag(idx) {
    cardData.data.tags.splice(idx, 1);
    renderTags();
    updatePreview();
    markDirty();
  }

  // ── Greetings ──
  function renderGreetings(containerId, arr) {
    const container = $('#' + containerId);
    container.innerHTML = '';
    arr.forEach((text, i) => {
      const item = document.createElement('div');
      item.className = 'greeting-item';
      item.innerHTML = `
        <div class="greeting-item-header">
          <span>${containerId.includes('alt') ? 'Alternate' : 'Group'} Greeting #${i + 1}</span>
          <button class="btn btn-danger-ghost remove-greeting" data-container="${containerId}" data-idx="${i}">Remove</button>
        </div>
        <textarea data-container="${containerId}" data-idx="${i}" rows="4">${escHtml(text)}</textarea>
      `;
      container.appendChild(item);
    });
  }
  function getGreetingArray(containerId) {
    return containerId.includes('alt')
      ? cardData.data.alternate_greetings
      : cardData.data.group_only_greetings;
  }

  // ── JSON Preview ──
  function updatePreview() {
    if (!cardData || !previewVisible) return;
    syncTopLevel();
    const json = JSON.stringify(cardData, null, 2);
    jsonOutput.innerHTML = syntaxHighlight(json);
    updateStatusBar();
  }
  function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(
      /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? 'json-key' : 'json-string';
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  }

  // ── Utility ──
  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ── Event Wiring ──
  function init() {
    // Theme
    initTheme();
    $('#theme-toggle').addEventListener('click', toggleTheme);

    // Drop zone
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.json')) importFile(file);
      else toast('Please drop a .json file', 'error');
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) importFile(e.target.files[0]);
      e.target.value = '';
    });

    // New card
    $('#create-new-btn').addEventListener('click', () => {
      cardData = blankCard();
      showEditor();
      toast('New card created');
    });

    // Back
    $('#back-btn').addEventListener('click', showLanding);

    // Import from editor
    $('#import-btn').addEventListener('click', () => fileInput.click());

    // Export
    $('#export-btn').addEventListener('click', exportCard);

    // Preview toggle
    $('#preview-toggle-btn').addEventListener('click', () => {
      previewVisible = !previewVisible;
      jsonSidebar.classList.toggle('collapsed', !previewVisible);
      $('#preview-toggle-btn').classList.toggle('active', previewVisible);
      if (previewVisible) updatePreview();
    });

    // Copy JSON
    $('#copy-json-btn').addEventListener('click', () => {
      if (!cardData) return;
      syncTopLevel();
      navigator.clipboard.writeText(JSON.stringify(cardData, null, 4))
        .then(() => toast('JSON copied to clipboard'))
        .catch(() => toast('Failed to copy', 'error'));
    });

    // Tabs
    $$('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.tab-btn').forEach(b => b.classList.remove('active'));
        $$('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        $(`#panel-${btn.dataset.tab}`).classList.add('active');
      });
    });

    // Form inputs (data-path binding)
    $$('[data-path]').forEach(el => {
      const evt = (el.tagName === 'SELECT') ? 'change' : 'input';
      el.addEventListener(evt, () => {
        if (!cardData) return;
        let val = el.value;
        if (el.type === 'number') val = parseInt(val, 10) || 0;
        setPath(cardData, el.dataset.path, val);

        // Update card name display
        if (el.dataset.path === 'data.name') {
          cardNameDisplay.textContent = val || 'Untitled';
        }

        updateCharCount(el);
        updatePreview();
        markDirty();
      });
    });

    // Talkativeness slider
    $('#f-talkativeness').addEventListener('input', (e) => {
      if (!cardData) return;
      const v = parseFloat(e.target.value);
      cardData.data.extensions.talkativeness = v.toString();
      $('#talkativeness-display').textContent = v.toFixed(2);
      updatePreview();
      markDirty();
    });

    // Favorite toggle
    $('#f-fav').addEventListener('click', () => {
      if (!cardData) return;
      const cur = cardData.data.extensions.fav;
      const next = !cur;
      cardData.data.extensions.fav = next;
      $('#f-fav').classList.toggle('active', next);
      $('#f-fav').setAttribute('aria-checked', next);
      $('#fav-label').textContent = next ? 'Yes' : 'No';
      updatePreview();
      markDirty();
    });

    // Tags
    $('#tag-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTag(e.target.value);
        e.target.value = '';
      }
    });
    $('#tags-list').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-idx]');
      if (btn) removeTag(parseInt(btn.dataset.idx, 10));
    });

    // Add alternate greeting
    $('#add-alt-greeting').addEventListener('click', () => {
      if (!cardData) return;
      cardData.data.alternate_greetings.push('');
      renderGreetings('alt-greetings-list', cardData.data.alternate_greetings);
      updatePreview();
      markDirty();
    });

    // Add group greeting
    $('#add-group-greeting').addEventListener('click', () => {
      if (!cardData) return;
      cardData.data.group_only_greetings.push('');
      renderGreetings('group-greetings-list', cardData.data.group_only_greetings);
      updatePreview();
      markDirty();
    });

    // Greeting edit & remove (delegated)
    document.addEventListener('input', (e) => {
      if (e.target.matches('.greeting-item textarea')) {
        const cid = e.target.dataset.container;
        const idx = parseInt(e.target.dataset.idx, 10);
        const arr = getGreetingArray(cid);
        arr[idx] = e.target.value;
        updatePreview();
        markDirty();
      }
    });
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.remove-greeting');
      if (btn) {
        const cid = btn.dataset.container;
        const idx = parseInt(btn.dataset.idx, 10);
        const arr = getGreetingArray(cid);
        arr.splice(idx, 1);
        renderGreetings(cid, arr);
        updatePreview();
        markDirty();
      }
    });

    // Keyboard shortcut: Ctrl/Cmd+S to export
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (cardData) exportCard();
      }
    });

    // Warn before unload if dirty
    window.addEventListener('beforeunload', (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  // ── Boot ──
  document.addEventListener('DOMContentLoaded', init);
})();
