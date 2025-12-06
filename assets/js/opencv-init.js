window.cvReady = false;

function onOpenCvReady() {
  window.cvReady = true;
  const badge = document.getElementById('cv-status');
  if (badge) {
    badge.textContent = '✓ OpenCV';
    badge.classList.add('ready');
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      const lateBadge = document.getElementById('cv-status');
      if (lateBadge) {
        lateBadge.textContent = '✓ OpenCV';
        lateBadge.classList.add('ready');
      }
    });
  }
}
