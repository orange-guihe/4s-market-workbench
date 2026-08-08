(function () {
  var FILE_PATH = 'workbench-data.json';
  var GITEE_API = 'https://gitee.com/api/v5/repos';
  var CORS_PROXY = 'https://corsproxy.io/?url=';
  var SHA_KEY = 'trae-4s-market-workbench-cloud-sha';
  var SYNC_TS_KEY = 'trae-4s-market-workbench-cloud-sync-ts';
  var DEVICE_ID_KEY = 'trae-4s-market-workbench-device-id';
  var pushTimer = null;
  var pollTimer = null;
  var isPulling = false;
  var onCloudUpdateCallback = null;

  function getConfig() { return window.CLOUD_CONFIG || {}; }
  function isEnabled() { return !!window.CLOUD_ENABLED; }

  function getDeviceId() {
    var id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  function getLocalSyncTs() {
    return parseInt(localStorage.getItem(SYNC_TS_KEY) || '0', 10);
  }

  function setLocalSyncTs(ts) {
    localStorage.setItem(SYNC_TS_KEY, String(ts));
  }

  function getSha() { return localStorage.getItem(SHA_KEY) || ''; }
  function setSha(sha) { localStorage.setItem(SHA_KEY, sha); }

  function apiUrl(action) {
    var cfg = getConfig();
    var base = GITEE_API + '/' + cfg.owner + '/' + cfg.repo + '/contents/' + FILE_PATH;
    var url;
    if (action === 'get') {
      url = base + '?access_token=' + encodeURIComponent(cfg.token) + '&ref=master';
    } else {
      url = base + '?access_token=' + encodeURIComponent(cfg.token);
    }
    return CORS_PROXY + encodeURIComponent(url);
  }

  function collectAllLocalData() {
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf('trae-4s-market-workbench-') === 0 &&
          key !== SHA_KEY &&
          key !== SYNC_TS_KEY &&
          key !== DEVICE_ID_KEY &&
          key !== 'trae-4s-market-workbench-cloud-config') {
        var raw = localStorage.getItem(key);
        try {
          data[key] = JSON.parse(raw);
        } catch (e) {
          data[key] = raw;
        }
      }
    }
    return data;
  }

  function applyCloudData(cloudData) {
    if (!cloudData || !cloudData.payload) return false;
    var payload = cloudData.payload;
    var cloudTs = cloudData.lastUpdated || 0;
    var localTs = getLocalSyncTs();

    if (cloudTs <= localTs) return false;

    isPulling = true;
    try {
      Object.keys(payload).forEach(function (key) {
        var value = payload[key];
        if (typeof value === 'object' && value !== null) {
          localStorage.setItem(key, JSON.stringify(value));
        } else {
          localStorage.setItem(key, String(value));
        }
      });
      setLocalSyncTs(cloudTs);
    } catch (e) {
      console.error('Cloud sync: applyCloudData error', e);
    }
    isPulling = false;
    return true;
  }

  function updateStatus(text, type) {
    var el = document.getElementById('cloud-sync-status');
    if (!el) return;
    el.textContent = text;
    el.className = 'cloud-status ' + (type || '');
  }

  function encodeBase64(str) {
    try {
      return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
      var utf8 = unescape(encodeURIComponent(str));
      var arr = [];
      for (var i = 0; i < utf8.length; i++) arr.push(utf8.charCodeAt(i));
      return btoa(String.fromCharCode.apply(null, arr));
    }
  }

  function decodeBase64(b64) {
    try {
      var clean = b64.replace(/\s/g, '');
      return decodeURIComponent(escape(atob(clean)));
    } catch (e) {
      try {
        return atob(b64.replace(/\s/g, ''));
      } catch (e2) {
        console.error('decodeBase64 failed', e2);
        return null;
      }
    }
  }

  function pushToCloud(callback) {
    if (!isEnabled() || isPulling) {
      if (callback) callback(false);
      return;
    }
    var cfg = getConfig();
    var payload = collectAllLocalData();
    var now = Date.now();
    var body = {
      payload: payload,
      lastUpdated: now,
      deviceId: getDeviceId(),
      updatedAt: new Date().toISOString()
    };
    var content = encodeBase64(JSON.stringify(body));
    setLocalSyncTs(now);

    var reqBody = {
      access_token: cfg.token,
      content: content,
      message: 'sync: ' + new Date().toISOString()
    };
    var sha = getSha();
    var method = sha ? 'PUT' : 'POST';
    if (sha) reqBody.sha = sha;

    fetch(apiUrl(), {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody)
    }).then(function (res) {
      if (!res.ok) {
        if (res.status === 409 && !sha) {
          return pullAndRetryPush();
        }
        throw new Error('HTTP ' + res.status);
      }
      return res.json();
    }).then(function (result) {
      if (result && result.content && result.content.sha) {
        setSha(result.content.sha);
      }
      updateStatus('已同步', 'ok');
      if (callback) callback(true);
    }).catch(function (err) {
      console.error('Cloud sync: push error', err);
      if (err.message && err.message.indexOf('409') >= 0) {
        pullAndRetryPush();
      } else {
        updateStatus('同步失败', 'err');
        if (callback) callback(false);
      }
    });

    function pullAndRetryPush() {
      pullFromCloud(function () {
        setTimeout(function () { pushToCloud(callback); }, 500);
      });
    }
  }

  function debouncedPush() {
    if (!isEnabled()) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { pushToCloud(); }, 3000);
  }

  function pullFromCloud(callback) {
    if (!isEnabled()) {
      if (callback) callback(false);
      return;
    }
    updateStatus('同步中...', 'syncing');

    fetch(apiUrl('get'), { method: 'GET' })
      .then(function (res) {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (result) {
        if (!result) {
          pushToCloud(function (ok) {
            if (callback) callback(false);
          });
          return;
        }

        if (result.sha) setSha(result.sha);

        var cloudData = null;
        try {
          var decoded = decodeBase64(result.content);
          cloudData = JSON.parse(decoded);
        } catch (e) {
          console.error('Cloud sync: parse error', e);
          updateStatus('同步失败', 'err');
          if (callback) callback(false);
          return;
        }

        var applied = applyCloudData(cloudData);
        if (applied) {
          updateStatus('已拉取云端数据', 'ok');
          if (callback) callback(true);
        } else {
          updateStatus('已是最新', 'ok');
          if (callback) callback(false);
        }
      })
      .catch(function (err) {
        console.error('Cloud sync: pull error', err);
        updateStatus('同步失败', 'err');
        if (callback) callback(false);
      });
  }

  function startPolling() {
    if (!isEnabled()) return;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(function () {
      if (isPulling) return;

      fetch(apiUrl('get'), { method: 'GET' })
        .then(function (res) {
          if (res.status === 404) return null;
          if (!res.ok) return null;
          return res.json();
        })
        .then(function (result) {
          if (!result || !result.content) return;
          if (result.sha) setSha(result.sha);
          var cloudData = null;
          try {
            cloudData = JSON.parse(decodeBase64(result.content));
          } catch (e) { return; }
          if (!cloudData || !cloudData.lastUpdated) return;
          var cloudTs = cloudData.lastUpdated;
          var localTs = getLocalSyncTs();
          if (cloudTs > localTs && cloudData.deviceId !== getDeviceId()) {
            pullFromCloud(function (applied) {
              if (applied && onCloudUpdateCallback) onCloudUpdateCallback();
            });
          }
        })
        .catch(function () {});
    }, 15000);
  }

  function init(callback) {
    if (!isEnabled()) {
      if (callback) callback(false);
      return;
    }
    updateStatus('连接云端中...', 'syncing');
    pullFromCloud(function (applied) {
      startPolling();
      if (callback) callback(applied);
    });
  }

  window.CloudSync = {
    init: init,
    push: debouncedPush,
    pull: pullFromCloud,
    forcePush: pushToCloud,
    isPulling: function () { return isPulling; },
    onCloudUpdate: function (cb) { onCloudUpdateCallback = cb; },
    isReady: function () { return isEnabled(); }
  };
})();
