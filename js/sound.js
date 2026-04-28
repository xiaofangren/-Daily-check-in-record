let audioCtx = null;
let soundEnabled = true;
let soundVolume = 0.5;
let systemMuted = false;

function initSound() {
  const savedEnabled = localStorage.getItem('soundEnabled');
  if (savedEnabled !== null) {
    soundEnabled = savedEnabled === 'true';
  }
  const savedVolume = localStorage.getItem('soundVolume');
  if (savedVolume !== null) {
    soundVolume = Math.max(0, Math.min(1, parseFloat(savedVolume)));
  }
  updateSoundToggle();
  updateVolumeSlider();
  detectSystemMute();
  bindSoundToButtons();
}

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function detectSystemMute() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') {
      systemMuted = true;
    }
    ctx.close();
  } catch (e) {
    systemMuted = true;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      systemMuted = true;
    } else {
      systemMuted = false;
      checkAudioContextState();
    }
  });
}

function checkAudioContextState() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    systemMuted = true;
  } else if (audioCtx.state === 'running') {
    systemMuted = false;
  }
}

function shouldPlaySound() {
  if (!soundEnabled) return false;
  if (systemMuted) return false;
  return true;
}

function playClickSound() {
  if (!shouldPlaySound()) return;
  try {
    const ctx = getAudioCtx();
    const vol = soundVolume * 0.15;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, ctx.currentTime);
    filter.Q.setValueAtTime(1, ctx.currentTime);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.03);

    gainNode.gain.setValueAtTime(vol, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  } catch (e) {}
}

function playSuccessSound() {
  if (!shouldPlaySound()) return;
  try {
    const ctx = getAudioCtx();
    const vol = soundVolume * 0.18;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    gain1.gain.setValueAtTime(vol, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
    gain2.gain.setValueAtTime(0.001, ctx.currentTime);
    gain2.gain.setValueAtTime(vol, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

function playDeleteSound() {
  if (!shouldPlaySound()) return;
  try {
    const ctx = getAudioCtx();
    const vol = soundVolume * 0.15;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(vol, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {}
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('soundEnabled', soundEnabled.toString());
  updateSoundToggle();
  if (soundEnabled) {
    systemMuted = false;
    playClickSound();
  }
}

function setSoundVolume(value) {
  soundVolume = Math.max(0, Math.min(1, parseFloat(value)));
  localStorage.setItem('soundVolume', soundVolume.toString());
}

function updateSoundToggle() {
  const toggle = document.getElementById('sound-toggle');
  if (toggle) {
    toggle.classList.toggle('active', soundEnabled);
  }
}

function updateVolumeSlider() {
  const slider = document.getElementById('sound-volume');
  if (slider) {
    slider.value = soundVolume;
  }
  const label = document.getElementById('sound-volume-label');
  if (label) {
    label.textContent = Math.round(soundVolume * 100) + '%';
  }
}

function bindSoundToButtons() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('button, .checkin-card, .tab-item, .makeup-item, .acct-category-item, .template-item, .icon-option, .color-option, .numpad-key, .calendar-day, .quick-menu-item');
    if (target) {
      if (target.classList.contains('checkin-card') || target.classList.contains('makeup-item')) {
        playSuccessSound();
      } else if (target.classList.contains('acct-bill-delete') || target.classList.contains('record-delete') || target.classList.contains('btn-danger')) {
        playDeleteSound();
      } else {
        playClickSound();
      }
    }
  }, { passive: true });
}
