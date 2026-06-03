// ============================================================
//  APP.JS — Fire Alarm System Dashboard
//  Nguyễn Nhật Minh — 20225886
//
//  Premium Redesign: Optimized Chart.js, Glowing Gauges
// ============================================================

// ============================================================
//  SOCKET.IO CONNECTION
// ============================================================
const socket = io();

// ============================================================
//  STATE
// ============================================================
let sensorChart = null;
let fireLevel = 1; // 1: Normal, 2: Warning, 3: Emergency
let doorState = 'CLOSED'; // OPEN or CLOSED
let isEmergency = false;

const GAUGE_CIRCUMFERENCE = 314.159; // 2 * PI * 50
const MAX_CHART_POINTS = 50;

// Chart data buffers
const chartData = {
  labels: [],
  temperature: [],
  humidity: [],
  smoke: [],
};

// Dataset visibility
const datasetVisibility = {
  temperature: true,
  humidity: true,
  smoke: true,
};

// ============================================================
//  INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initChart();
  setupSocketListeners();
  addLog('Hệ thống báo cháy đang khởi tạo...', 'info');
});

// ============================================================
//  SOCKET.IO EVENT LISTENERS
// ============================================================
function setupSocketListeners() {
  socket.on('connect', () => {
    addLog('Kết nối server thành công!', 'success');
    setConnectionStatus(true);
  });

  socket.on('disconnect', () => {
    setConnectionStatus(false);
    addLog('Mất kết nối server. Đang thử lại...', 'error');
  });

  socket.on('mqttStatus', (data) => {
    setConnectionStatus(data.connected);
    if (data.connected) {
      addLog('MQTT Broker đã kết nối', 'success');
    } else {
      addLog('MQTT Broker mất kết nối', 'warning');
    }
  });

  socket.on('fireAlarmData', (data) => {
    updateSensorDisplay(data);
    updateFireLevel(data.level || 1);
    updateFlameIndicator(data.flame || false);
    updateChart(data);
    updateLastUpdateTime();
  });

  socket.on('doorStatus', (state) => {
    updateDoorDisplay(state);
  });

  socket.on('emergencyStatus', (status) => {
    updateEmergencyDisplay(status);
  });

  socket.on('history', (history) => {
    if (history && history.length > 0) {
      addLog(`Đã nhận ${history.length} bản ghi lịch sử`, 'info');
      history.forEach(data => {
        addChartData(data);
      });
      if (sensorChart) sensorChart.update('none');

      // Update display with latest data
      const latest = history[history.length - 1];
      updateSensorDisplay(latest);
      updateFireLevel(latest.level || 1);
      updateFlameIndicator(latest.flame || false);
    }
  });
}

// ============================================================
//  CONNECTION STATUS
// ============================================================
function setConnectionStatus(connected) {
  const badge = document.getElementById('connectionBadge');
  const text = document.getElementById('connText');

  if (connected) {
    badge.className = 'connection-badge connected';
    text.textContent = 'Đã kết nối';
  } else {
    badge.className = 'connection-badge disconnected';
    text.textContent = 'Mất kết nối';
  }
}

// ============================================================
//  SENSOR DISPLAY UPDATE
// ============================================================
function updateSensorDisplay(data) {
  // Temperature
  if (data.temperature !== undefined) {
    const temp = data.temperature;
    document.getElementById('tempValue').textContent = temp.toFixed(1);
    setGauge('tempGauge', temp, 100); // 0-100°C range
  }

  // Humidity
  if (data.humidity !== undefined) {
    const hum = data.humidity;
    document.getElementById('humValue').textContent = hum.toFixed(1);
    setGauge('humGauge', hum, 100);
  }

  // Smoke (Gas CO)
  if (data.smoke !== undefined) {
    const smoke = data.smoke;
    document.getElementById('smokeValue').textContent = Math.round(smoke);
    setGauge('smokeGauge', Math.min(smoke / 50, 100), 100); // Normalize to 0-100
    
    const smokeStatus = document.getElementById('smokeStatus');
    if (smoke > 2000) {
      smokeStatus.innerHTML = '<i class="ph-fill ph-warning-circle"></i> Nguy hiểm';
      smokeStatus.style.color = 'var(--red)';
    } else if (smoke > 1000) {
      smokeStatus.innerHTML = '<i class="ph-fill ph-warning"></i> Cảnh báo';
      smokeStatus.style.color = 'var(--yellow)';
    } else if (smoke > 500) {
      smokeStatus.innerHTML = '<i class="ph-fill ph-info"></i> Chú ý';
      smokeStatus.style.color = 'var(--orange)';
    } else {
      smokeStatus.innerHTML = '<i class="ph-fill ph-check-circle"></i> Bình thường';
      smokeStatus.style.color = 'var(--green)';
    }
  }
}

