const statusEl = document.getElementById('pin-status');
const launchButton = document.getElementById('launch-button');

function setPinStatus(isPinned) {
  if (!statusEl) return;

  if (isPinned) {
    statusEl.textContent = '✅ Pinned!';
  } else {
    statusEl.textContent = '❌ Not Pinned';
  }
}

async function checkPinLive() {
  try {
    const settings = await chrome.action.getUserSettings();
    setPinStatus(Boolean(settings.isOnToolbar));
  } catch (error) {
    if (statusEl) {
      statusEl.textContent = '⚠️ Unable to detect pin status';
    }
    console.error('Error checking pin status:', error);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  checkPinLive();
  setInterval(checkPinLive, 1000);

  if (launchButton) {
    launchButton.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://x.com/i/bookmarks' });
      chrome.runtime.sendMessage({ action: 'CLOSE_WELCOME_TAB' });
    });
  }
});