// ============================================================
//  APP.JS — Fire Alarm System Dashboard (Multi-Kit)
//  Nguyễn Nhật Minh — 20225886
// ============================================================

// ============================================================
//  SOCKET.IO
// ============================================================
const socket = io();

// ============================================================
//  CONSTANTS
// ============================================================
const GAUGE_CIRCUMFERENCE = 314.159; // 2 * π * 50
const MAX_CHART_POINTS    = 50;
const GAS_WARNING_DELTA   = 700;
const GAS_DANGER_DELTA    = 1400;

const isValidTemperature = (v) => Number.isFinite(v) && v >= -20 && v <= 80;
const isValidHumidity    = (v) => Number.isFinite(v) && v >= 0   && v <= 100;
const isValidSmoke       = (v) => Number.isFinite(v) && v >= 0   && v <= 4095;
const isValidGasDelta    = (v) => Number.isFinite(v) && v >= -4095 && v <= 4095;

// ============================================================
//  GLOBAL STATE
// ============================================================
// Map<kitId, KitState>
const kitStates = new Map();
// List of device configs received from server
let devices = [];
// Active kit id
let activeKitId = null;
// Security modal state
let pendingAction = null; // { type, deviceId, payload }

// ============================================================
//  KIT STATE FACTORY
// ============================================================
function createKitState(id, name) {
  return {
    id,
    name,
    online:       false,
    fireLevel:    1,
    doorState:    'CLOSED',
    doorPending:  false,
    isEmergency:  false,
    chart:        null,
    chartData: {
      labels:      [],
      temperature: [],
      humidity:    [],
      smoke:       [],
    },
    datasetVisibility: {
      temperature: true,
      humidity:    true,
      smoke:       true,
    },
    panelEl: null, // DOM reference
  };
}

// ============================================================
//  INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  setupSocketListeners();
  setupPinToggle();
  addLog('Hệ thống báo cháy đang khởi tạo...', 'info');
});

// ============================================================
//  SOCKET.IO EVENTS
// ============================================================
function setupSocketListeners() {
  socket.on('connect', () => {
    addLog('Kết nối server thành công!', 'success');
    setMqttConnectionStatus(true);
  });

  socket.on('disconnect', () => {
    setMqttConnectionStatus(false);
    addLog('Mất kết nối server. Đang thử lại...', 'error');
  });

  socket.on('mqttStatus', ({ connected }) => {
    setMqttConnectionStatus(connected);
    addLog(connected ? 'MQTT Broker đã kết nối' : 'MQTT Broker mất kết nối', connected ? 'success' : 'warning');
  });

  // Server sends list of devices on connect
  socket.on('devicesConfig', (devList) => {
    devices = devList;
    renderAllKitPanels(devList);

    devList.forEach(d => {
      const state = kitStates.get(d.id);
      if (state) setKitOnline(state, d.online);
    });

    // Select first kit by default
    if (devList.length > 0 && !activeKitId) {
      selectKit(devList[0].id);
    }
  });

  // Per-device sensor data
  socket.on('fireAlarmData', (data) => {
    const state = kitStates.get(data.deviceId);
    if (!state) return;

    updateSensorDisplay(state, data);
    updateFireLevel(state, data.level || 1);
    updateFlameIndicator(state, data.flame || false);
    updateChart(state, data);
    updateLastUpdateTime(state);

    // Update global alert banner if this is the active kit
    if (data.deviceId === activeKitId) {
      syncGlobalAlertBanner(state);
    }
  });

  // Per-device door status
  socket.on('doorStatus', ({ deviceId, state: doorState }) => {
    const kitState = kitStates.get(deviceId);
    if (!kitState) return;

    kitState.doorPending = false;
    updateDoorDisplay(kitState, doorState);
    addLog(`[${kitState.name}] Cửa: ${doorState === 'OPEN' ? 'Đã MỞ' : 'Đã ĐÓNG'}`, doorState === 'OPEN' ? 'success' : 'info');
  });

  // Per-device emergency status
  socket.on('emergencyStatus', ({ deviceId, status }) => {
    const kitState = kitStates.get(deviceId);
    if (!kitState) return;

    updateEmergencyDisplay(kitState, status);
  });

  // Device online/offline from heartbeat
  socket.on('deviceStatus', ({ deviceId, online }) => {
    const kitState = kitStates.get(deviceId);
    if (!kitState) return;

    setKitOnline(kitState, online);
    updateTabBadge(deviceId, online);

    const tab = document.querySelector(`.kit-tab[data-kit-id="${deviceId}"]`);
    addLog(
      `[${kitState.name}] ${online ? '✅ Đã kết nối trở lại' : '❌ Mất kết nối với thiết bị'}`,
      online ? 'success' : 'error'
    );
  });

  // History (all devices mixed)
  socket.on('history', (history) => {
    if (!history || history.length === 0) return;
    addLog(`Đã nhận ${history.length} bản ghi lịch sử`, 'info');

    history.forEach(data => {
      const state = kitStates.get(data.deviceId);
      if (state) addChartData(state, data);
    });

    // Update charts
    kitStates.forEach(state => {
      if (state.chart) state.chart.update('none');
    });

    // Update display with latest per-device
    const perDevice = {};
    history.forEach(d => { perDevice[d.deviceId] = d; });
    Object.values(perDevice).forEach(data => {
      const state = kitStates.get(data.deviceId);
      if (state) {
        updateSensorDisplay(state, data);
        updateFireLevel(state, data.level || 1);
        updateFlameIndicator(state, data.flame || false);
      }
    });
  });
}