// ============================================================
//  GAUGE ANIMATION
// ============================================================
function setGauge(gaugeId, value, max) {
  const gauge = document.getElementById(gaugeId);
  if (!gauge) return;

  const pct = Math.min(Math.max(value / max, 0), 1);
  const offset = GAUGE_CIRCUMFERENCE * (1 - pct);
  gauge.style.strokeDashoffset = offset;
}

// ============================================================
//  FLAME INDICATOR
// ============================================================
function updateFlameIndicator(hasFlame) {
  const indicator = document.getElementById('flameIndicator');
  const status = document.getElementById('flameStatus');
  
  if (hasFlame) {
    indicator.classList.add('detected');
    status.innerHTML = '<span class="status-text" style="color: var(--red); font-weight: 700;"><i class="ph-fill ph-warning"></i> PHÁT HIỆN LỬA!</span>';
    addLog('⚠️ CẢNH BÁO: Phát hiện lửa!', 'error');
  } else {
    indicator.classList.remove('detected');
    status.innerHTML = '<span class="status-text">Không phát hiện</span>';
  }
}

// ============================================================
//  FIRE LEVEL UPDATE
// ============================================================
function updateFireLevel(level) {
  fireLevel = level;
  
  // Update level indicator
  const levelIndicator = document.getElementById('levelIndicator');
  const levelSection = document.getElementById('level-section');
  const banner = document.getElementById('alertBanner');
  const alertStatus = document.getElementById('alertStatus');
  
  let levelWidth, levelClass, bannerClass, alertClass, alertIconClass, alertTitle, alertDesc;
  
  if (level === 1) {
    levelWidth = '33%';
    levelClass = 'level-1';
    bannerClass = 'level-1';
    alertClass = 'normal';
    alertIconClass = 'ph-bold ph-check-circle';
    alertTitle = 'Trạng thái bình thường';
    alertDesc = 'Không phát hiện mối nguy hiểm';
  } else if (level === 2) {
    levelWidth = '66%';
    levelClass = 'level-2';
    bannerClass = 'level-2';
    alertClass = 'warning';
    alertIconClass = 'ph-bold ph-warning';
    alertTitle = 'Cảnh báo hệ thống';
    alertDesc = 'Phát hiện khí gas cao hoặc nhiệt độ tăng bất thường';
  } else {
    levelWidth = '100%';
    levelClass = 'level-3';
    bannerClass = 'level-3';
    alertClass = 'danger';
    alertIconClass = 'ph-bold ph-siren';
    alertTitle = 'BÁO ĐỘNG KHẨN CẤP';
    alertDesc = 'Phát hiện lửa hoặc rò rỉ khí gas mức nguy hiểm!';
    isEmergency = true;
  }
  
  levelIndicator.style.width = levelWidth;
  levelSection.className = 'section level-section ' + levelClass;
  banner.className = 'alert-banner ' + bannerClass;
  
  document.getElementById('alertBannerIcon').className = 'alert-icon ' + alertIconClass;
  document.getElementById('alertTitle').textContent = alertTitle;
  document.getElementById('alertDescription').textContent = alertDesc;
  
  const indicator = alertStatus.querySelector('.alert-indicator');
  indicator.className = 'alert-indicator ' + alertClass;
  
  if (alertClass === 'normal') {
    indicator.innerHTML = '<span class="alert-dot"></span><span class="alert-text">Bình thường</span>';
  } else if (alertClass === 'warning') {
    indicator.innerHTML = '<span class="alert-dot"></span><span class="alert-text">Cảnh báo</span>';
  } else {
    indicator.innerHTML = '<span class="alert-dot"></span><span class="alert-text">Khẩn cấp</span>';
  }
  
  // Log level changes
  if (level > 1) {
    addLog(`Cấp độ báo động thay đổi: Cấp ${level}`, level === 3 ? 'error' : 'warning');
  }
}

