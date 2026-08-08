(function () {
  var storageKey = 'trae-4s-market-workbench-v1';
  var archiveKey = 'trae-4s-market-workbench-archives-v1';
  var activeDateKey = 'trae-4s-market-workbench-active-date-v1';
  var systemDateKey = 'trae-4s-market-workbench-system-date-v1';
  var saveStatus = document.querySelector('[data-save-status]');
  var activeDateInput = document.querySelector('[data-active-date]');
  var backupFileInput = document.querySelector('[data-backup-file]');
  var fields = Array.prototype.slice.call(document.querySelectorAll('[data-save]'));
  var metricKeys = [
    'metric-nm-leads', 'metric-nm-arrivals', 'metric-nm-orders',
    'metric-nm-sessions', 'metric-nm-views', 'metric-nm-video-leads',
    'metric-video-douyin-new', 'metric-video-douyin-old', 'metric-video-kuaishou', 'metric-video-shipinhao', 'metric-video-wangyueche',
    'metric-ws-dcd', 'metric-ws-yiche', 'metric-ws-arrivals', 'metric-ws-orders',
    'metric-show-first'
  ];
  var monthlyTargets = {
    'metric-nm-leads': 200, 'metric-nm-arrivals': 20, 'metric-nm-orders': 4,
    'metric-nm-sessions': 0, 'metric-nm-views': 0, 'metric-nm-video-leads': 0,
    'metric-video-douyin-new': 0, 'metric-video-douyin-old': 0, 'metric-video-kuaishou': 0, 'metric-video-shipinhao': 0, 'metric-video-wangyueche': 0,
    'metric-ws-dcd': 600, 'metric-ws-yiche': 600, 'metric-ws-arrivals': 36, 'metric-ws-orders': 7.2,
    'metric-show-first': 140
  };

  function clearMetricsInState(state) {
    metricKeys.forEach(function (key) { state[key] = ''; });
  }

  function todayText() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (e) {
      return {};
    }
  }

  function readArchives() {
    try {
      return JSON.parse(localStorage.getItem(archiveKey) || '{}');
    } catch (e) {
      return {};
    }
  }

  function writeArchives(archives) {
    localStorage.setItem(archiveKey, JSON.stringify(archives));
  }

  function getActiveDate() {
    return (activeDateInput && activeDateInput.value) || localStorage.getItem(activeDateKey) || todayText();
  }

  function setActiveDate(date) {
    var safeDate = date || todayText();
    localStorage.setItem(activeDateKey, safeDate);
    if (activeDateInput) activeDateInput.value = safeDate;
  }

  function writeState(state) {
    localStorage.setItem(storageKey, JSON.stringify(state));
    if (saveStatus) {
      saveStatus.textContent = '已自动保存';
      window.clearTimeout(writeState.timer);
      writeState.timer = window.setTimeout(function () {
        saveStatus.textContent = '本地保存中';
      }, 1400);
    }
  }

  function collectStateFromFields(date) {
    var state = readState();
    fields.forEach(function (el) {
      state[el.getAttribute('data-save')] = getValue(el);
    });
    state.__date = date || getActiveDate();
    state.__savedAt = new Date().toISOString();
    return state;
  }

  function getValue(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.isContentEditable) return el.innerHTML;
    return el.value;
  }

  function setValue(el, value) {
    if (typeof value === 'undefined') return;
    if (el.type === 'checkbox') {
      el.checked = Boolean(value);
    } else if (el.isContentEditable) {
      el.innerHTML = value;
    } else {
      el.value = value;
    }
  }

  function saveAll() {
    var state = collectStateFromFields();
    writeState(state);
    saveArchiveForDate(getActiveDate(), state, false);
    if (window.CloudSync) window.CloudSync.push();
  }

  function loadAll(state) {
    var nextState = state || readState();
    fields.forEach(function (el) {
      setValue(el, nextState[el.getAttribute('data-save')]);
    });
  }

  function clearAllFields() {
    fields.forEach(function (el) {
      if (el.type === 'checkbox') {
        el.checked = false;
      } else if (el.isContentEditable) {
        el.innerHTML = '';
      } else {
        el.value = '';
      }
    });
  }

  function bindEditableTables() {
    document.querySelectorAll('td[contenteditable="true"]').forEach(function (cell, index) {
      if (!cell.getAttribute('data-save')) {
        cell.setAttribute('data-save', 'cell-' + index);
        fields.push(cell);
      }
      cell.addEventListener('input', saveAll);
    });
  }

  function hasMeaningfulValue(state) {
    return Object.keys(state).some(function (key) {
      if (key.indexOf('__') === 0) return false;
      var value = state[key];
      if (typeof value === 'boolean') return value;
      if (value === null || typeof value === 'undefined') return false;
      return String(value).replace(/<[^>]*>/g, '').trim() !== '';
    });
  }

  function saveArchiveForDate(date, state, showAlert) {
    if (!date || !hasMeaningfulValue(state)) return;
    var archives = readArchives();
    archives[date] = {
      savedAt: new Date().toISOString(),
      state: state
    };
    writeArchives(archives);
    if (showAlert) {
      alert('已保存 ' + date + ' 的工作台存档。');
    }
  }

  function cloneStateForDate(state, date) {
    var nextState = JSON.parse(JSON.stringify(state || {}));
    nextState.__date = date;
    nextState.__savedAt = new Date().toISOString();
    return nextState;
  }

  function findLatestMeaningfulArchiveBefore(date) {
    var archives = readArchives();
    return Object.keys(archives)
      .filter(function (itemDate) {
        return itemDate < date && archives[itemDate] && hasMeaningfulValue(archives[itemDate].state || {});
      })
      .sort()
      .reverse()[0] || '';
  }

  function carryForwardToDate(date) {
    var archives = readArchives();
    if (archives[date] && hasMeaningfulValue(archives[date].state || {})) return false;

    var sourceDate = findLatestMeaningfulArchiveBefore(date);
    if (!sourceDate) return false;

    var carriedState = cloneStateForDate(archives[sourceDate].state || {}, date);
    clearMetricsInState(carriedState);
    archives[date] = {
      savedAt: new Date().toISOString(),
      carriedFrom: sourceDate,
      state: carriedState
    };
    writeArchives(archives);
    writeState(carriedState);
    setActiveDate(date);
    clearAllFields();
    loadAll(carriedState);
    if (saveStatus) saveStatus.textContent = '已从 ' + sourceDate + ' 延续到 ' + date;
    return true;
  }

  function loadDate(date) {
    var archives = readArchives();
    clearAllFields();
    if (archives[date] && archives[date].state) {
      loadAll(archives[date].state);
      writeState(archives[date].state);
      if (saveStatus) saveStatus.textContent = '已加载 ' + date;
    } else {
      if (date === todayText() && carryForwardToDate(date)) return;
      writeState({ __date: date, __savedAt: new Date().toISOString() });
      if (saveStatus) saveStatus.textContent = '新日期，待填写';
    }
  }

  function initializeDateState() {
    var today = todayText();
    var lastSystemDate = localStorage.getItem(systemDateKey);
    var storedActiveDate = localStorage.getItem(activeDateKey) || today;
    var existingState = readState();

    if (lastSystemDate && lastSystemDate !== today) {
      var previousDate = existingState.__date || storedActiveDate || lastSystemDate;
      if (hasMeaningfulValue(existingState)) {
        saveArchiveForDate(previousDate, existingState, false);
      }

      var archives = readArchives();
      if (archives[today] && archives[today].state) {
        setActiveDate(today);
        writeState(archives[today].state);
        loadDate(today);
        if (saveStatus) saveStatus.textContent = '已切换到今天';
      } else if (hasMeaningfulValue(existingState)) {
        var carriedState = cloneStateForDate(existingState, today);
        clearMetricsInState(carriedState);
        archives[today] = {
          savedAt: new Date().toISOString(),
          state: carriedState
        };
        writeArchives(archives);
        setActiveDate(today);
        writeState(carriedState);
        loadAll(carriedState);
        if (saveStatus) saveStatus.textContent = '已延续到今天';
      } else {
        setActiveDate(today);
        if (!carryForwardToDate(today)) loadDate(today);
      }
    } else {
      setActiveDate(storedActiveDate);
      if (hasMeaningfulValue(existingState)) {
        saveArchiveForDate(existingState.__date || getActiveDate(), existingState, false);
      }
      if (getActiveDate() === today && !hasMeaningfulValue(readArchives()[today] && readArchives()[today].state || {}) && carryForwardToDate(today)) {
        return localStorage.setItem(systemDateKey, today);
      }
      loadDate(getActiveDate());
    }

    localStorage.setItem(systemDateKey, today);
  }

  function exportText() {
    var lines = [];
    lines.push('4S店市场经理工作台');
    lines.push('导出日期：' + todayText());
    lines.push('');
    document.querySelectorAll('[data-export-section]').forEach(function (section) {
      var title = section.querySelector('h2, h3');
      if (title) lines.push('【' + title.textContent.trim() + '】');
      section.querySelectorAll('input, textarea, td[contenteditable="true"]').forEach(function (el) {
        var label = el.getAttribute('aria-label') || el.placeholder || '';
        var value = (el.isContentEditable ? el.textContent : el.value || '').trim();
        if (value) lines.push((label ? label + '：' : '') + value);
      });
      lines.push('');
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '4S店市场经理工作台-' + todayText() + '.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadJson(filename, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportFullBackup() {
    var activeDate = getActiveDate();
    var currentState = collectStateFromFields(activeDate);
    writeState(currentState);
    saveArchiveForDate(activeDate, currentState, false);

    var backup = {
      app: '4S店市场经理工作台',
      version: 1,
      exportedAt: new Date().toISOString(),
      activeDate: activeDate,
      archives: readArchives()
    };
    downloadJson('4S店市场经理工作台-全部日期备份-' + todayText() + '.json', backup);
    if (saveStatus) saveStatus.textContent = '已导出全部备份';
  }

  function importFullBackup(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var backup = JSON.parse(String(reader.result || '{}'));
        if (!backup.archives || typeof backup.archives !== 'object') {
          alert('这个文件不是有效的工作台备份文件。');
          return;
        }
        if (!window.confirm('导入备份会覆盖当前浏览器里的所有日期数据。确认导入？')) return;

        writeArchives(backup.archives);
        var dates = Object.keys(backup.archives).sort().reverse();
        var nextDate = backup.activeDate || dates[0] || todayText();
        setActiveDate(nextDate);
        var nextState = backup.archives[nextDate] && backup.archives[nextDate].state ? backup.archives[nextDate].state : { __date: nextDate, __savedAt: new Date().toISOString() };
        writeState(nextState);
        loadDate(nextDate);
        if (saveStatus) saveStatus.textContent = '备份已导入';
        alert('备份导入完成，已切换到 ' + nextDate + '。');
      } catch (e) {
        alert('备份文件读取失败，请确认是之前导出的 JSON 文件。');
      } finally {
        if (backupFileInput) backupFileInput.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  document.querySelectorAll('[data-action="print"]').forEach(function (btn) {
    btn.addEventListener('click', function () { window.print(); });
  });

  document.querySelectorAll('[data-action="export"]').forEach(function (btn) {
    btn.addEventListener('click', exportText);
  });

  document.querySelectorAll('[data-action="backup-export"]').forEach(function (btn) {
    btn.addEventListener('click', exportFullBackup);
  });

  document.querySelectorAll('[data-action="backup-import"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (backupFileInput) backupFileInput.click();
    });
  });

  if (backupFileInput) {
    backupFileInput.addEventListener('change', function () {
      importFullBackup(backupFileInput.files && backupFileInput.files[0]);
    });
  }

  document.querySelectorAll('[data-action="reset"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var date = getActiveDate();
      if (window.confirm('确认清空 ' + date + ' 的工作台填写内容？')) {
        var archives = readArchives();
        delete archives[date];
        writeArchives(archives);
        localStorage.removeItem(storageKey);
        clearAllFields();
        writeState({ __date: date, __savedAt: new Date().toISOString() });
      }
    });
  });

  if (activeDateInput) {
    activeDateInput.addEventListener('change', function () {
      var previousDate = localStorage.getItem(activeDateKey) || todayText();
      var previousState = collectStateFromFields(previousDate);
      writeState(previousState);
      saveArchiveForDate(previousDate, previousState, false);
      var nextDate = activeDateInput.value || todayText();
      setActiveDate(nextDate);
      loadDate(nextDate);
      calculateMonthlyCumulative();
      calculateWeeklyCumulative();
    });
  }

  function getWeekMonday(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var dayOfWeek = d.getDay() || 7;
    d.setDate(d.getDate() - (dayOfWeek - 1));
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function getMonthStart(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    return y + '-' + m + '-01';
  }

  function calculateMonthlyCumulative() {
    var activeDate = getActiveDate();
    var monthStart = getMonthStart(activeDate);
    var monthKey = monthStart.slice(0, 7);
    var archives = readArchives();
    var monthTotals = {};
    var isToday = activeDate === todayText();

    var maxKey = 'trae-4s-market-workbench-monthly-max-' + monthKey;
    var storedMax = {};
    try {
      storedMax = JSON.parse(localStorage.getItem(maxKey) || '{}');
    } catch (e) {}

    var cursor = new Date(monthStart + 'T00:00:00');
    var endDate = new Date(activeDate + 'T00:00:00');

    while (cursor <= endDate) {
      var y = cursor.getFullYear();
      var m = String(cursor.getMonth() + 1).padStart(2, '0');
      var day = String(cursor.getDate()).padStart(2, '0');
      var dateStr = y + '-' + m + '-' + day;

      var dayState = null;
      if (dateStr === activeDate) {
        dayState = collectStateFromFields(activeDate);
      } else if (archives[dateStr] && archives[dateStr].state) {
        dayState = archives[dateStr].state;
      }

      if (dayState) {
        metricKeys.forEach(function (key) {
          var raw = dayState[key];
          var num = parseFloat(raw);
          if (!isNaN(num)) {
            monthTotals[key] = (monthTotals[key] || 0) + num;
          }
        });
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    if (isToday) {
      metricKeys.forEach(function (key) {
        var calculated = monthTotals[key] || 0;
        var stored = storedMax[key] || 0;
        monthTotals[key] = Math.max(calculated, stored);
        storedMax[key] = monthTotals[key];
      });
      localStorage.setItem(maxKey, JSON.stringify(storedMax));
    }

    metricKeys.forEach(function (key) {
      var el = document.querySelector('[data-monthly="' + key + '"]');
      if (el) {
        var val = monthTotals[key] || 0;
        var display = Number.isInteger(val) ? val : val.toFixed(1);
        var target = monthlyTargets[key] || 0;
        var pct = target > 0 ? Math.round(val / target * 100) : 0;
        el.textContent = '月实际 ' + display + ' · 达成 ' + pct + '%';
      }
    });
  }

  function calculateWeeklyCumulative() {
    var activeDate = getActiveDate();
    var monday = getWeekMonday(activeDate);
    var archives = readArchives();
    var weeklyTotals = {};
    var isToday = activeDate === todayText();

    var maxKey = 'trae-4s-market-workbench-weekly-max-' + monday;
    var storedMax = {};
    try {
      storedMax = JSON.parse(localStorage.getItem(maxKey) || '{}');
    } catch (e) {}

    if (Object.keys(storedMax).length === 0 && isToday) {
      var globalInitKey = 'trae-4s-market-workbench-weekly-init';
      if (!localStorage.getItem(globalInitKey)) {
        metricKeys.forEach(function (key) {
          var el = document.querySelector('[data-weekly="' + key + '"]');
          if (el) {
            var match = el.textContent.match(/本周累计\s+([\d.]+)/);
            if (match) storedMax[key] = parseFloat(match[1]) || 0;
          }
        });
        localStorage.setItem(globalInitKey, '1');
      }
    }

    var cursor = new Date(monday + 'T00:00:00');
    var endDate = new Date(activeDate + 'T00:00:00');

    while (cursor <= endDate) {
      var y = cursor.getFullYear();
      var m = String(cursor.getMonth() + 1).padStart(2, '0');
      var day = String(cursor.getDate()).padStart(2, '0');
      var dateStr = y + '-' + m + '-' + day;

      var dayState = null;
      if (dateStr === activeDate) {
        dayState = collectStateFromFields(activeDate);
      } else if (archives[dateStr] && archives[dateStr].state) {
        dayState = archives[dateStr].state;
      }

      if (dayState) {
        metricKeys.forEach(function (key) {
          var raw = dayState[key];
          var num = parseFloat(raw);
          if (!isNaN(num)) {
            weeklyTotals[key] = (weeklyTotals[key] || 0) + num;
          }
        });
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    if (isToday) {
      metricKeys.forEach(function (key) {
        var calculated = weeklyTotals[key] || 0;
        var stored = storedMax[key] || 0;
        weeklyTotals[key] = Math.max(calculated, stored);
        storedMax[key] = weeklyTotals[key];
      });
      localStorage.setItem(maxKey, JSON.stringify(storedMax));
    }

    metricKeys.forEach(function (key) {
      var el = document.querySelector('[data-weekly="' + key + '"]');
      if (el) {
        var val = weeklyTotals[key] || 0;
        var display = Number.isInteger(val) ? val : val.toFixed(1);
        el.textContent = '本周累计 ' + display;
      }
    });
  }

  bindEditableTables();
  function loadSyncedData() {
    if (!window.SYNCED_DATA) return;
    var syncBadge = document.getElementById('sync-badge');
    if (syncBadge && window.SYNCED_DATA.syncLabel) {
      syncBadge.textContent = '最后同步：' + window.SYNCED_DATA.syncLabel;
    }
    var syncKey = 'trae-4s-market-workbench-synced-version-v1';
    var lastSynced = localStorage.getItem(syncKey);
    var currentVersion = window.SYNCED_DATA.syncVersion || window.SYNCED_DATA.syncDate;
    if (lastSynced === currentVersion) return;

    var archives = readArchives();
    var multiDateData = window.SYNCED_DATA.multiDateMetrics || {};
    var hasMultiDate = Object.keys(multiDateData).length > 0;

    if (hasMultiDate) {
      Object.keys(multiDateData).forEach(function (date) {
        var dayMetrics = multiDateData[date];
        var existingState = (archives[date] && archives[date].state) || {};
        Object.keys(dayMetrics).forEach(function (key) {
          existingState[key] = dayMetrics[key];
        });
        existingState.__date = date;
        existingState.__savedAt = new Date().toISOString();
        archives[date] = {
          savedAt: new Date().toISOString(),
          state: existingState
        };
      });
      writeArchives(archives);

      var todayMonth = todayText().slice(0, 7);
      var monday = getWeekMonday(todayText());
      localStorage.removeItem('trae-4s-market-workbench-monthly-max-' + todayMonth);
      localStorage.removeItem('trae-4s-market-workbench-weekly-max-' + monday);
      localStorage.removeItem('trae-4s-market-workbench-weekly-init');
    }

    localStorage.setItem(syncKey, currentVersion);

    if (hasMultiDate) {
      loadDate(getActiveDate());
    } else {
      saveAll();
    }

    var syncDate = window.SYNCED_DATA.syncDate;
    var singleDateMetrics = window.SYNCED_DATA.metrics || {};
    if (Object.keys(singleDateMetrics).length > 0 && getActiveDate() === syncDate) {
      Object.keys(singleDateMetrics).forEach(function (key) {
        var el = document.querySelector('[data-save="' + key + '"]');
        if (el) setValue(el, singleDateMetrics[key]);
      });
      saveAll();
    }

    calculateMonthlyCumulative();
    calculateWeeklyCumulative();
    if (saveStatus) saveStatus.textContent = '已同步金山文档数据（' + window.SYNCED_DATA.syncLabel + '）';
  }

  function saveAllAndRefreshWeekly() {
    saveAll();
    calculateMonthlyCumulative();
    calculateWeeklyCumulative();
  }

  initializeDateState();
  loadSyncedData();
  calculateMonthlyCumulative();
  calculateWeeklyCumulative();
  fields.forEach(function (el) {
    el.addEventListener('input', saveAllAndRefreshWeekly);
    el.addEventListener('change', saveAllAndRefreshWeekly);
  });

  if (window.CloudSync) {
    CloudSync.onCloudUpdate(function () {
      loadDate(getActiveDate());
      calculateMonthlyCumulative();
      calculateWeeklyCumulative();
      if (saveStatus) saveStatus.textContent = '已从云端同步';
    });
    CloudSync.init(function (applied) {
      if (applied) {
        loadDate(getActiveDate());
        calculateMonthlyCumulative();
        calculateWeeklyCumulative();
        if (saveStatus) saveStatus.textContent = '已从云端同步';
      }
    });
  }

  function navigateTo(target) {
    try {
      if (window.top !== window.self) {
        window.top.location.href = target;
      } else {
        window.location.href = target;
      }
    } catch (err) {
      window.location.href = target;
    }
  }

  var competitorLink = document.getElementById('go-to-competitor-report');
  var reportOverlay = document.getElementById('report-overlay');
  var backFromReport = document.getElementById('back-from-report');

  if (competitorLink && reportOverlay) {
    competitorLink.addEventListener('click', function (e) {
      e.preventDefault();
      reportOverlay.style.display = 'block';
      document.body.style.overflow = 'hidden';
    });
  }

  if (backFromReport && reportOverlay) {
    backFromReport.addEventListener('click', function (e) {
      e.preventDefault();
      reportOverlay.style.display = 'none';
      document.body.style.overflow = '';
    });
  }

  window.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'close-competitor-report') {
      var overlay = document.getElementById('report-overlay');
      if (overlay) {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
      }
    }
  });

  function setupAutoSyncTimer() {
    var SYNC_HOUR = 19;
    var autoSyncKey = 'trae-4s-market-workbench-last-auto-sync';

    function checkAutoSync() {
      var now = new Date();
      var today = todayText();

      var lastSystemDate = localStorage.getItem(systemDateKey);
      if (lastSystemDate && lastSystemDate !== today) {
        initializeDateState();
        loadSyncedData();
        calculateMonthlyCumulative();
        calculateWeeklyCumulative();
        if (saveStatus) saveStatus.textContent = '已过午夜，数据已刷新';
      }

      var lastAutoSync = localStorage.getItem(autoSyncKey) || '';
      if (now.getHours() >= SYNC_HOUR && lastAutoSync !== today) {
        var script = document.createElement('script');
        script.src = './synced-data.js?v=' + now.getTime();
        script.onload = function () {
          localStorage.setItem(autoSyncKey, today);
          loadSyncedData();
          calculateMonthlyCumulative();
          calculateWeeklyCumulative();
          if (saveStatus) saveStatus.textContent = '已自动同步今日数据（19:00）';
        };
        document.head.appendChild(script);
      }
    }

    setInterval(checkAutoSync, 60000);
    checkAutoSync();
  }

  setupAutoSyncTimer();
})();