// ============================================================
//  RENDER KIT PANELS
// ============================================================
function renderAllKitPanels(devList) {
  const tabsContainer  = document.getElementById('kitTabs');
  const panelsContainer = document.getElementById('kitPanels');
  tabsContainer.innerHTML  = '';
  panelsContainer.innerHTML = '';

  devList.forEach((device, idx) => {
    // Create state
    if (!kitStates.has(device.id)) {
      kitStates.set(device.id, createKitState(device.id, device.name));
    }
    const state = kitStates.get(device.id);

    // ── TAB ──────────────────────────────────────────
    const tab = document.createElement('button');
    tab.className = 'kit-tab';
    tab.dataset.kitId = device.id;
    tab.id = `tab-${device.id}`;
    tab.innerHTML = `
      <span class="tab-badge offline" id="badge-${device.id}"></span>
      <i class="ph-fill ph-cpu tab-icon"></i>
      <span class="tab-name">${device.name}</span>
    `;
    tab.addEventListener('click', () => selectKit(device.id));
    tabsContainer.appendChild(tab);

    // ── PANEL ─────────────────────────────────────────
    const template = document.getElementById('kitPanelTemplate');
    const panel = template.content.cloneNode(true).querySelector('.kit-panel');
    panel.dataset.kitId = device.id;
    panel.id = `panel-${device.id}`;
    panel.style.display = 'none'; // Hidden until selected

    // Fix unique gradient IDs (SVG gradients must be globally unique)
    panel.querySelectorAll('[data-role="tempGauge"]').forEach(el => el.setAttribute('stroke', `url(#tempGrad-${device.id})`));
    panel.querySelectorAll('[data-role="humGauge"]').forEach(el  => el.setAttribute('stroke', `url(#humGrad-${device.id})`));
    panel.querySelectorAll('[data-role="smokeGauge"]').forEach(el => el.setAttribute('stroke', `url(#smokeGrad-${device.id})`));

    panel.querySelectorAll('[data-role="tempGrad"]').forEach(el  => el.id = `tempGrad-${device.id}`);
    panel.querySelectorAll('[data-role="humGrad"]').forEach(el   => el.id = `humGrad-${device.id}`);
    panel.querySelectorAll('[data-role="smokeGrad"]').forEach(el => el.id = `smokeGrad-${device.id}`);

    // Wire up control buttons with deviceId
    panel.querySelectorAll('[data-role="btnDoorOpen"]').forEach(btn => {
      btn.addEventListener('click', () => openSecurityModal('door_open', device.id, 'OPEN'));
    });
    panel.querySelectorAll('[data-role="btnDoorClose"]').forEach(btn => {
      btn.addEventListener('click', () => openSecurityModal('door_close', device.id, 'CLOSE'));
    });
    panel.querySelectorAll('[data-role="btnEmergency"]').forEach(btn => {
      btn.addEventListener('click', () => openSecurityModal('emergency', device.id, null));
    });
    panel.querySelectorAll('[data-role="btnStopAlarm"]').forEach(btn => {
      btn.addEventListener('click', () => openSecurityModal('stop_alarm', device.id, null));
    });

    // Wire legend buttons
    panel.querySelectorAll('.legend-btn').forEach(btn => {
      btn.addEventListener('click', () => toggleDataset(state, btn.dataset.dataset, btn));
    });

    panelsContainer.appendChild(panel);
    state.panelEl = document.getElementById(`panel-${device.id}`);

    // Init chart for this kit
    initChart(state, device.id);
  });

  // Show tabs wrapper only if more than 1 kit
  document.getElementById('kitTabsWrap').style.display = devList.length > 1 ? 'block' : 'none';
}