// ============================================================
//  DOOR DISPLAY
// ============================================================
function updateDoorDisplay(state) {
  doorState = state;
  const display = document.getElementById('doorDisplay');
  const stateText = document.getElementById('doorState');

  if (state === 'OPEN') {
    display.className = 'door-display open';
    stateText.textContent = 'MỞ';
  } else {
    display.className = 'door-display closed';
    stateText.textContent = 'ĐÓNG';
  }
}

// ============================================================
//  EMERGENCY DISPLAY
// ============================================================
function updateEmergencyDisplay(status) {
  const emergencyStatus = document.getElementById('emergencyStatus');
  const emergencyState = document.getElementById('emergencyState');
  
  if (status === 'EMERGENCY') {
    emergencyStatus.classList.add('emergency');
    emergencyState.innerHTML = '<i class="ph-bold ph-warning-circle state-icon"></i><span>CHẾ ĐỘ KHẨN CẤP</span>';
    addLog('🚨 KÍCH HOẠT CHẾ ĐỘ KHẨN CẤP', 'error');
  } else {
    emergencyStatus.classList.remove('emergency');
    emergencyState.innerHTML = '<i class="ph-bold ph-shield-check state-icon"></i><span>Hệ thống an toàn</span>';
  }
}

// ============================================================
//  CONTROL FUNCTIONS
// ============================================================
function controlDoor(action) {
  socket.emit('controlDoor', action);
  const actionText = action === 'OPEN' ? 'MỞ' : 'ĐÓNG';
  addLog(`Gửi lệnh: ${actionText} cửa thoát hiểm`, action === 'OPEN' ? 'success' : 'warning');
}

function triggerEmergency() {
  if (confirm('Bạn chắc chắn muốn kích hoạt chế độ khẩn cấp? Hành động này không thể hoàn tác ngay lập tức!')) {
    socket.emit('triggerEmergency');
    addLog('🚨 KÍCH HOẠT KHẨN CẤP - Bật còi báo, mở cửa...', 'error');
  }
}

