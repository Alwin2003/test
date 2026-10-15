/**
 * FASHN VTON 1.5 Studio - Interactive Frontend Client Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    personBase64: null,
    garmentBase64: null,
    category: 'tops',
    garmentPhotoType: 'model',
    timesteps: 30,
    guidanceScale: 1.5,
    seed: 42,
    segmentationFree: true,
    viewMode: 'compare', // 'compare' | 'result' | 'side'
    isGenerating: false,
    history: [],
    currentResult: null,
  };

  // DOM Elements - Navigation & Status
  const statusDot = document.getElementById('server-status-dot');
  const statusLabel = document.getElementById('server-status-label');
  const deviceBadge = document.getElementById('server-device-badge');
  const btnRefreshStatus = document.getElementById('btn-refresh-status');
  const noticeBanner = document.getElementById('notice-banner');
  const noticeTitle = document.getElementById('notice-title');
  const noticeDesc = document.getElementById('notice-desc');
  const btnBannerAction = document.getElementById('btn-banner-action');
  const btnCloseBanner = document.getElementById('btn-close-banner');
  const footerHostBadge = document.getElementById('footer-host-badge');

  // DOM Elements - Presets
  const modelPresetsContainer = document.getElementById('model-presets-container');
  const garmentPresetsContainer = document.getElementById('garment-presets-container');

  // DOM Elements - Uploads
  const personDropzone = document.getElementById('person-dropzone');
  const personFileInput = document.getElementById('person-file-input');
  const btnBrowsePerson = document.getElementById('btn-browse-person');
  const btnClearPerson = document.getElementById('btn-clear-person');
  const personDropEmpty = document.getElementById('person-drop-empty');
  const personPreviewWrapper = document.getElementById('person-preview-wrapper');
  const personPreviewImg = document.getElementById('person-preview-img');

  const garmentDropzone = document.getElementById('garment-dropzone');
  const garmentFileInput = document.getElementById('garment-file-input');
  const btnBrowseGarment = document.getElementById('btn-browse-garment');
  const btnClearGarment = document.getElementById('btn-clear-garment');
  const garmentDropEmpty = document.getElementById('garment-drop-empty');
  const garmentPreviewWrapper = document.getElementById('garment-preview-wrapper');
  const garmentPreviewImg = document.getElementById('garment-preview-img');

  // DOM Elements - Parameters
  const categoryButtons = document.querySelectorAll('#category-group .segment-btn');
  const photoTypeButtons = document.querySelectorAll('#photo-type-group .segment-btn');
  const accordionToggle = document.getElementById('accordion-toggle');
  const accordionContent = document.getElementById('accordion-content');
  const accordionArrow = document.getElementById('accordion-arrow');

  const inputTimesteps = document.getElementById('input-timesteps');
  const valTimesteps = document.getElementById('val-timesteps');
  const inputGuidance = document.getElementById('input-guidance');
  const valGuidance = document.getElementById('val-guidance');
  const inputSeed = document.getElementById('input-seed');
  const btnRandomSeed = document.getElementById('btn-random-seed');
  const inputSegFree = document.getElementById('input-seg-free');
  const btnRunTryon = document.getElementById('btn-run-tryon');

  // DOM Elements - Output & Comparison
  const resultStatusText = document.getElementById('result-status-text');
  const btnViewCompare = document.getElementById('btn-view-compare');
  const btnViewResult = document.getElementById('btn-view-result');
  const btnViewSide = document.getElementById('btn-view-side');
  const btnDownloadResult = document.getElementById('btn-download-result');

  const displayEmpty = document.getElementById('display-empty');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingStepText = document.getElementById('loading-step-text');
  const compareWrapper = document.getElementById('compare-wrapper');
  const compareContainer = document.getElementById('compare-container');
  const compareImgBefore = document.getElementById('compare-img-before');
  const compareImgAfter = document.getElementById('compare-img-after');
  const compareClipped = document.getElementById('compare-clipped');
  const compareHandle = document.getElementById('compare-handle');

  const resultPureWrapper = document.getElementById('result-pure-wrapper');
  const resultPureImg = document.getElementById('result-pure-img');
  const sideWrapper = document.getElementById('side-wrapper');
  const sideImgOriginal = document.getElementById('side-img-original');
  const sideImgResult = document.getElementById('side-img-result');

  const metricsBar = document.getElementById('metrics-bar');
  const metricTime = document.getElementById('metric-time');
  const metricCat = document.getElementById('metric-cat');
  const metricRes = document.getElementById('metric-res');
  const metricSeed = document.getElementById('metric-seed');

  const historyStrip = document.getElementById('history-strip');
  const historyCounter = document.getElementById('history-counter');
  const historyEmptyText = document.getElementById('history-empty-text');

  // Modal
  const zoomModal = document.getElementById('zoom-modal');
  const modalImg = document.getElementById('modal-img');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnModalDownload = document.getElementById('btn-modal-download');
  const toastContainer = document.getElementById('toast-container');

  // Setup current server host display in footer
  if (footerHostBadge) {
    footerHostBadge.textContent = `${window.location.protocol}//${window.location.host}`;
  }

  /* ---------------------------------------------------------
   * Toast Notifications
   * --------------------------------------------------------- */
  function showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'warning' ? '⚠' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* ---------------------------------------------------------
   * Server Health & Status Check
   * --------------------------------------------------------- */
  async function checkServerStatus() {
    try {
      statusLabel.textContent = 'Checking Status...';
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error('Server not responding');
      const data = await res.json();

      statusDot.className = 'status-indicator ready';
      statusLabel.textContent = data.weights_ready ? 'Engine Ready' : 'Engine Ready (Weights pending)';
      deviceBadge.textContent = data.device_name || (data.cuda_available ? 'CUDA GPU' : 'CPU Mode');

      if (!data.weights_ready) {
        noticeTitle.textContent = 'Weights Required for Real-time Inference';
        noticeDesc.textContent = 'Weights not detected in ./weights. You can download them (~2GB) or test interface in preview mode.';
        btnBannerAction.textContent = 'Download Weights';
        btnBannerAction.onclick = triggerDownloadWeights;
        noticeBanner.classList.remove('hidden');
      } else {
        noticeBanner.classList.add('hidden');
      }
    } catch (err) {
      statusDot.className = 'status-indicator warning';
      statusLabel.textContent = 'Connected (Local)';
      deviceBadge.textContent = 'Standby';
    }
  }

  async function triggerDownloadWeights() {
    btnBannerAction.disabled = true;
    btnBannerAction.textContent = 'Downloading...';
    showToast('Starting weight download in background. Check server console for progress.', 'info');
    try {
      const res = await fetch('/api/download_weights', { method: 'POST' });
      const data = await res.json();
      showToast(data.message || 'Download started', 'success');
    } catch (err) {
      showToast('Download request failed: ' + err.message, 'error');
    } finally {
      setTimeout(checkServerStatus, 5000);
    }
  }

  btnRefreshStatus?.addEventListener('click', checkServerStatus);
  btnCloseBanner?.addEventListener('click', () => noticeBanner.classList.add('hidden'));

  /* ---------------------------------------------------------
   * File Helpers: Read File / URL to Base64
   * --------------------------------------------------------- */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function urlToBase64(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return fileToBase64(blob);
  }

  /* ---------------------------------------------------------
   * Image Setters & Drag-and-Drop
   * --------------------------------------------------------- */
  function setPersonImage(base64) {
    state.personBase64 = base64;
    personPreviewImg.src = base64;
    personDropEmpty.classList.add('hidden');
    personPreviewWrapper.classList.remove('hidden');
    btnClearPerson.classList.remove('hidden');
  }

  function clearPersonImage() {
    state.personBase64 = null;
    personPreviewImg.src = '';
    personPreviewWrapper.classList.add('hidden');
    personDropEmpty.classList.remove('hidden');
    btnClearPerson.classList.add('hidden');
    personFileInput.value = '';
    document.querySelectorAll('#model-presets-container .preset-chip').forEach(c => c.classList.remove('active'));
  }

  function setGarmentImage(base64) {
    state.garmentBase64 = base64;
    garmentPreviewImg.src = base64;
    garmentDropEmpty.classList.add('hidden');
    garmentPreviewWrapper.classList.remove('hidden');
    btnClearGarment.classList.remove('hidden');
  }

  function clearGarmentImage() {
    state.garmentBase64 = null;
    garmentPreviewImg.src = '';
    garmentPreviewWrapper.classList.add('hidden');
    garmentDropEmpty.classList.remove('hidden');
    btnClearGarment.classList.add('hidden');
    garmentFileInput.value = '';
    document.querySelectorAll('#garment-presets-container .preset-chip').forEach(c => c.classList.remove('active'));
  }

  // Browse buttons
  btnBrowsePerson.addEventListener('click', (e) => {
    e.stopPropagation();
    personFileInput.click();
  });
  btnClearPerson.addEventListener('click', (e) => {
    e.stopPropagation();
    clearPersonImage();
  });
  personFileInput.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      setPersonImage(base64);
      showToast('Person photo loaded', 'info', 2000);
    }
  });

  btnBrowseGarment.addEventListener('click', (e) => {
    e.stopPropagation();
    garmentFileInput.click();
  });
  btnClearGarment.addEventListener('click', (e) => {
    e.stopPropagation();
    clearGarmentImage();
  });
  garmentFileInput.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      setGarmentImage(base64);
      showToast('Garment photo loaded', 'info', 2000);
    }
  });

  // Drag and drop events for person
  ['dragenter', 'dragover'].forEach(name => {
    personDropzone.addEventListener(name, (e) => {
      e.preventDefault();
      personDropzone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(name => {
    personDropzone.addEventListener(name, (e) => {
      e.preventDefault();
      personDropzone.classList.remove('dragover');
    });
  });
  personDropzone.addEventListener('drop', async (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const base64 = await fileToBase64(e.dataTransfer.files[0]);
      setPersonImage(base64);
      showToast('Person photo dropped', 'info', 2000);
    }
  });

  // Drag and drop events for garment
  ['dragenter', 'dragover'].forEach(name => {
    garmentDropzone.addEventListener(name, (e) => {
      e.preventDefault();
      garmentDropzone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(name => {
    garmentDropzone.addEventListener(name, (e) => {
      e.preventDefault();
      garmentDropzone.classList.remove('dragover');
    });
  });
  garmentDropzone.addEventListener('drop', async (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const base64 = await fileToBase64(e.dataTransfer.files[0]);
      setGarmentImage(base64);
      showToast('Garment photo dropped', 'info', 2000);
    }
  });

  /* ---------------------------------------------------------
   * Preset Selection
   * --------------------------------------------------------- */
  modelPresetsContainer.addEventListener('click', async (e) => {
    const chip = e.target.closest('.preset-chip');
    if (!chip) return;
    document.querySelectorAll('#model-presets-container .preset-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    const src = chip.getAttribute('data-src');
    try {
      const base64 = await urlToBase64(src);
      setPersonImage(base64);
      showToast('Loaded preset model', 'info', 2000);
    } catch (err) {
      showToast('Could not load preset: ' + err.message, 'error');
    }
  });

  garmentPresetsContainer.addEventListener('click', async (e) => {
    const chip = e.target.closest('.preset-chip');
    if (!chip) return;
    document.querySelectorAll('#garment-presets-container .preset-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    const src = chip.getAttribute('data-src');
    const cat = chip.getAttribute('data-category');
    const photo = chip.getAttribute('data-photo');

    if (cat) setCategory(cat);
    if (photo) setPhotoType(photo);

    try {
      const base64 = await urlToBase64(src);
      setGarmentImage(base64);
      showToast('Loaded preset garment', 'info', 2000);
    } catch (err) {
      showToast('Could not load preset: ' + err.message, 'error');
    }
  });

  /* ---------------------------------------------------------
   * Category & Parameters Selection
   * --------------------------------------------------------- */
  function setCategory(val) {
    state.category = val;
    categoryButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-value') === val);
    });
  }

  function setPhotoType(val) {
    state.garmentPhotoType = val;
    photoTypeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-value') === val);
    });
  }

  categoryButtons.forEach(btn => {
    btn.addEventListener('click', () => setCategory(btn.getAttribute('data-value')));
  });

  photoTypeButtons.forEach(btn => {
    btn.addEventListener('click', () => setPhotoType(btn.getAttribute('data-value')));
  });

  // Accordion Toggle
  accordionToggle.addEventListener('click', () => {
    const isHidden = accordionContent.classList.contains('hidden');
    if (isHidden) {
      accordionContent.classList.remove('hidden');
      accordionArrow.classList.add('rotated');
    } else {
      accordionContent.classList.add('hidden');
      accordionArrow.classList.remove('rotated');
    }
  });

  // Timesteps slider
  inputTimesteps.addEventListener('input', (e) => {
    state.timesteps = parseInt(e.target.value, 10);
    valTimesteps.textContent = `${state.timesteps} steps`;
  });

  // Guidance slider
  inputGuidance.addEventListener('input', (e) => {
    state.guidanceScale = parseFloat(e.target.value);
    valGuidance.textContent = state.guidanceScale.toFixed(1);
  });

  // Seed & Randomize
  inputSeed.addEventListener('input', (e) => {
    state.seed = parseInt(e.target.value, 10) || 42;
  });

  btnRandomSeed.addEventListener('click', () => {
    const randomVal = Math.floor(Math.random() * 999999);
    inputSeed.value = randomVal;
    state.seed = randomVal;
    showToast(`New Seed: ${randomVal}`, 'info', 1500);
  });

  // Segmentation free toggle
  inputSegFree.addEventListener('change', (e) => {
    state.segmentationFree = e.target.checked;
  });

  /* ---------------------------------------------------------
   * Interactive Before/After Compare Slider
   * --------------------------------------------------------- */
  let isDraggingCompare = false;

  function updateCompareSlider(clientX) {
    if (!compareContainer) return;
    const rect = compareContainer.getBoundingClientRect();
    let x = clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;
    const percentage = (x / rect.width) * 100;
    compareClipped.style.width = `${percentage}%`;
    compareHandle.style.left = `${percentage}%`;
  }

  compareContainer.addEventListener('mousedown', (e) => {
    isDraggingCompare = true;
    updateCompareSlider(e.clientX);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDraggingCompare) return;
    updateCompareSlider(e.clientX);
  });

  window.addEventListener('mouseup', () => {
    isDraggingCompare = false;
  });

  // Touch Support
  compareContainer.addEventListener('touchstart', (e) => {
    isDraggingCompare = true;
    if (e.touches && e.touches[0]) updateCompareSlider(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isDraggingCompare) return;
    if (e.touches && e.touches[0]) updateCompareSlider(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener('touchend', () => {
    isDraggingCompare = false;
  });

  /* ---------------------------------------------------------
   * View Mode Switcher
   * --------------------------------------------------------- */
  function setViewMode(mode) {
    state.viewMode = mode;
    btnViewCompare.classList.toggle('active', mode === 'compare');
    btnViewResult.classList.toggle('active', mode === 'result');
    btnViewSide.classList.toggle('active', mode === 'side');

    if (!state.currentResult) return;

    compareWrapper.classList.toggle('hidden', mode !== 'compare');
    resultPureWrapper.classList.toggle('hidden', mode !== 'result');
    sideWrapper.classList.toggle('hidden', mode !== 'side');
  }

  btnViewCompare.addEventListener('click', () => setViewMode('compare'));
  btnViewResult.addEventListener('click', () => setViewMode('result'));
  btnViewSide.addEventListener('click', () => setViewMode('side'));

  /* ---------------------------------------------------------
   * Run Try-On Generation
   * --------------------------------------------------------- */
  btnRunTryon.addEventListener('click', async () => {
    if (state.isGenerating) return;

    // Validation
    if (!state.personBase64) {
      showToast('Please upload or select a Person image first!', 'warning');
      return;
    }
    if (!state.garmentBase64) {
      showToast('Please upload or select a Garment image first!', 'warning');
      return;
    }

    state.isGenerating = true;
    btnRunTryon.disabled = true;
    loadingOverlay.classList.remove('hidden');
    displayEmpty.classList.add('hidden');
    resultStatusText.textContent = 'Running inference pipeline...';
    statusDot.className = 'status-indicator busy';

    // Step animation feedback
    const steps = [
      'Pre-processing aspect ratio & color space...',
      'Extracting DWPose 2D keypoints...',
      'Parsing body segments & agnostic canvas...',
      `Diffusion sampling (${state.timesteps} steps, CFG ${state.guidanceScale})...`,
      'Blending and final un-normalization...',
    ];
    let stepIndex = 0;
    loadingStepText.textContent = steps[0];
    const stepInterval = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      loadingStepText.textContent = steps[stepIndex];
    }, 2800);

    const startTime = performance.now();

    try {
      const payload = {
        person_image: state.personBase64,
        garment_image: state.garmentBase64,
        category: state.category,
        garment_photo_type: state.garmentPhotoType,
        num_timesteps: state.timesteps,
        guidance_scale: state.guidanceScale,
        seed: state.seed,
        segmentation_free: state.segmentationFree,
      };

      const res = await fetch('/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Virtual try-on inference failed');
      }

      const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2);

      // Successfully received result
      const outputImgSrc = data.output_image;
      state.currentResult = {
        output: outputImgSrc,
        original: state.personBase64,
        garment: state.garmentBase64,
        time: `${elapsedSec}s`,
        category: state.category,
        seed: state.seed,
        resolution: data.resolution || '768x1024',
      };

      displayResult(state.currentResult);
      addToHistory(state.currentResult);
      showToast('Virtual Try-On completed successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error', 6000);
      resultStatusText.textContent = `Error: ${err.message}`;
    } finally {
      clearInterval(stepInterval);
      state.isGenerating = false;
      btnRunTryon.disabled = false;
      loadingOverlay.classList.add('hidden');
      statusDot.className = 'status-indicator ready';
    }
  });

  /* ---------------------------------------------------------
   * Display Generated Result
   * --------------------------------------------------------- */
  function displayResult(res) {
    displayEmpty.classList.add('hidden');

    // Populate compare images
    compareImgBefore.src = res.original;
    compareImgAfter.src = res.output;
    compareClipped.style.width = '50%';
    compareHandle.style.left = '50%';

    // Populate result image
    resultPureImg.src = res.output;

    // Populate side-by-side
    sideImgOriginal.src = res.original;
    sideImgResult.src = res.output;

    // Show according to current view mode
    setViewMode(state.viewMode);

    // Show actions & metrics
    btnDownloadResult.classList.remove('hidden');
    metricsBar.classList.remove('hidden');
    metricTime.textContent = res.time;
    metricCat.textContent = res.category.toUpperCase();
    metricRes.textContent = res.resolution;
    metricSeed.textContent = res.seed;

    resultStatusText.textContent = `Finished in ${res.time} with FASHN VTON 1.5.`;
  }

  // Download Output Result
  btnDownloadResult.addEventListener('click', () => {
    if (!state.currentResult) return;
    const link = document.createElement('a');
    link.href = state.currentResult.output;
    link.download = `fashn_tryon_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Image download started', 'info', 2000);
  });

  // Modal Zoom
  resultPureImg.addEventListener('click', () => {
    if (!state.currentResult) return;
    modalImg.src = state.currentResult.output;
    btnModalDownload.href = state.currentResult.output;
    zoomModal.classList.remove('hidden');
  });
  btnCloseModal.addEventListener('click', () => zoomModal.classList.add('hidden'));
  zoomModal.addEventListener('click', (e) => {
    if (e.target === zoomModal) zoomModal.classList.add('hidden');
  });

  /* ---------------------------------------------------------
   * History Gallery
   * --------------------------------------------------------- */
  function addToHistory(item) {
    state.history.unshift(item);
    renderHistory();
  }

  function renderHistory() {
    historyCounter.textContent = `${state.history.length} generation${state.history.length === 1 ? '' : 's'}`;
    if (state.history.length === 0) {
      historyEmptyText.classList.remove('hidden');
      return;
    }
    historyEmptyText.classList.add('hidden');

    historyStrip.innerHTML = '';
    state.history.forEach((histItem, idx) => {
      const card = document.createElement('div');
      card.className = 'history-item';
      card.title = `Try-on #${idx + 1} (${histItem.category}) - Click to preview`;
      card.innerHTML = `<img src="${histItem.output}" alt="History ${idx}">`;
      card.addEventListener('click', () => {
        state.currentResult = histItem;
        displayResult(histItem);
        showToast(`Loaded generation #${idx + 1}`, 'info', 1500);
      });
      historyStrip.appendChild(card);
    });
  }

  // Initial setup: Pre-select first presets
  const firstModelChip = document.getElementById('preset-model-1');
  const firstGarmentChip = document.getElementById('preset-garment-1');
  if (firstModelChip) firstModelChip.click();
  if (firstGarmentChip) firstGarmentChip.click();

  // Run server check
  checkServerStatus();
});