function selectKit(kitId) {
  activeKitId = kitId;

  // Update tabs
  document.querySelectorAll('.kit-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.kitId === kitId);
  });

  // Show/hide panels
  document.querySelectorAll('.kit-panel').forEach(panel => {
    panel.style.display = panel.dataset.kitId === kitId ? 'block' : 'none';
  });

  // Sync global alert banner
  const state = kitStates.get(kitId);
  if (state) syncGlobalAlertBanner(state);
}

function updateTabBadge(deviceId, online) {
  const badge = document.getElementById(`badge-${deviceId}`);
  if (!badge) return;
  badge.className = `tab-badge ${online ? 'online' : 'offline'}`;
}

// ============================================================
//  KIT ONLINE/OFFLINE OVERLAY
// ============================================================
function setKitOnline(state, online) {
  state.online = online;
  if (!state.panelEl) return;

  const overlay  = state.panelEl.querySelector('.kit-offline-overlay');
  const controls = state.panelEl.querySelectorAll('.kit-control-btn');

  if (online) {
    state.panelEl.classList.remove('kit-offline');
    if (overlay) overlay.classList.remove('visible');
    controls.forEach(btn => btn.disabled = false);
  } else {
    state.panelEl.classList.add('kit-offline');
    if (overlay) overlay.classList.add('visible');
    controls.forEach(btn => btn.disabled = true);
  }
}

// ============================================================
//  CONNECTION STATUS (MQTT / server)
// ============================================================
function setMqttConnectionStatus(connected) {
  const badge = document.getElementById('connectionBadge');
  const text  = document.getElementById('connText');
  badge.className = connected ? 'connection-badge connected' : 'connection-badge disconnected';
  text.textContent = connected ? 'MQTT Kết nối' : 'Mất kết nối';
}