// ============================================================
//  CHART.JS INITIALIZATION
// ============================================================
function initChart() {
  const ctx = document.getElementById('sensorChart');
  if (!ctx) return;
  
  // Custom Gradients for Chart
  const ctxCanvas = ctx.getContext('2d');
  
  const tempGrad = ctxCanvas.createLinearGradient(0, 0, 0, 400);
  tempGrad.addColorStop(0, 'rgba(249, 115, 22, 0.4)');
  tempGrad.addColorStop(1, 'rgba(249, 115, 22, 0.0)');
  
  const humGrad = ctxCanvas.createLinearGradient(0, 0, 0, 400);
  humGrad.addColorStop(0, 'rgba(6, 182, 212, 0.4)');
  humGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

  const smokeGrad = ctxCanvas.createLinearGradient(0, 0, 0, 400);
  smokeGrad.addColorStop(0, 'rgba(234, 179, 8, 0.4)');
  smokeGrad.addColorStop(1, 'rgba(234, 179, 8, 0.0)');

  sensorChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.labels,
      datasets: [
        {
          label: 'Nhiệt độ (°C)',
          data: chartData.temperature,
          borderColor: '#f97316',
          backgroundColor: tempGrad,
          borderWidth: 3,
          fill: true,
          tension: 0.4, // Smooth curves
          pointRadius: 0,
          pointHoverRadius: 6,
          pointBackgroundColor: '#f97316',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          yAxisID: 'y',
          hidden: !datasetVisibility.temperature,
        },
        {
          label: 'Độ ẩm (%)',
          data: chartData.humidity,
          borderColor: '#06b6d4',
          backgroundColor: humGrad,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointBackgroundColor: '#06b6d4',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          yAxisID: 'y1',
          hidden: !datasetVisibility.humidity,
        },
        {
          label: 'Khí Gas (ppm)',
          data: chartData.smoke,
          borderColor: '#eab308',
          backgroundColor: smokeGrad,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointBackgroundColor: '#eab308',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          yAxisID: 'y2',
          hidden: !datasetVisibility.smoke,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(20, 20, 22, 0.9)',
          titleFont: { family: "'Space Grotesk', sans-serif", size: 14 },
          bodyFont: { family: "'Inter', sans-serif", size: 13 },
          padding: 12,
          cornerRadius: 8,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          boxPadding: 6,
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false,
          },
          ticks: {
            color: '#a1a1aa',
            font: { size: 11, family: "'Space Grotesk', sans-serif" },
            maxTicksLimit: 10
          },
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: false,
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false,
          },
          ticks: {
            color: '#f97316',
            font: { size: 11, family: "'Space Grotesk', sans-serif" },
          },
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { display: false },
          ticks: {
            color: '#06b6d4',
            font: { size: 11, family: "'Space Grotesk', sans-serif" },
          },
        },
        y2: {
          type: 'linear',
          display: false, // Hidden to avoid cluttering axis, tooltips handle it
        },
      },
    },
  });
}

// ============================================================
//  CHART DATA MANAGEMENT
// ============================================================
function addChartData(data) {
  const time = new Date(data.timestamp || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  chartData.labels.push(time);
  if (data.temperature !== undefined) chartData.temperature.push(data.temperature);
  if (data.humidity !== undefined) chartData.humidity.push(data.humidity);
  if (data.smoke !== undefined) chartData.smoke.push(data.smoke);
  
  // Limit to MAX_CHART_POINTS
  if (chartData.labels.length > MAX_CHART_POINTS) {
    chartData.labels.shift();
    chartData.temperature.shift();
    chartData.humidity.shift();
    chartData.smoke.shift();
  }
}

function updateChart(data) {
  addChartData(data);
  if (sensorChart) {
    sensorChart.data.labels = chartData.labels;
    sensorChart.data.datasets[0].data = chartData.temperature;
    sensorChart.data.datasets[1].data = chartData.humidity;
    sensorChart.data.datasets[2].data = chartData.smoke;
    sensorChart.update('none');
  }
}

function toggleDataset(datasetName) {
  if (datasetVisibility.hasOwnProperty(datasetName)) {
    datasetVisibility[datasetName] = !datasetVisibility[datasetName];
    
    const btn = document.querySelector(`[data-dataset="${datasetName}"]`);
    if (btn) {
      btn.classList.toggle('active', datasetVisibility[datasetName]);
    }
    
    const indexMap = { temperature: 0, humidity: 1, smoke: 2 };
    if (sensorChart && indexMap[datasetName] !== undefined) {
      sensorChart.getDatasetMeta(indexMap[datasetName]).hidden = !datasetVisibility[datasetName];
      sensorChart.update('none');
    }
  }
}

// ============================================================
//  ACTIVITY LOG
// ============================================================
function addLog(message, type = 'info') {
  const container = document.getElementById('logContainer');
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  
  const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-msg">${message}</span>`;
  
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

function clearLog() {
  const container = document.getElementById('logContainer');
  container.innerHTML = '<div class="log-entry"><span class="log-time">[--:--:--]</span> <span class="log-msg">Nhật ký đã xóa...</span></div>';
  addLog('Nhật ký hoạt động đã được xóa', 'info');
}

function updateLastUpdateTime() {
  const lastUpdate = document.getElementById('lastUpdate');
  const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  lastUpdate.innerHTML = `<i class="ph-bold ph-clock"></i> Cập nhật: ${time}`;
}
