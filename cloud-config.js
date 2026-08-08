(function () {
  var storedConfig = null;
  try {
    storedConfig = JSON.parse(localStorage.getItem('trae-4s-market-workbench-cloud-config') || 'null');
  } catch (e) {}

  window.CLOUD_CONFIG = storedConfig || {
    token: "acfa7cae6272ad0bfd873cc0939bc990",
    owner: "orange-guihe",
    repo: "workbench-data"
  };

  window.CLOUD_ENABLED = (window.CLOUD_CONFIG &&
    window.CLOUD_CONFIG.token &&
    window.CLOUD_CONFIG.owner &&
    window.CLOUD_CONFIG.repo &&
    window.CLOUD_CONFIG.token.length > 10);
})();