// ============================================================
//  SENSOR DISPLAY
// ============================================================
function updateSensorDisplay(state, data) {
  const panel = state.panelEl;
  if (!panel) return;

  // Temperature
  if (isValidTemperature(data.temperature)) {
    q(panel, 'tempValue').textContent = data.temperature.toFixed(1);
    setGauge(q(panel, 'tempGauge'), data.temperature, 100);
  }

  // Humidity
  if (isValidHumidity(data.humidity)) {
    q(panel, 'humValue').textContent = data.humidity.toFixed(1);
    setGauge(q(panel, 'humGauge'), data.humidity, 100);
  }

  // Smoke / Gas
  if (isValidSmoke(data.smoke) || isValidGasDelta(data.smoke_delta)) {
    const gasDelta = isValidGasDelta(data.smoke_delta) ? Math.max(0, data.smoke_delta) : data.smoke;
    q(panel, 'smokeValue').textContent = Math.round(gasDelta);
    setGauge(q(panel, 'smokeGauge'), Math.min(gasDelta / 20, 100), 100);

    const smokeEl = q(panel, 'smokeStatus');
    if (data.mq2_ready === false) {
      smokeEl.innerHTML = '<i class="ph-fill ph-clock"></i> Đang hiệu chuẩn';
      smokeEl.style.color = 'var(--text-muted)';
    } else if (gasDelta >= GAS_DANGER_DELTA) {
      smokeEl.innerHTML = '<i class="ph-fill ph-warning-circle"></i> Nguy hiểm';
      smokeEl.style.color = 'var(--red)';
    } else if (gasDelta >= GAS_WARNING_DELTA) {
      smokeEl.innerHTML = '<i class="ph-fill ph-warning"></i> Cảnh báo';
      smokeEl.style.color = 'var(--yellow)';
    } else if (gasDelta >= GAS_WARNING_DELTA / 2) {
      smokeEl.innerHTML = '<i class="ph-fill ph-info"></i> Chú ý';
      smokeEl.style.color = 'var(--orange)';
    } else {
      smokeEl.innerHTML = '<i class="ph-fill ph-check-circle"></i> Bình thường';
      smokeEl.style.color = 'var(--green)';
    }
  }
}

// ============================================================
//  GAUGE
// ============================================================
function setGauge(gaugeEl, value, max) {
  if (!gaugeEl) return;
  const pct    = Math.min(Math.max(value / max, 0), 1);
  const offset = GAUGE_CIRCUMFERENCE * (1 - pct);
  gaugeEl.style.strokeDashoffset = offset;
}

// ============================================================
//  FLAME INDICATOR
// ============================================================
function updateFlameIndicator(state, hasFlame) {
  const panel = state.panelEl;
  if (!panel) return;

  const indicator = q(panel, 'flameIndicator');
  const statusEl  = q(panel, 'flameStatus');

  if (hasFlame) {
    indicator.classList.add('detected');
    statusEl.innerHTML = '<span class="status-text" style="color:var(--red);font-weight:700;"><i class="ph-fill ph-warning"></i> PHÁT HIỆN LỬA!</span>';
    addLog(`⚠️ [${state.name}] CẢNH BÁO: Phát hiện lửa!`, 'error');
  } else {
    indicator.classList.remove('detected');
    statusEl.innerHTML = '<span class="status-text">Không phát hiện</span>';
  }
}

// ============================================================
//  FIRE LEVEL
// ============================================================
function updateFireLevel(state, level) {
  state.fireLevel = level;
  const panel = state.panelEl;
  if (!panel) return;

  const levelIndicator = q(panel, 'levelIndicator');
  const levelSection   = q(panel, 'levelSection');

  let levelClass;
  if (level === 1) levelClass = 'level-1';
  else if (level === 2) levelClass = 'level-2';
  else levelClass = 'level-3';

  if (levelIndicator) {
    levelIndicator.style.width = level === 1 ? '33%' : level === 2 ? '66%' : '100%';
  }
  if (levelSection) {
    levelSection.className = 'section level-section ' + levelClass;
  }

  if (level > 1) {
    addLog(`[${state.name}] Cấp độ báo động: Cấp ${level}`, level === 3 ? 'error' : 'warning');
  }
}

