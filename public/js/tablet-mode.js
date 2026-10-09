// tablet-mode.js - Tablet Companion, QR Code and Fullscreen Support
class TabletManager {
  constructor() {
    this.qrModal = document.getElementById('qrModal');
    this.qrImg = document.getElementById('qrCodeImg');
    this.qrText = document.getElementById('qrUrlText');
    this.isTabletMode = false;

    this.checkUrlParams();
  }

  checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'tablet' || params.has('tablet')) {
      this.enableTabletView();
    }
  }

  async openQrModal() {
    if (!this.qrModal) return;
    this.qrModal.classList.add('open');

    try {
      const res = await fetch('/api/qrcode');
      if (res.ok) {
        const data = await res.json();
        if (this.qrImg && data.qrDataUrl) {
          this.qrImg.src = data.qrDataUrl;
        }
        if (this.qrText && data.url) {
          this.qrText.textContent = data.url;
        }
      }
    } catch (e) {
      console.warn('QR code loading error', e);
    }
  }

  closeQrModal() {
    if (this.qrModal) {
      this.qrModal.classList.remove('open');
    }
  }

  toggleTabletView() {
    if (this.isTabletMode) {
      this.disableTabletView();
    } else {
      this.enableTabletView();
    }
  }

  enableTabletView() {
    document.body.classList.add('tablet-hud-mode');
    this.isTabletMode = true;
    const btn = document.getElementById('tabletToggleBtn');
    if (btn) btn.classList.add('active');
    window.dispatchEvent(new Event('resize'));
  }

  disableTabletView() {
    document.body.classList.remove('tablet-hud-mode');
    this.isTabletMode = false;
    const btn = document.getElementById('tabletToggleBtn');
    if (btn) btn.classList.remove('active');
    window.dispatchEvent(new Event('resize'));
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(err => {
        console.log('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen?.();
    }
  }
}

window.TabletManager = TabletManager;