// ============================================================
//  GLOBAL ALERT BANNER (synced from active kit)
// ============================================================
function syncGlobalAlertBanner(state) {
  const level   = state.fireLevel;
  const banner  = document.getElementById('alertBanner');
  const iconEl  = document.getElementById('alertBannerIcon');
  const titleEl = document.getElementById('alertTitle');
  const descEl  = document.getElementById('alertDescription');
  const indicator = document.querySelector('#alertStatus .alert-indicator');

  let bannerClass, alertClass, iconClass, title, desc, indicatorText;

  if (level === 1) {
    bannerClass   = 'level-1'; alertClass = 'normal';
    iconClass     = 'ph-bold ph-check-circle';
    title         = 'Trạng thái bình thường';
    desc          = 'Không phát hiện mối nguy hiểm';
    indicatorText = 'Bình thường';
  } else if (level === 2) {
    bannerClass   = 'level-2'; alertClass = 'warning';
    iconClass     = 'ph-bold ph-warning';
    title         = 'Cảnh báo hệ thống';
    desc          = 'Phát hiện khí gas cao hoặc nhiệt độ tăng bất thường';
    indicatorText = 'Cảnh báo';
  } else {
    bannerClass   = 'level-3'; alertClass = 'danger';
    iconClass     = 'ph-bold ph-siren';
    title         = 'BÁO ĐỘNG KHẨN CẤP';
    desc          = 'Phát hiện lửa hoặc rò rỉ khí gas mức nguy hiểm!';
    indicatorText = 'Khẩn cấp';
  }

  banner.className         = 'alert-banner ' + bannerClass;
  iconEl.className         = 'alert-icon ' + iconClass;
  titleEl.textContent      = title;
  descEl.textContent       = desc;
  indicator.className      = 'alert-indicator ' + alertClass;
  indicator.innerHTML      = `<span class="alert-dot"></span><span class="alert-text">${indicatorText}</span>`;
}

// ============================================================
//  DOOR DISPLAY
// ============================================================
function updateDoorDisplay(state, doorState) {
  state.doorState = doorState;
  const panel = state.panelEl;
  if (!panel) return;

  const display   = q(panel, 'doorDisplay');
  const stateText = q(panel, 'doorState');
  const pendingEl = q(panel, 'doorPending');

  if (display)   display.className   = `door-display ${doorState === 'OPEN' ? 'open' : 'closed'}`;
  if (stateText) stateText.textContent = doorState === 'OPEN' ? 'MỞ' : 'ĐÓNG';
  if (pendingEl) pendingEl.classList.remove('visible');
}

function setDoorPending(state) {
  const panel = state.panelEl;
  if (!panel) return;
  const pendingEl = q(panel, 'doorPending');
  if (pendingEl) pendingEl.classList.add('visible');
}

// ============================================================
//  EMERGENCY DISPLAY
// ============================================================
function updateEmergencyDisplay(state, status) {
  state.isEmergency = (status === 'EMERGENCY');
  const panel = state.panelEl;
  if (!panel) return;

  const statusBox = q(panel, 'emergencyStatusBox');
  const stateEl   = q(panel, 'emergencyState');
  const btnStop   = q(panel, 'btnStopAlarm');
  const btnEmer   = q(panel, 'btnEmergency');

  if (state.isEmergency) {
    if (statusBox) { statusBox.classList.add('emergency'); }
    if (stateEl)   { stateEl.innerHTML = '<i class="ph-bold ph-warning-circle state-icon"></i><span>CHẾ ĐỘ KHẨN CẤP</span>'; }
    if (btnStop)   { btnStop.style.display = ''; }
    if (btnEmer)   { btnEmer.style.display = 'none'; }
    addLog(`🚨 [${state.name}] KÍCH HOẠT CHẾ ĐỘ KHẨN CẤP`, 'error');
  } else {
    if (statusBox) { statusBox.classList.remove('emergency'); }
    if (stateEl)   { stateEl.innerHTML = '<i class="ph-bold ph-shield-check state-icon"></i><span>Hệ thống an toàn</span>'; }
    if (btnStop)   { btnStop.style.display = 'none'; }
    if (btnEmer)   { btnEmer.style.display = ''; }
    addLog(`✅ [${state.name}] Báo động đã dừng`, 'success');
  }
}

// ============================================================
//  SECURITY MODAL
// ============================================================
const MODAL_CONFIGS = {
  door_open: {
    title:    'Mở cửa thoát hiểm',
    subtitle: 'Nhập mã bảo mật để thực hiện',
    desc:     '🚪 Bạn muốn <strong>MỞ CỬA</strong> thoát hiểm?',
    iconClass:'ph-fill ph-lock-open',
    iconColor:'var(--green)',
    confirmText: 'Mở cửa',
    confirmClass: 'btn-modal-confirm confirm-green',
  },
  door_close: {
    title:    'Đóng cửa thoát hiểm',
    subtitle: 'Nhập mã bảo mật để thực hiện',
    desc:     '🚪 Bạn muốn <strong>ĐÓNG CỬA</strong> thoát hiểm?',
    iconClass:'ph-fill ph-lock-key',
    iconColor:'var(--text-secondary)',
    confirmText: 'Đóng cửa',
    confirmClass: 'btn-modal-confirm confirm-neutral',
  },
  emergency: {
    title:    'Báo động khẩn cấp',
    subtitle: 'Nhập mã bảo mật để kích hoạt',
    desc:     '🚨 Bạn muốn <strong>KÍCH HOẠT BÁO ĐỘNG KHẨN CẤP</strong>?<br><small>Còi báo sẽ bật và cửa sẽ mở.</small>',
    iconClass:'ph-fill ph-siren',
    iconColor:'var(--red)',
    confirmText: 'Kích hoạt',
    confirmClass: 'btn-modal-confirm confirm-red',
  },
  stop_alarm: {
    title:    'Dừng báo động',
    subtitle: 'Nhập mã bảo mật để dừng',
    desc:     '🛑 Bạn muốn <strong>DỪNG BÁO ĐỘNG</strong>?<br><small>Còi báo sẽ tắt và hệ thống trở về bình thường.</small>',
    iconClass:'ph-fill ph-speaker-slash',
    iconColor:'var(--orange)',
    confirmText: 'Dừng báo động',
    confirmClass: 'btn-modal-confirm confirm-orange',
  },
};

function openSecurityModal(actionType, deviceId, payload) {
  const state = kitStates.get(deviceId);
  if (state && !state.online) {
    addLog(`[${state ? state.name : deviceId}] ⚠️ Không thể điều khiển: thiết bị offline`, 'warning');
    return;
  }

  pendingAction = { type: actionType, deviceId, payload };

  const cfg = MODAL_CONFIGS[actionType];
  if (!cfg) return;

  // Populate modal
  document.getElementById('modalTitle').textContent    = cfg.title;
  document.getElementById('modalSubtitle').textContent = cfg.subtitle;
  document.getElementById('modalActionDesc').innerHTML = cfg.desc;
  document.getElementById('modalIcon').className       = `modal-icon ${cfg.iconClass}`;
  document.getElementById('modalIconWrap').style.color = cfg.iconColor;
  document.getElementById('modalIconWrap').style.borderColor = cfg.iconColor + '55';
  document.getElementById('modalIconWrap').style.boxShadow = `0 0 24px ${cfg.iconColor}44`;

  const confirmBtn = document.getElementById('btnModalConfirm');
  confirmBtn.className = cfg.confirmClass;
  document.getElementById('confirmBtnText').textContent = cfg.confirmText;

  // Reset pin
  document.getElementById('pinInput').value = '';
  document.getElementById('pinError').textContent = '';
  document.getElementById('pinInput').type = 'password';
  document.getElementById('pinToggleIcon').className = 'ph-bold ph-eye';

  // Show modal
  const modal = document.getElementById('securityModal');
  modal.classList.add('visible');
  setTimeout(() => document.getElementById('pinInput').focus(), 100);

  // Enter key support
  const pinInput = document.getElementById('pinInput');
  pinInput.onkeydown = (e) => { if (e.key === 'Enter') confirmSecurityModal(); };
}

function closeSecurityModal() {
  const modal = document.getElementById('securityModal');
  modal.classList.remove('visible');
  pendingAction = null;
  document.getElementById('pinInput').value = '';
  document.getElementById('pinError').textContent = '';
}

function confirmSecurityModal() {
  const pin = document.getElementById('pinInput').value;
  // Client-side check (actual enforcement on server is not possible without auth endpoint,
  // but for this project the code check is here)
  // Default code: "1234" — synced from server config or set here
  const EXPECTED_CODE = '1234'; // Should match config.js SECURITY_CODE

  if (!pin) {
    showPinError('Vui lòng nhập mã bảo mật');
    return;
  }

  if (pin !== EXPECTED_CODE) {
    showPinError('Mã bảo mật không đúng. Vui lòng thử lại.');
    document.getElementById('pinInput').value = '';
    shakeModal();
    return;
  }

  // Execute the pending action
  const action = pendingAction;
  closeSecurityModal();

  if (!action) return;

  const state = kitStates.get(action.deviceId);
  const kitName = state ? state.name : action.deviceId;

  switch (action.type) {
    case 'door_open':
    case 'door_close':
      socket.emit('controlDoor', { deviceId: action.deviceId, action: action.payload });
      if (state) setDoorPending(state);
      addLog(`[${kitName}] Gửi lệnh: ${action.payload === 'OPEN' ? 'MỞ' : 'ĐÓNG'} cửa`, action.payload === 'OPEN' ? 'success' : 'warning');
      break;

    case 'emergency':
      socket.emit('triggerEmergency', { deviceId: action.deviceId });
      addLog(`🚨 [${kitName}] Kích hoạt khẩn cấp — Bật còi báo, mở cửa...`, 'error');
      break;

    case 'stop_alarm':
      socket.emit('stopAlarm', { deviceId: action.deviceId });
      addLog(`🛑 [${kitName}] Gửi lệnh dừng báo động`, 'warning');
      break;
  }
}

function showPinError(msg) {
  const el = document.getElementById('pinError');
  el.textContent = msg;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 400);
}

function shakeModal() {
  const card = document.querySelector('.modal-card');
  card.classList.add('shake');
  setTimeout(() => card.classList.remove('shake'), 400);
}

function setupPinToggle() {
  document.getElementById('pinToggle').addEventListener('click', () => {
    const input = document.getElementById('pinInput');
    const icon  = document.getElementById('pinToggleIcon');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'ph-bold ph-eye-slash';
    } else {
      input.type = 'password';
      icon.className = 'ph-bold ph-eye';
    }
  });
}

// Close modal on backdrop click
document.getElementById('securityModal').addEventListener('click', function(e) {
  if (e.target === this) closeSecurityModal();
});

// ============================================================
//  CHART.JS
// ============================================================
function initChart(state, deviceId) {
  const panel = state.panelEl;
  if (!panel) return;

  const canvasEl = panel.querySelector('[data-role="sensorChart"]');
  if (!canvasEl) return;

  const ctx = canvasEl.getContext('2d');

  const tempGrad = ctx.createLinearGradient(0, 0, 0, 400);
  tempGrad.addColorStop(0, 'rgba(249,115,22,0.4)');
  tempGrad.addColorStop(1, 'rgba(249,115,22,0.0)');

  const humGrad = ctx.createLinearGradient(0, 0, 0, 400);
  humGrad.addColorStop(0, 'rgba(6,182,212,0.4)');
  humGrad.addColorStop(1, 'rgba(6,182,212,0.0)');

  const smokeGrad = ctx.createLinearGradient(0, 0, 0, 400);
  smokeGrad.addColorStop(0, 'rgba(234,179,8,0.4)');
  smokeGrad.addColorStop(1, 'rgba(234,179,8,0.0)');

  state.chart = new Chart(canvasEl, {
    type: 'line',
    data: {
      labels: state.chartData.labels,
      datasets: [
        {
          label: 'Nhiệt độ (°C)',
          data: state.chartData.temperature,
          borderColor: '#f97316', backgroundColor: tempGrad,
          borderWidth: 3, fill: true, tension: 0.4,
          pointRadius: 0, pointHoverRadius: 6,
          pointBackgroundColor: '#f97316', pointBorderColor: '#fff', pointBorderWidth: 2,
          yAxisID: 'y',
        },
        {
          label: 'Độ ẩm (%)',
          data: state.chartData.humidity,
          borderColor: '#06b6d4', backgroundColor: humGrad,
          borderWidth: 3, fill: true, tension: 0.4,
          pointRadius: 0, pointHoverRadius: 6,
          pointBackgroundColor: '#06b6d4', pointBorderColor: '#fff', pointBorderWidth: 2,
          yAxisID: 'y1',
        },
        {
          label: 'Khí Gas (Δ raw)',
          data: state.chartData.smoke,
          borderColor: '#eab308', backgroundColor: smokeGrad,
          borderWidth: 3, fill: true, tension: 0.4,
          pointRadius: 0, pointHoverRadius: 6,
          pointBackgroundColor: '#eab308', pointBorderColor: '#fff', pointBorderWidth: 2,
          yAxisID: 'y2',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(20,20,22,0.9)',
          titleFont: { family: "'Space Grotesk', sans-serif", size: 14 },
          bodyFont:  { family: "'Inter', sans-serif", size: 13 },
          padding: 12, cornerRadius: 8,
          borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, boxPadding: 6,
        },
      },
      scales: {
        x: {
          grid:  { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#a1a1aa', font: { size: 11, family: "'Space Grotesk', sans-serif" }, maxTicksLimit: 10 },
        },
        y: {
          type: 'linear', display: true, position: 'left',
          grid:  { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#f97316', font: { size: 11, family: "'Space Grotesk', sans-serif" } },
        },
        y1: {
          type: 'linear', display: true, position: 'right',
          grid:  { display: false },
          ticks: { color: '#06b6d4', font: { size: 11, family: "'Space Grotesk', sans-serif" } },
        },
        y2: { type: 'linear', display: false },
      },
    },
  });
}

function addChartData(state, data) {
  const time = new Date(data.timestamp || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  state.chartData.labels.push(time);
  state.chartData.temperature.push(isValidTemperature(data.temperature) ? data.temperature : null);
  state.chartData.humidity.push(isValidHumidity(data.humidity) ? data.humidity : null);
  state.chartData.smoke.push(isValidGasDelta(data.smoke_delta) ? Math.max(0, data.smoke_delta) : (isValidSmoke(data.smoke) ? data.smoke : null));

  if (state.chartData.labels.length > MAX_CHART_POINTS) {
    state.chartData.labels.shift();
    state.chartData.temperature.shift();
    state.chartData.humidity.shift();
    state.chartData.smoke.shift();
  }
}

function updateChart(state, data) {
  addChartData(state, data);
  if (state.chart) {
    state.chart.data.labels            = state.chartData.labels;
    state.chart.data.datasets[0].data  = state.chartData.temperature;
    state.chart.data.datasets[1].data  = state.chartData.humidity;
    state.chart.data.datasets[2].data  = state.chartData.smoke;
    state.chart.update('none');
  }
}

function toggleDataset(state, datasetName, btn) {
  if (!state.datasetVisibility.hasOwnProperty(datasetName)) return;
  state.datasetVisibility[datasetName] = !state.datasetVisibility[datasetName];
  btn.classList.toggle('active', state.datasetVisibility[datasetName]);

  const indexMap = { temperature: 0, humidity: 1, smoke: 2 };
  if (state.chart && indexMap[datasetName] !== undefined) {
    state.chart.getDatasetMeta(indexMap[datasetName]).hidden = !state.datasetVisibility[datasetName];
    state.chart.update('none');
  }
}

// ============================================================
//  HELPERS
// ============================================================
// Query by data-role within a panel
function q(panel, role) {
  return panel.querySelector(`[data-role="${role}"]`);
}

function updateLastUpdateTime(state) {
  const panel = state.panelEl;
  if (!panel) return;
  const el   = q(panel, 'lastUpdate');
  const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (el) el.innerHTML = `<i class="ph-bold ph-clock"></i> Cập nhật: ${time}`;
}

// ============================================================
//  ACTIVITY LOG
// ============================================================
function addLog(message, type = 'info') {
  const container = document.getElementById('logContainer');
  const entry     = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-msg">${message}</span>`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

function clearLog() {
  document.getElementById('logContainer').innerHTML =
    '<div class="log-entry"><span class="log-time">[--:--:--]</span> <span class="log-msg">Nhật ký đã xóa...</span></div>';
}
