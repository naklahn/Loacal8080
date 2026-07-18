const cityInput = document.getElementById('city-input');
const searchButton = document.getElementById('search-button');
const headerTime = document.getElementById('header-time');
const headerTemp = document.getElementById('header-temp');
const settingsButton = document.querySelector('.active-tab-cap');
const settingsModal = document.getElementById('settings-modal');
const settingsCityInput = document.getElementById('settings-city-input');
const settingsSearchButton = document.getElementById('settings-search-button');
const settingsAutoAdvanceToggle = document.getElementById('settings-auto-advance-toggle');
const settingsMuteToggle = document.getElementById('settings-mute-toggle');
const settingsAirNowApiKeyInput = document.getElementById('settings-airnow-api-key');
const settingsSceneButtons = document.getElementById('settings-scene-buttons');
const settingsCloseButtons = document.querySelectorAll('[data-settings-close]');
let lastSearchedCity = '';
const DEGREE_SYMBOL = String.fromCharCode(176);
let airNowApiKey = localStorage.getItem('airnow-api-key') || '';
const POLLEN_PROXY_BASE_URL = 'http://localhost:8787';
const NWPS_BASE_URL = 'https://api.water.noaa.gov/nwps/v1';
const HYDRO_MAX_CLOSEST_GAUGES = 5;
const COOPS_MDAPI_BASE_URL = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi';
const COOPS_DATAGETTER_BASE_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const MARINE_RADIUS_MILES = 25;
const SURF_MAX_CLOSEST_ZONES = 5;
const MARINE_LOOKBACK_HOURS = 24;
const MARINE_PREDICTION_DAYS_AHEAD = 2;
const DEFAULT_SCENE_BACKGROUND_PATH = 'Backgrounds/Default%20background.jpeg';
const DEFAULT_WELCOME_SCENE_BACKGROUND_PATH = 'Welcome/Default%20background.jpeg';
const DEFAULT_MARINE_BODY_IMAGE_PATH = 'marine/fa8c4f05c9171dffb37e41c9a0187b5e.jpg';
const DEFAULT_WINTER_BODY_IMAGE_PATH = 'winter/OIP.webp';
const DEFAULT_MUSIC_TRACKS_BY_ALERT_MODE = {
    normal: [
        'music/normal/Entering Graciously.mp3'
    ],
    watch: [
        'music/watch/Trauma Team UOST_ 3. Episode Selection (T.T. Version).mp3'
    ],
    warning: [
        'music/warning/Trauma Team UOST_ 10. First Response ~ Critical Moments.mp3'
    ],
    welcome: [
        'music/welcome/Bluesy Vibes (Sting) - Doug Maxwell_Media Right Productions.mp3'
    ]
};
const BACKGROUND_SEGMENT_KEYS = ['morning', 'day', 'sunset', 'night'];
const DYNAMIC_BACKGROUND_SCENES = [
    'scene-welcome',
    'scene-now',
    'scene-radar',
    'scene-hourly',
    'scene-7-day',
    'scene-almanac',
    'scene-36-hour',
    'scene-bulletin',
    'scene-air',
    'scene-sun',
    'scene-moon',
    'scene-allergy',
    'scene-marine',
    'scene-hydrological',
    'scene-ground',
    'scene-winter'
];
const NWS_RADAR_STATIONS_URL = 'https://api.weather.gov/radar/stations';
const RADAR_LOOP_GIF_BASE_URL = 'https://radar.weather.gov/ridge/standard';
const MUSIC_BACKGROUND_VOLUME_TARGET = 0.42;
const MUSIC_BACKGROUND_FADE_MS = 3800;
const MUSIC_BACKGROUND_FADE_STEP_MS = 120;
const MUSIC_BACKGROUND_START_DELAY_MS = 2600;
const MUSIC_TRACK_CROSSFADE_MS = 1400;
let cachedCoopsWaterLevelStations = null;
const cachedSurfZoneMetadataById = new Map();
let cachedRadarStations = null;
let selectedAlertMusicMode = 'normal';
let selectedBackgroundMusicTrack = '';
let backgroundMusicAudio = null;
let welcomeMusicAudio = null;
let hasAudioGesture = false;
let isWelcomeMusicSequenceActive = false;
let isAudioMuted = localStorage.getItem('audio-muted') === 'true';
let hasPlayedInitialWelcomeMusic = false;
let lastWelcomeMusicHourKey = '';
let pendingBackgroundStartTimeoutId = null;
let pendingBackgroundFadeIntervalId = null;
let runtimeAssetDiscoveryPromise = null;
let discoveredMarineBodyImagePaths = [];
let discoveredWinterBodyImagePaths = [];
let discoveredMusicTracksByAlertMode = {
    normal: [],
    watch: [],
    warning: [],
    welcome: []
};
let discoveredBackgroundAssetsBySegment = {
    morning: { folderPath: '', direct: [], byCondition: {} },
    day: { folderPath: '', direct: [], byCondition: {} },
    sunset: { folderPath: '', direct: [], byCondition: {} },
    night: { folderPath: '', direct: [], byCondition: {} }
};
let discoveredWelcomeAssetsBySegment = {
    morning: { folderPath: '', direct: [], bySeason: {} },
    day: { folderPath: '', direct: [], bySeason: {} },
    sunset: { folderPath: '', direct: [], bySeason: {} },
    night: { folderPath: '', direct: [], bySeason: {} }
};
const INTRO_SENTENCES = [
    'Weather shifts quickly, so here is the latest local snapshot.',
    'Your local forecast is ready with conditions that matter right now.',
    'Staying ahead of the weather starts with a strong local picture.',
    'From sky to street, your local weather update is about to begin.',
    'Planning your day starts here with the latest local weather details.',
    'Here comes your latest local weather story, built for your area.'
];
let introSequenceTimeoutIds = [];

function persistAirNowApiKey(nextKey) {
    airNowApiKey = String(nextKey || '').trim();
    localStorage.setItem('airnow-api-key', airNowApiKey);
}

if (searchButton && cityInput) {
    searchButton.addEventListener('click', () => submitWeatherSearch(cityInput));
}

function submitWeatherSearch(sourceInput) {
    if (!sourceInput) {
        return;
    }

    const city = sourceInput.value.trim();
    getWeather(city);
}

function openSettingsModal() {
    if (!settingsModal) {
        return;
    }

    settingsModal.hidden = false;
    if (settingsCityInput) {
        settingsCityInput.value = lastSearchedCity;
        settingsCityInput.focus();
        settingsCityInput.select();
    }

    if (settingsAirNowApiKeyInput) {
        settingsAirNowApiKeyInput.value = airNowApiKey;
    }

    if (settingsMuteToggle) {
        settingsMuteToggle.checked = isAudioMuted;
    }
}

function closeSettingsModal() {
    if (!settingsModal) {
        return;
    }

    settingsModal.hidden = true;
}

function setAudioMuted(nextMuted, options = {}) {
    const persist = options.persist !== false;
    isAudioMuted = Boolean(nextMuted);

    if (persist) {
        localStorage.setItem('audio-muted', String(isAudioMuted));
    }

    if (settingsMuteToggle) {
        settingsMuteToggle.checked = isAudioMuted;
    }

    if (backgroundMusicAudio) {
        backgroundMusicAudio.muted = isAudioMuted;
        if (isAudioMuted) {
            backgroundMusicAudio.pause();
        }
    }

    if (welcomeMusicAudio) {
        welcomeMusicAudio.muted = isAudioMuted;
        if (isAudioMuted) {
            welcomeMusicAudio.pause();
        }
    }

    if (isAudioMuted) {
        isWelcomeMusicSequenceActive = false;
        clearBackgroundMusicStartTimeout();
        return;
    }

    if (!hasAudioGesture) {
        return;
    }

    if (currentScene === 'scene-intro' && shouldPlayWelcomeMusicNow()) {
        startWelcomeMusicSequence();
        return;
    }

    if (selectedBackgroundMusicTrack) {
        startBackgroundMusicFromSelectedTrack();
    }
}

if (settingsButton) {
    settingsButton.addEventListener('click', openSettingsModal);
}

if (settingsSearchButton) {
    settingsSearchButton.addEventListener('click', () => submitWeatherSearch(settingsCityInput));
}

if (settingsAirNowApiKeyInput) {
    settingsAirNowApiKeyInput.value = airNowApiKey;
    settingsAirNowApiKeyInput.addEventListener('input', event => {
        persistAirNowApiKey(event.target.value);
    });
}

settingsCloseButtons.forEach(button => {
    button.addEventListener('click', closeSettingsModal);
});

[cityInput, settingsCityInput].forEach(input => {
    if (!input) {
        return;
    }

    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            submitWeatherSearch(input);
        }
    });
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && settingsModal && !settingsModal.hidden) {
        closeSettingsModal();
    }
});

function updateHeaderTime() {
    if (!headerTime) {
        return;
    }

    const now = new Date();
    headerTime.textContent = now.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: false
    });
}

updateHeaderTime();
setInterval(updateHeaderTime, 1000);

// Scene Management System
let currentScene = 'scene-welcome';
const navButtons = document.querySelectorAll('.nav-btn');
const navTabs = document.querySelector('.nav-tabs');
const activeTabCap = document.querySelector('.active-tab-cap');
const SCENE_ADVANCE_MS = 10000;
const SCENE_36_ADVANCE_MS = SCENE_ADVANCE_MS * 2;
const SCENE_INTRO_ADVANCE_MS = 15000;
const AUTO_ADVANCE_TICK_MS = 250;
const SCENE_36_FADE_MS = 360;
let autoAdvanceEnabled = true;
let autoAdvanceTimerId = null;
let currentQueueIndex = 0;
let sceneEnteredAt = Date.now();
let detailedForecastSegments36 = [];
let active36SegmentIndex = -1;
let is36FadeTransitioning = false;
let latestAirAqi = null;
let latestSunriseIso = null;
let latestSunsetIso = null;

function getSceneDurationMs(sceneId) {
    if (sceneId === 'scene-intro') {
        return SCENE_INTRO_ADVANCE_MS;
    }

    return sceneId === 'scene-36-hour' ? SCENE_36_ADVANCE_MS : SCENE_ADVANCE_MS;
}

const flexScenePool = [
    'scene-almanac',
    'scene-36-hour',
    'scene-bulletin',
    'scene-air',
    'scene-sun',
    'scene-moon',
    'scene-allergy',
    'scene-marine',
    'scene-hydrological',
    'scene-ground',
    'scene-winter'
];

let playbackQueue = [];
let latestSceneAvailability = {
    'scene-welcome': true,
    'scene-intro': false,
    'scene-bulletin': false,
    'scene-now': false,
    'scene-radar': false,
    'scene-hourly': false,
    'scene-7-day': false,
    'scene-almanac': false,
    'scene-36-hour': false,
    'scene-air': false,
    'scene-sun': false,
    'scene-moon': false,
    'scene-allergy': false,
    'scene-marine': false,
    'scene-hydrological': false,
    'scene-ground': false,
    'scene-winter': false
};
const settingsSceneOrder = [
    'scene-welcome',
    'scene-intro',
    'scene-now',
    'scene-radar',
    'scene-hourly',
    'scene-7-day',
    ...flexScenePool
];

function formatSceneLabel(sceneId) {
    if (sceneId === 'scene-welcome') {
        return 'WELCOME';
    }

    if (sceneId === 'scene-intro') {
        return 'INTRO';
    }

    if (sceneId === 'scene-36-hour') {
        return '36-HOUR';
    }

    if (sceneId === 'scene-sun') {
        return 'SUN';
    }

    if (sceneId === 'scene-hydrological') {
        return 'HYDRO';
    }

    return sceneId.replace('scene-', '').replace(/-/g, ' ').toUpperCase();
}

function pickRandomScenes(sceneIds, maxCount = 2) {
    const availableScenes = Array.isArray(sceneIds) ? [...sceneIds] : [];
    const selectedScenes = [];

    for (let i = 0; i < maxCount && availableScenes.length > 0; i += 1) {
        const randomIndex = Math.floor(Math.random() * availableScenes.length);
        selectedScenes.push(availableScenes.splice(randomIndex, 1)[0]);
    }

    return selectedScenes;
}

function hasMeaningfulText(value) {
    return Boolean(String(value || '').trim());
}

function hasAnyDisplayableForecastEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return false;
    }

    return entries.some(entry => {
        if (!entry || typeof entry !== 'object') {
            return false;
        }

        const hasTemp = Number.isFinite(Number(entry.temperature));
        const hasLabel = hasMeaningfulText(entry.label) && String(entry.label).trim() !== '---';
        const hasCondition = hasMeaningfulText(entry.condition);
        return hasTemp || hasLabel || hasCondition;
    });
}

function hasAnyNarrativeSegments(segments) {
    if (!Array.isArray(segments) || segments.length === 0) {
        return false;
    }

    return segments.some(segment => hasMeaningfulText(segment?.text));
}

function hasAnyAllergyIndexValues(periods) {
    if (!Array.isArray(periods) || periods.length === 0) {
        return false;
    }

    return periods.some(period => Number.isFinite(Number(period?.valueText)));
}

function hasMarineStationData(zones) {
    if (!Array.isArray(zones) || zones.length === 0) {
        return false;
    }

    return zones.some(zone => hasMeaningfulText(zone?.zoneId) || hasMeaningfulText(zone?.name));
}

function hasWinterConditionExpected(winterPrimaryLabel) {
    const label = String(winterPrimaryLabel || '').trim().toUpperCase();
    if (!label) {
        return false;
    }

    return label === 'PREDICTED SNOWFALL'
        || label === 'FREEZING RAIN EXPECTED'
        || label === 'SLEET EXPECTED';
}

function hasWinterAmountValue(valueText) {
    const text = String(valueText || '').trim();
    if (!text || text === '--') {
        return false;
    }

    return /\d/.test(text);
}

function createSceneAvailabilityFromWeather(weatherValues) {
    const values = weatherValues || {};
    const alertsText = String(values.alerts || '').trim();
    const hasActiveAlerts = alertsText && alertsText.toLowerCase() !== 'none';
    const hasWinterExpected = hasWinterConditionExpected(values.winterPrimaryLabel);
    const hasSnowDepthValue = hasWinterAmountValue(values.winterSnowDepthText);
    const hasIceAccumValue = hasWinterAmountValue(values.winterIceAccumulationText);

    return {
        ...latestSceneAvailability,
        'scene-welcome': !lastSearchedCity,
        'scene-intro': true,
        'scene-bulletin': hasActiveAlerts,
        'scene-now': true,
        'scene-radar': true,
        'scene-hourly': true,
        'scene-7-day': true,
        'scene-almanac': false,
        'scene-36-hour': hasAnyNarrativeSegments(values.detailedForecastSegments),
        'scene-air': Number.isFinite(Number(values.airAqi)) && Number(values.airAqi) > 0,
        'scene-sun': hasMeaningfulText(values.sunriseIso) || hasMeaningfulText(values.sunsetIso) || Number.isFinite(Number(values.uvCurrent)),
        'scene-moon': Number.isFinite(Number(values.moonCurrentSizePercent)),
        'scene-allergy': hasAnyAllergyIndexValues(values.allergyPeriods),
        'scene-marine': hasMarineStationData(values.marineSurfZones),
        'scene-hydrological': Array.isArray(values.hydrologicalGauges) && values.hydrologicalGauges.length > 0,
        'scene-ground': false,
        'scene-winter': hasWinterExpected || hasSnowDepthValue || hasIceAccumValue
    };
}

function buildPlaybackQueue() {
    const nextQueue = [];

    if (latestSceneAvailability['scene-welcome']) {
        nextQueue.push('scene-welcome');
    }

    if (latestSceneAvailability['scene-intro']) {
        nextQueue.push('scene-intro');
    }

    if (latestSceneAvailability['scene-bulletin']) {
        nextQueue.push('scene-bulletin');
    }

    const coreSceneOrder = ['scene-now', 'scene-radar', 'scene-hourly', 'scene-7-day'];
    coreSceneOrder.forEach(sceneId => {
        if (latestSceneAvailability[sceneId]) {
            nextQueue.push(sceneId);
        }
    });

    const availableFlexScenes = flexScenePool.filter(sceneId => {
        if (sceneId === 'scene-bulletin') {
            return false;
        }

        return Boolean(latestSceneAvailability[sceneId]);
    });

    const selectedFlexScenes = pickRandomScenes(availableFlexScenes, 2);
    nextQueue.push(...selectedFlexScenes);

    playbackQueue = nextQueue.filter(Boolean);
}

function rebuildPlaybackQueueForCurrentData() {
    const activeSceneId = currentScene;
    buildPlaybackQueue();

    if (playbackQueue.length === 0) {
        playbackQueue = ['scene-welcome'];
    }

    const retainedSceneIndex = playbackQueue.indexOf(activeSceneId);
    if (retainedSceneIndex >= 0) {
        currentQueueIndex = retainedSceneIndex;
        renderQueueWindow();
        updateActiveTabCapPosition();
        return;
    }

    switchToQueueIndex(0);
}

function setActiveScene(sceneId) {
    const targetScene = document.getElementById(sceneId);
    if (!targetScene) {
        return false;
    }

    const activeScene = document.querySelector('.scene.active');
    if (activeScene) {
        activeScene.classList.remove('active');
    }

    targetScene.classList.add('active');
    currentScene = sceneId;
    sceneEnteredAt = Date.now();

    if (sceneId === 'scene-36-hour') {
        active36SegmentIndex = -1;
        is36FadeTransitioning = false;
        update36HourPaneByElapsedTime();
    }

    if (sceneId === 'scene-air') {
        // Wait until the AIR panel is visible so the pointer transition is rendered.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                animateAirScalePointer(latestAirAqi);
            });
        });
    }

    if (sceneId === 'scene-welcome') {
        clearIntroSceneSequence();
    }

    if (sceneId === 'scene-intro') {
        runIntroSceneSequence();
        startWelcomeMusicSequence();
    }

    return true;
}

function switchToScene(sceneId) {
    const queueIndex = playbackQueue.indexOf(sceneId);
    if (queueIndex >= 0) {
        switchToQueueIndex(queueIndex);
        return;
    }

    if (!setActiveScene(sceneId)) {
        return;
    }

    navButtons.forEach(button => button.classList.remove('active'));
    updateActiveTabCapPosition();
}

function renderSettingsSceneButtons() {
    if (!settingsSceneButtons) {
        return;
    }

    settingsSceneButtons.innerHTML = '';

    settingsSceneOrder.forEach(sceneId => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'settings-scene-button';
        button.dataset.sceneId = sceneId;
        button.textContent = formatSceneLabel(sceneId);
        settingsSceneButtons.appendChild(button);
    });
}

function renderQueueWindow() {
    if (playbackQueue.length === 0) {
        return;
    }

    let lastVisibleButton = null;

    navButtons.forEach((button, slotIndex) => {
        const queueIndex = currentQueueIndex + slotIndex;
        if (queueIndex >= playbackQueue.length) {
            button.style.display = 'none';
            button.classList.remove('active');
            button.style.marginRight = '';
            return;
        }

        const sceneId = playbackQueue[queueIndex];
        if (!sceneId) {
            return;
        }

        button.style.display = '';
        button.dataset.scene = sceneId;
        button.textContent = formatSceneLabel(sceneId);
        button.classList.toggle('active', slotIndex === 0);
        button.style.marginRight = '';
        lastVisibleButton = button;
    });

    if (lastVisibleButton) {
        lastVisibleButton.style.marginRight = '0';
    }
}

function updateActiveTabCapPosition() {
    if (!navTabs || !activeTabCap) {
        return;
    }

    const activeButton = navTabs.querySelector('.nav-btn.active');
    if (!activeButton) {
        activeTabCap.style.opacity = '0';
        return;
    }

    const capWidth = 20;
    const capLeft = activeButton.offsetLeft - capWidth + 2;

    activeTabCap.style.width = `${capWidth}px`;
    activeTabCap.style.left = `${capLeft}px`;
    activeTabCap.style.height = `${activeButton.offsetHeight}px`;
    activeTabCap.style.opacity = '1';
}

window.addEventListener('resize', updateActiveTabCapPosition);

navButtons.forEach((button, slotIndex) => {
    button.addEventListener('click', () => {
        const nextQueueIndex = currentQueueIndex + slotIndex;
        if (nextQueueIndex >= playbackQueue.length) {
            return;
        }

        switchToQueueIndex(nextQueueIndex);
    });
});

function switchToQueueIndex(queueIndex) {
    if (playbackQueue.length === 0 || queueIndex < 0 || queueIndex >= playbackQueue.length) {
        return;
    }

    const sceneId = playbackQueue[queueIndex];
    if (!setActiveScene(sceneId)) {
        return;
    }

    currentQueueIndex = queueIndex;

    renderQueueWindow();
    updateActiveTabCapPosition();
}

if (settingsSceneButtons) {
    settingsSceneButtons.addEventListener('click', event => {
        const target = event.target.closest('.settings-scene-button');
        if (!target) {
            return;
        }

        const sceneId = target.dataset.sceneId;
        if (!sceneId) {
            return;
        }

        switchToScene(sceneId);
        closeSettingsModal();
    });
}

function advanceQueue() {
    if (playbackQueue.length === 0) {
        return;
    }

    const currentSceneDurationMs = getSceneDurationMs(currentScene);
    if (Date.now() - sceneEnteredAt < currentSceneDurationMs) {
        return;
    }

    const nextQueueIndex = currentQueueIndex + 1;
    const wrapped = nextQueueIndex >= playbackQueue.length;

    if (wrapped) {
        buildPlaybackQueue();
        switchToQueueIndex(0);

        if (lastSearchedCity) {
            getWeather(lastSearchedCity);
        }

        return;
    }

    switchToQueueIndex(nextQueueIndex);
}

function stopAutoAdvance() {
    if (autoAdvanceTimerId !== null) {
        clearInterval(autoAdvanceTimerId);
        autoAdvanceTimerId = null;
    }
}

function startAutoAdvance() {
    stopAutoAdvance();

    if (!autoAdvanceEnabled) {
        return;
    }

    autoAdvanceTimerId = setInterval(advanceQueue, AUTO_ADVANCE_TICK_MS);
}

function setAutoAdvanceEnabled(enabled) {
    autoAdvanceEnabled = Boolean(enabled);
    if (settingsAutoAdvanceToggle) {
        settingsAutoAdvanceToggle.checked = autoAdvanceEnabled;
    }
    startAutoAdvance();
}

buildPlaybackQueue();
renderSettingsSceneButtons();
switchToQueueIndex(0);
setAutoAdvanceEnabled(true);

if (settingsAutoAdvanceToggle) {
    settingsAutoAdvanceToggle.checked = autoAdvanceEnabled;
    settingsAutoAdvanceToggle.addEventListener('change', event => {
        setAutoAdvanceEnabled(event.target.checked);
    });
}

if (settingsMuteToggle) {
    settingsMuteToggle.checked = isAudioMuted;
    settingsMuteToggle.addEventListener('change', event => {
        setAudioMuted(event.target.checked);
    });
}

updateActiveTabCapPosition();
setInterval(update36HourPaneByElapsedTime, 250);
setInterval(() => {
    if (currentScene === 'scene-sun') {
        positionSunProgressIcon(latestSunriseIso, latestSunsetIso);
    }
}, 60000);
setInterval(() => {
    if (currentScene === 'scene-intro') {
        startWelcomeMusicSequence();
    }
}, 1000);
registerAudioGestureUnlock();
setAudioMuted(isAudioMuted, { persist: false });
setWelcomeSceneMode(false);
ensureRuntimeAssetsLoaded().then(() => {
    applyWelcomeSceneBackground();
});

function normalizeAssetPath(value) {
    return String(value || '')
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .trim();
}

function isImageAssetPath(path) {
    return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(String(path || ''));
}

function isAudioAssetPath(path) {
    return /\.(aac|flac|m4a|mp3|ogg|wav|webm)$/i.test(String(path || ''));
}

async function listDirectoryEntries(dirPath) {
    const safePath = normalizeAssetPath(dirPath).replace(/\/$/, '');
    if (!safePath) {
        return [];
    }

    try {
        const response = await fetch(`${safePath}/`, {
            headers: { 'Accept': 'text/html' }
        });

        if (!response.ok) {
            return [];
        }

        const html = await response.text();
        const parser = new DOMParser();
        const documentNode = parser.parseFromString(html, 'text/html');
        const anchors = Array.from(documentNode.querySelectorAll('a[href]'));
        const uniqueByPath = new Map();

        anchors.forEach(anchor => {
            const hrefRaw = String(anchor.getAttribute('href') || '').trim();
            if (!hrefRaw || hrefRaw === '.' || hrefRaw === '..' || hrefRaw === './' || hrefRaw === '../') {
                return;
            }

            if (/^(?:[a-z]+:)?\/\//i.test(hrefRaw) || hrefRaw.startsWith('?') || hrefRaw.startsWith('#') || hrefRaw.startsWith('/')) {
                return;
            }

            const decodedHref = decodeURIComponent(hrefRaw.split('#')[0].split('?')[0]);
            const isDirectory = decodedHref.endsWith('/');
            const cleanName = decodedHref.replace(/\/$/, '');
            if (!cleanName || cleanName === '.' || cleanName === '..') {
                return;
            }

            const fullPath = normalizeAssetPath(`${safePath}/${cleanName}`);
            uniqueByPath.set(fullPath, {
                name: cleanName,
                path: fullPath,
                isDirectory
            });
        });

        return Array.from(uniqueByPath.values());
    } catch (error) {
        return [];
    }
}

async function listDirectoryFiles(dirPath, recursive = false) {
    const entries = await listDirectoryEntries(dirPath);
    if (entries.length === 0) {
        return [];
    }

    const files = [];
    for (const entry of entries) {
        if (entry.isDirectory) {
            if (recursive) {
                const nestedFiles = await listDirectoryFiles(entry.path, true);
                files.push(...nestedFiles);
            }
            continue;
        }

        files.push(entry.path);
    }

    return files;
}

function getConditionBucket(conditionText) {
    const normalized = String(conditionText || '').toLowerCase();
    if (!normalized) {
        return 'sunny';
    }

    if (/(snow|blizzard|flurr)/.test(normalized)) return 'snowy';
    if (/(thunder|storm|squall)/.test(normalized)) return 'stormy';
    if (/(freezing rain|drizzle|rain|shower)/.test(normalized)) return 'rainy';
    if (/(fog|haze|smoke|mist)/.test(normalized)) return 'foggy';
    if (/(cloud|overcast)/.test(normalized)) return 'cloudy';
    return 'sunny';
}

function getSegmentFromFolderName(folderName) {
    const normalized = String(folderName || '').toLowerCase();
    if (normalized.includes('morning')) return 'morning';
    if (normalized.includes('sunset') || normalized.includes('evening')) return 'sunset';
    if (normalized.includes('night')) return 'night';
    if (normalized.includes('day')) return 'day';
    return null;
}

function getSeasonFromFolderName(folderName) {
    const normalized = String(folderName || '').toLowerCase();
    if (normalized.includes('spring')) return 'spring';
    if (normalized.includes('summer')) return 'summer';
    if (normalized.includes('fall') || normalized.includes('autumn')) return 'fall';
    if (normalized.includes('winter')) return 'winter';
    return null;
}

function getCurrentSeasonKey(referenceDate = new Date()) {
    const month = referenceDate.getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
}

function getCurrentTimeSegment(sunriseIso, sunsetIso) {
    const now = Date.now();
    const sunriseMs = Date.parse(String(sunriseIso || ''));
    const sunsetMs = Date.parse(String(sunsetIso || ''));

    if (!Number.isFinite(sunriseMs) || !Number.isFinite(sunsetMs) || sunsetMs <= sunriseMs) {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 10) return 'morning';
        if (hour >= 10 && hour < 16) return 'day';
        if (hour >= 16 && hour < 20) return 'sunset';
        return 'night';
    }

    const morningEndMs = sunriseMs + (2 * 60 * 60 * 1000);
    const sunsetStartMs = sunsetMs - (2 * 60 * 60 * 1000);

    if (now < sunriseMs) return 'night';
    if (now < morningEndMs) return 'morning';
    if (now < sunsetStartMs) return 'day';
    if (now < sunsetMs) return 'sunset';
    return 'night';
}

async function discoverBackgroundAssets() {
    const segmentState = {
        morning: { folderPath: '', direct: [], byCondition: {} },
        day: { folderPath: '', direct: [], byCondition: {} },
        sunset: { folderPath: '', direct: [], byCondition: {} },
        night: { folderPath: '', direct: [], byCondition: {} }
    };

    const timeFolderEntries = (await listDirectoryEntries('Backgrounds'))
        .filter(entry => entry.isDirectory);

    for (const entry of timeFolderEntries) {
        const segmentKey = getSegmentFromFolderName(entry.name);
        if (!segmentKey || !BACKGROUND_SEGMENT_KEYS.includes(segmentKey)) {
            continue;
        }

        segmentState[segmentKey].folderPath = entry.path;
        const children = await listDirectoryEntries(entry.path);
        segmentState[segmentKey].direct = children
            .filter(child => !child.isDirectory && isImageAssetPath(child.path))
            .map(child => child.path);

        for (const child of children.filter(item => item.isDirectory)) {
            const bucket = getConditionBucket(child.name);
            const files = (await listDirectoryFiles(child.path, false)).filter(isImageAssetPath);
            if (!segmentState[segmentKey].byCondition[bucket]) {
                segmentState[segmentKey].byCondition[bucket] = [];
            }

            segmentState[segmentKey].byCondition[bucket].push(...files);
        }
    }

    return segmentState;
}

async function discoverWelcomeAssets() {
    const segmentState = {
        morning: { folderPath: '', direct: [], bySeason: {} },
        day: { folderPath: '', direct: [], bySeason: {} },
        sunset: { folderPath: '', direct: [], bySeason: {} },
        night: { folderPath: '', direct: [], bySeason: {} }
    };

    const timeFolderEntries = (await listDirectoryEntries('Welcome'))
        .filter(entry => entry.isDirectory);

    for (const entry of timeFolderEntries) {
        const segmentKey = getSegmentFromFolderName(entry.name);
        if (!segmentKey || !BACKGROUND_SEGMENT_KEYS.includes(segmentKey)) {
            continue;
        }

        segmentState[segmentKey].folderPath = entry.path;
        const children = await listDirectoryEntries(entry.path);
        segmentState[segmentKey].direct = children
            .filter(child => !child.isDirectory && isImageAssetPath(child.path))
            .map(child => child.path);

        for (const child of children.filter(item => item.isDirectory)) {
            const seasonKey = getSeasonFromFolderName(child.name);
            if (!seasonKey) {
                continue;
            }

            const files = (await listDirectoryFiles(child.path, false)).filter(isImageAssetPath);
            if (!segmentState[segmentKey].bySeason[seasonKey]) {
                segmentState[segmentKey].bySeason[seasonKey] = [];
            }

            segmentState[segmentKey].bySeason[seasonKey].push(...files);
        }
    }

    return segmentState;
}

function getTracksForMode(mode) {
    const normalizedMode = String(mode || '').trim().toLowerCase();
    const discovered = discoveredMusicTracksByAlertMode[normalizedMode] || [];
    if (discovered.length > 0) {
        return discovered;
    }

    return DEFAULT_MUSIC_TRACKS_BY_ALERT_MODE[normalizedMode] || DEFAULT_MUSIC_TRACKS_BY_ALERT_MODE.normal;
}

function pickSceneBackgroundByWeather(weatherValues) {
    const values = weatherValues || {};
    const segmentKey = getCurrentTimeSegment(values.sunriseIso, values.sunsetIso);
    const conditionBucket = getConditionBucket(values.conditionCurrent);
    const segmentAssets = discoveredBackgroundAssetsBySegment[segmentKey];
    const fallbackList = [
        ...(segmentAssets?.byCondition?.[conditionBucket] || []),
        ...(segmentAssets?.byCondition?.[(conditionBucket === 'stormy' ? 'rainy' : 'stormy')] || []),
        ...(segmentAssets?.direct || [])
    ];

    return pickRandomArrayItem(fallbackList) || DEFAULT_SCENE_BACKGROUND_PATH;
}

function applyDynamicSceneBackgrounds(weatherValues) {
    const selectedBackground = pickSceneBackgroundByWeather(weatherValues);

    DYNAMIC_BACKGROUND_SCENES.forEach(sceneId => {
        if (sceneId === 'scene-welcome' || sceneId === 'scene-intro') {
            return;
        }

        const sceneEl = document.getElementById(sceneId);
        if (!sceneEl) {
            return;
        }

        sceneEl.style.backgroundImage = `url("${selectedBackground}")`;
        sceneEl.style.backgroundSize = 'cover';
        sceneEl.style.backgroundPosition = 'center';
        sceneEl.style.backgroundRepeat = 'no-repeat';
    });
}

function pickWelcomeSceneBackground(sunriseIso = null, sunsetIso = null) {
    const segmentKey = getCurrentTimeSegment(sunriseIso, sunsetIso);
    const seasonKey = getCurrentSeasonKey();
    const segmentAssets = discoveredWelcomeAssetsBySegment[segmentKey];
    const fallbackList = [
        ...(segmentAssets?.bySeason?.[seasonKey] || []),
        ...(segmentAssets?.direct || [])
    ];

    return pickRandomArrayItem(fallbackList) || DEFAULT_WELCOME_SCENE_BACKGROUND_PATH;
}

function applyWelcomeSceneBackground(weatherValues = null) {
    const sunriseIso = weatherValues?.sunriseIso || latestSunriseIso;
    const sunsetIso = weatherValues?.sunsetIso || latestSunsetIso;
    const selectedBackground = pickWelcomeSceneBackground(sunriseIso, sunsetIso);
    ['scene-welcome', 'scene-intro'].forEach(sceneId => {
        const sceneEl = document.getElementById(sceneId);
        if (!sceneEl) {
            return;
        }

        sceneEl.style.backgroundImage = `url("${selectedBackground}")`;
        sceneEl.style.backgroundSize = 'cover';
        sceneEl.style.backgroundPosition = 'center';
        sceneEl.style.backgroundRepeat = 'no-repeat';
    });
}

function setWelcomeSceneMode(useIntro) {
    const welcomeHeadline = document.getElementById('welcome-scene-title');
    if (welcomeHeadline) {
        welcomeHeadline.textContent = 'WELCOME';
    }

    if (useIntro) {
        return;
    }

    clearIntroSceneSequence();
}

async function discoverRuntimeAssets() {
    const [marineFiles, winterFiles, normalTracks, watchTracks, warningTracks, welcomeTracks, backgroundAssets, welcomeAssets] = await Promise.all([
        listDirectoryFiles('marine', false),
        listDirectoryFiles('winter', true),
        listDirectoryFiles('music/normal', false),
        listDirectoryFiles('music/watch', false),
        listDirectoryFiles('music/warning', false),
        listDirectoryFiles('music/welcome', false),
        discoverBackgroundAssets(),
        discoverWelcomeAssets()
    ]);

    discoveredMarineBodyImagePaths = marineFiles.filter(isImageAssetPath);
    discoveredWinterBodyImagePaths = winterFiles.filter(isImageAssetPath);
    discoveredMusicTracksByAlertMode = {
        normal: normalTracks.filter(isAudioAssetPath),
        watch: watchTracks.filter(isAudioAssetPath),
        warning: warningTracks.filter(isAudioAssetPath),
        welcome: welcomeTracks.filter(isAudioAssetPath)
    };
    discoveredBackgroundAssetsBySegment = backgroundAssets;
    discoveredWelcomeAssetsBySegment = welcomeAssets;
}

function ensureRuntimeAssetsLoaded() {
    if (runtimeAssetDiscoveryPromise) {
        return runtimeAssetDiscoveryPromise;
    }

    runtimeAssetDiscoveryPromise = discoverRuntimeAssets()
        .catch(error => {
            console.warn('[ASSETS] Runtime discovery unavailable, using fallback assets:', error);
        })
        .finally(() => {
            runtimeAssetDiscoveryPromise = null;
        });

    return runtimeAssetDiscoveryPromise;
}

function getConditionIconPath(conditionText) {
    if (!conditionText) {
        return 'Condition Icons/sun.png';
    }

    const normalizedCondition = conditionText.toLowerCase();

    if (normalizedCondition.includes('t-storm') || normalizedCondition.includes('rain') || normalizedCondition.includes('shower') || normalizedCondition.includes('drizzle')) {
        return 'Condition Icons/rain.png';
    }

    if (normalizedCondition.includes('partly') || normalizedCondition.includes('mostly sunny') || normalizedCondition.includes('mostly clear')) {
        return 'Condition Icons/partlycloudy.png';
    }

    if (normalizedCondition.includes('cloud') || normalizedCondition.includes('overcast') || normalizedCondition.includes('fog') || normalizedCondition.includes('haze')) {
        return 'Condition Icons/cloudy.png';
    }

    return 'Condition Icons/sun.png';
}

function getWeatherPaneImagePath(isDaytime) {
    const fileName = isDaytime ? 'day_clear_pane.png' : 'night_clear_pane.png';
    return `weather pane/${fileName}`;
}

function build36HourNarrative(segment) {
    const detailedBase = segment && segment.text ? String(segment.text).trim() : '';
    return detailedBase || 'Detailed forecast is unavailable right now.';
}

function get36HourSegmentTitle(segment, segmentIndex) {
    if (segment && segment.name) {
        const normalizedName = String(segment.name).toLowerCase();
        if (normalizedName.includes('today')) return 'TODAY';
        if (normalizedName.includes('tonight')) return 'TONIGHT';
        if (normalizedName.includes('tomorrow night')) return 'TOMORROW NIGHT';
        if (normalizedName.includes('tomorrow')) return 'TOMORROW';
    }

    if (segmentIndex === 0) {
        return segment && segment.isDaytime ? 'TODAY' : 'TONIGHT';
    }

    return segment && segment.isDaytime ? 'TOMORROW' : 'TOMORROW NIGHT';
}

function build36HourSegments(periods) {
    const rawSegments = Array.isArray(periods)
        ? periods.slice(0, 3).map(period => ({
            text: period && period.detailedForecast ? String(period.detailedForecast) : '',
            isDaytime: period ? Boolean(period.isDaytime) : true,
            name: period && period.name ? String(period.name) : ''
        }))
        : [];

    while (rawSegments.length < 3) {
        const fallback = rawSegments[rawSegments.length - 1] || { text: '', isDaytime: true, name: '' };
        rawSegments.push({ ...fallback });
    }

    return rawSegments;
}

function get36HourSegmentIndex() {
    const segmentMs = SCENE_36_ADVANCE_MS / 3;
    const elapsed = Math.min(Date.now() - sceneEnteredAt, SCENE_36_ADVANCE_MS - 1);
    if (elapsed < segmentMs) return 0;
    if (elapsed < segmentMs * 2) return 1;
    return 2;
}

function update36HourPaneByElapsedTime() {
    if (currentScene !== 'scene-36-hour') {
        return;
    }

    const segmentIndex = get36HourSegmentIndex();
    const segment = detailedForecastSegments36[segmentIndex] || { text: '', isDaytime: true };

    if (segmentIndex === active36SegmentIndex || is36FadeTransitioning) {
        return;
    }

    const scene36Text = document.getElementById('scene-36-text');
    const scene36Heading = document.getElementById('scene-36-heading');
    const scene36ImagePane = document.getElementById('scene-36-image-pane');

    const applySegmentContent = () => {
        if (scene36Text) {
            scene36Text.textContent = build36HourNarrative(segment);
        }

        if (scene36Heading) {
            scene36Heading.textContent = get36HourSegmentTitle(segment, segmentIndex);
        }

        if (scene36ImagePane) {
            scene36ImagePane.style.backgroundImage = `url("${getWeatherPaneImagePath(segment.isDaytime)}")`;
        }
    };

    if (!scene36Text || !scene36ImagePane || active36SegmentIndex === -1) {
        applySegmentContent();
        active36SegmentIndex = segmentIndex;
        return;
    }

    is36FadeTransitioning = true;
    scene36Text.classList.add('scene-36-fade-out');
    scene36ImagePane.classList.add('scene-36-fade-out');

    setTimeout(() => {
        applySegmentContent();
        scene36Text.classList.remove('scene-36-fade-out');
        scene36ImagePane.classList.remove('scene-36-fade-out');
        active36SegmentIndex = segmentIndex;
        is36FadeTransitioning = false;
    }, SCENE_36_FADE_MS);
}


function toTitleCaseWords(text) {
    return text
        .split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function summarizeCondition(conditionText, maxWords = 3) {
    if (!conditionText) {
        return '';
    }

    const normalized = String(conditionText).toLowerCase().trim();
    if (!normalized) {
        return '';
    }

    if (normalized.includes('thunder')) {
        if (normalized.includes('scattered')) return 'Scattered T-storms';
        if (normalized.includes('isolated')) return 'Isolated T-storms';
        if (normalized.includes('slight chance') || normalized.includes('chance')) return 'Chance T-storms';
        return 'T-storms';
    }

    if (normalized.includes('shower') || normalized.includes('rain') || normalized.includes('drizzle')) {
        if (normalized.includes('isolated')) return 'Isolated Showers';
        if (normalized.includes('scattered')) return 'Scattered Showers';
        if (normalized.includes('slight chance') || normalized.includes('chance')) return 'Chance Showers';
        if (normalized.includes('drizzle')) return 'Light Drizzle';
        return 'Showers';
    }

    if (normalized.includes('mostly cloudy')) return 'Mostly Cloudy';
    if (normalized.includes('partly cloudy')) return 'Partly Cloudy';
    if (normalized.includes('cloudy') || normalized.includes('overcast')) return 'Cloudy';
    if (normalized.includes('mostly sunny')) return 'Mostly Sunny';
    if (normalized.includes('partly sunny')) return 'Partly Sunny';
    if (normalized.includes('sunny') || normalized.includes('clear')) return 'Sunny';
    if (normalized.includes('haze') || normalized.includes('smoke')) return 'Hazy';
    if (normalized.includes('fog')) return 'Foggy';

    const stopWords = new Set([
        'then', 'and', 'with', 'of', 'for', 'during', 'later', 'becoming', 'followed', 'by', 'after', 'before'
    ]);

    const words = normalized
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .filter(word => !stopWords.has(word));

    const compactWords = (words.length > 0 ? words : normalized.split(/\s+/).filter(Boolean)).slice(0, maxWords);
    return toTitleCaseWords(compactWords.join(' '));
}

function formatForecastStartTime(isoTime) {
    if (!isoTime) {
        return '--';
    }

    const parsed = new Date(isoTime);
    if (Number.isNaN(parsed.getTime())) {
        return '--';
    }

    return parsed.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
    }).toUpperCase();
}

function getWinterEventType(text) {
    const normalized = String(text || '').toLowerCase();
    if (!normalized) {
        return null;
    }

    if (normalized.includes('freezing rain')) {
        return 'freezing-rain';
    }

    if (normalized.includes('sleet') || normalized.includes('ice pellets')) {
        return 'sleet';
    }

    if (normalized.includes('snow') || normalized.includes('flurr')) {
        return 'snow';
    }

    return null;
}

function extractRangeInches(text) {
    const normalized = String(text || '').toLowerCase();
    if (!normalized) {
        return null;
    }

    if (/less than one\s+inch/.test(normalized)) {
        return '<1';
    }

    const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)(?:\s*(?:to|-)\s*(\d+(?:\.\d+)?))?\s*inches?/);
    if (!rangeMatch) {
        return null;
    }

    const firstValue = Number(rangeMatch[1]);
    const secondValue = Number(rangeMatch[2]);
    if (!Number.isFinite(firstValue)) {
        return null;
    }

    if (Number.isFinite(secondValue)) {
        return `${firstValue}-${secondValue}`;
    }

    return `${firstValue}`;
}

function extractSnowAmountInches(periods) {
    const safePeriods = Array.isArray(periods) ? periods : [];
    for (const period of safePeriods) {
        const text = `${period?.shortForecast || ''} ${period?.detailedForecast || ''}`;
        if (!/snow|flurr/i.test(text)) {
            continue;
        }

        const amount = extractRangeInches(text);
        if (amount) {
            return amount;
        }
    }

    return null;
}

function extractIceAccumulationInches(periods) {
    const safePeriods = Array.isArray(periods) ? periods : [];
    for (const period of safePeriods) {
        const text = `${period?.shortForecast || ''} ${period?.detailedForecast || ''}`;
        if (!/ice|freezing rain|sleet/i.test(text)) {
            continue;
        }

        const numericAmount = extractRangeInches(text);
        if (numericAmount) {
            return numericAmount;
        }

        const normalized = String(text).toLowerCase();
        if (/tenth of an inch/.test(normalized)) return '0.10';
        if (/quarter of an inch/.test(normalized)) return '0.25';
        if (/half an inch/.test(normalized)) return '0.50';
        if (/less than one tenth/.test(normalized)) return '<0.10';
    }

    return null;
}

function extractForecastWindGustMph(periods) {
    const safePeriods = Array.isArray(periods) ? periods : [];

    for (const period of safePeriods) {
        const text = `${period?.shortForecast || ''} ${period?.detailedForecast || ''}`;
        const gustMatch = text.match(/gusts?\s+as\s+high\s+as\s+(\d+(?:\.\d+)?)\s*mph/i);
        if (gustMatch) {
            const value = Number(gustMatch[1]);
            if (Number.isFinite(value)) {
                return Math.round(value);
            }
        }
    }

    let peakWind = null;
    safePeriods.slice(0, 8).forEach(period => {
        const speedText = String(period?.windSpeed || '').toLowerCase();
        const matches = speedText.match(/\d+(?:\.\d+)?/g);
        if (!matches) {
            return;
        }

        const maxInRow = Math.max(...matches.map(value => Number(value)).filter(Number.isFinite));
        if (!Number.isFinite(maxInRow)) {
            return;
        }

        if (peakWind === null || maxInRow > peakWind) {
            peakWind = maxInRow;
        }
    });

    return Number.isFinite(peakWind) ? Math.round(peakWind) : null;
}

function buildWinterForecastSummary(hourlyPeriods, forecastPeriods, metarData, todayLowTemperature) {
    const safeHourly = Array.isArray(hourlyPeriods) ? hourlyPeriods : [];
    const safeForecast = Array.isArray(forecastPeriods) ? forecastPeriods : [];
    const eventPeriod = safeHourly.slice(0, 24).find(period => getWinterEventType(`${period?.shortForecast || ''} ${period?.detailedForecast || ''}`));
    const eventType = getWinterEventType(`${eventPeriod?.shortForecast || ''} ${eventPeriod?.detailedForecast || ''}`);

    const eventProbabilityRaw = Number(eventPeriod?.probabilityOfPrecipitation?.value);
    const eventProbability = Number.isFinite(eventProbabilityRaw) ? Math.round(eventProbabilityRaw) : null;
    const snowAmountInches = extractSnowAmountInches(safeForecast.slice(0, 6));
    const iceAccumulationInches = extractIceAccumulationInches(safeForecast.slice(0, 6));
    const windGustForecastMph = extractForecastWindGustMph(safeForecast.slice(0, 6));

    const metarSnowDepthMeters = toFiniteNumber(metarData?.properties?.snowDepth?.value);
    const snowDepthInches = metarSnowDepthMeters === null ? null : (metarSnowDepthMeters * 39.3701);
    const todayLow = Number.isFinite(Number(todayLowTemperature)) ? Number(todayLowTemperature) : null;

    let winterPrimaryLabel = 'NO WINTER PRECIP EXPECTED';
    let winterPrimaryValue = '--';

    if (eventType === 'snow') {
        winterPrimaryLabel = 'PREDICTED SNOWFALL';
        winterPrimaryValue = snowAmountInches ? `${snowAmountInches} IN` : '--';
    } else if (eventType === 'freezing-rain') {
        winterPrimaryLabel = 'FREEZING RAIN EXPECTED';
        winterPrimaryValue = Number.isFinite(eventProbability) ? `${eventProbability}%` : '--';
    } else if (eventType === 'sleet') {
        winterPrimaryLabel = 'SLEET EXPECTED';
        winterPrimaryValue = Number.isFinite(eventProbability) ? `${eventProbability}%` : '--';
    }

    return {
        winterPrimaryLabel,
        winterPrimaryValue,
        winterPrimaryStartTime: formatForecastStartTime(eventPeriod?.startTime),
        winterSnowDepthText: Number.isFinite(snowDepthInches) ? `${snowDepthInches.toFixed(1)} IN` : '--',
        winterIceAccumulationText: iceAccumulationInches ? `${iceAccumulationInches} IN` : '--',
        winterWindGustsText: Number.isFinite(windGustForecastMph) ? `${windGustForecastMph} MPH` : '--',
        winterTodayLowText: todayLow === null ? '--' : `${todayLow}${DEGREE_SYMBOL}F`
    };
}

async function getWeather(city) {
    if (!city) {
        alert('Please enter a city name');
        return;
    }

    lastSearchedCity = city;

    if (cityInput) {
        cityInput.value = city;
    }

    if (settingsCityInput) {
        settingsCityInput.value = city;
    }

    try {
        await ensureRuntimeAssetsLoaded();
        const { lat, lon, cityName, zipCode } = await geocodeCity(city);
        const { forecastData, alertsData, hourlyData, metarData, pointsData } = await fetchWeatherGovData(lat, lon);
        const forecastOfficeCode = String(pointsData?.properties?.cwa || '').trim().toUpperCase();
        const [openAqData, sunTimesData, uvData, lunarData, pollenData, pollenExtendedData, hydrologicalData, marineData, radarData] = await Promise.all([
            fetchOpenAQCurrentConditions(lat, lon),
            fetchSunTimes(lat, lon),
            fetchCurrentUv(zipCode),
            fetchLunarData(lat, lon),
            fetchPollenCurrentForecast(zipCode, lat, lon),
            fetchPollenExtendedForecast(zipCode),
            fetchClosestHydrologicalGauges(lat, lon, HYDRO_MAX_CLOSEST_GAUGES),
            fetchClosestSurfZones(lat, lon, forecastOfficeCode, SURF_MAX_CLOSEST_ZONES, MARINE_RADIUS_MILES),
            fetchClosestRadarLoop(lat, lon)
        ]);
        if (pollenData) {
            console.log('[API] pollenCurrentForecastData:', pollenData);
        }
        if (pollenExtendedData) {
            console.log('[API] pollenExtendedForecastData:', pollenExtendedData);
        }
        if (hydrologicalData) {
            console.log('[API] hydrologicalData:', hydrologicalData);
        }
        if (marineData) {
            console.log('[API] marineData:', marineData);
            if (Array.isArray(marineData) && marineData.length > 0) {
                console.table(marineData.map(zone => ({
                    zone: zone.name,
                    zoneId: zone.zoneId,
                    distanceMiles: zone.distanceMiles,
                    waterTemp: zone.waterTemperatureText,
                    winds: zone.windsText,
                    surfHeight: zone.surfHeightText,
                    tideCount: Array.isArray(zone.tides) ? zone.tides.length : 0,
                    productIssued: zone.productIssuedTime
                })));
            }
        }
        if (radarData) {
            console.log('[API] radarData:', radarData);
        }
        const weatherValues = processWeatherData(forecastData, alertsData, hourlyData, metarData, openAqData, sunTimesData, uvData, lunarData, pollenData, pollenExtendedData, hydrologicalData, marineData, radarData);
        displayWeather(weatherValues, cityName);
        closeSettingsModal();

    } catch (error) {
        console.error('Error:', error);
        alert('Error fetching weather data');
    }
}

/* ===========================================
   GEOCODING: Convert city name to coordinates
   =========================================== */
async function geocodeCity(city) {
    const geoURL = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&addressdetails=1&limit=1`;
    const geoResponse = await fetch(geoURL);
    const geoData = await geoResponse.json();
    console.log('[API] geocodeData:', geoData);

    if (!geoData || geoData.length === 0) {
        throw new Error('City not found');
    }

    const topResult = geoData[0] || {};
    const lat = topResult.lat;
    const lon = topResult.lon;

    const address = topResult.address || {};
    const displayNameParts = String(topResult.display_name || '')
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);

    const cityName = String(
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.county ||
        displayNameParts[0] ||
        city
    ).trim();

    let zipCodeRaw = address.postcode || '';

    if (!zipCodeRaw && lat && lon) {
        try {
            const reverseUrl = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1`;
            const reverseResponse = await fetch(reverseUrl);
            if (reverseResponse.ok) {
                const reverseData = await reverseResponse.json();
                console.log('[API] reverseGeocodeData:', reverseData);
                zipCodeRaw = reverseData && reverseData.address ? reverseData.address.postcode || '' : '';
            }
        } catch (error) {
            console.warn('[API] Reverse geocode for ZIP unavailable:', error);
        }
    }

    const zipCodeMatch = String(zipCodeRaw).match(/\d{5}/);
    const zipCode = zipCodeMatch ? zipCodeMatch[0] : '';
    return { lat, lon, cityName, zipCode };
}

// Backward-compatible alias while the app transitions from OpenAQ naming to AirNow.
async function fetchOpenAQCurrentConditions(lat, lon) {
    return fetchAirNowCurrentConditions(lat, lon);
}

async function fetchAirNowCurrentConditions(lat, lon) {
    if (!airNowApiKey) {
        console.warn('[API] AirNow skipped: set the AirNow API key in Settings.');
        return null;
    }

    const airNowUrl = `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${lat}&longitude=${lon}&distance=25&API_KEY=${encodeURIComponent(airNowApiKey)}`;

    try {
        const response = await fetch(airNowUrl, {
            headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`AirNow request failed: ${response.status} ${text}`);
        }

        const airNowPayload = await response.json();
        console.log('[API] airNowData:', airNowPayload);

        const observations = Array.isArray(airNowPayload) ? airNowPayload : [];
        if (observations.length === 0) {
            return null;
        }

        const primary = observations
            .filter(observation => observation && Number.isFinite(Number(observation.AQI)))
            .sort((a, b) => Number(b.AQI) - Number(a.AQI))[0] || observations[0];

        return {
            aqi: Number.isFinite(Number(primary.AQI)) ? Number(primary.AQI) : null,
            primaryPollutant: String(primary.ParameterName || 'N/A').toUpperCase(),
            category: String(primary.Category?.Name || 'Unknown')
        };
    } catch (error) {
        console.warn('[API] AirNow unavailable:', error);
        return null;
    }
}

function toFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function haversineDistanceMiles(lat1, lon1, lat2, lon2) {
    const firstLat = toFiniteNumber(lat1);
    const firstLon = toFiniteNumber(lon1);
    const secondLat = toFiniteNumber(lat2);
    const secondLon = toFiniteNumber(lon2);

    if (firstLat === null || firstLon === null || secondLat === null || secondLon === null) {
        return Number.POSITIVE_INFINITY;
    }

    const toRadians = degrees => degrees * (Math.PI / 180);
    const earthRadiusMiles = 3958.8;
    const deltaLat = toRadians(secondLat - firstLat);
    const deltaLon = toRadians(secondLon - firstLon);
    const radLat1 = toRadians(firstLat);
    const radLat2 = toRadians(secondLat);

    const a = Math.sin(deltaLat / 2) ** 2
        + Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(deltaLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusMiles * c;
}

function findMostRecentGaugeDatum(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return null;
    }

    let latest = null;
    let latestTimestamp = Number.NEGATIVE_INFINITY;

    data.forEach(entry => {
        const validTimeMs = Date.parse(entry?.validTime || '');
        if (!Number.isFinite(validTimeMs)) {
            return;
        }

        if (validTimeMs > latestTimestamp) {
            latestTimestamp = validTimeMs;
            latest = entry;
        }
    });

    return latest || data[data.length - 1] || null;
}

async function fetchNwpsGaugesByBoundingBox(lat, lon, deltaDegrees) {
    const baseLat = toFiniteNumber(lat);
    const baseLon = toFiniteNumber(lon);
    const delta = toFiniteNumber(deltaDegrees);

    if (baseLat === null || baseLon === null || delta === null || delta <= 0) {
        return [];
    }

    const params = new URLSearchParams();
    params.set('srid', 'EPSG_4326');
    params.set('bbox.xmin', String(baseLon - delta));
    params.set('bbox.ymin', String(baseLat - delta));
    params.set('bbox.xmax', String(baseLon + delta));
    params.set('bbox.ymax', String(baseLat + delta));

    const url = `${NWPS_BASE_URL}/gauges?${params.toString()}`;
    const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`NWPS gauges request failed: ${response.status} ${text}`);
    }

    const payload = await response.json();
    console.log('[API] nwpsGaugeListData:', payload);
    return Array.isArray(payload?.gauges) ? payload.gauges : [];
}

async function fetchNwpsGaugeMetadata(identifier) {
    const encodedIdentifier = encodeURIComponent(String(identifier || '').trim());
    if (!encodedIdentifier) {
        return null;
    }

    const url = `${NWPS_BASE_URL}/gauges/${encodedIdentifier}`;
    const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`NWPS gauge metadata request failed (${identifier}): ${response.status} ${text}`);
    }

    const payload = await response.json();
    console.log(`[API] nwpsGaugeMetadataData:${identifier}:`, payload);
    return payload;
}

async function fetchNwpsObservedStageFlow(identifier) {
    const encodedIdentifier = encodeURIComponent(String(identifier || '').trim());
    if (!encodedIdentifier) {
        return null;
    }

    const url = `${NWPS_BASE_URL}/gauges/${encodedIdentifier}/stageflow/observed`;
    const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`NWPS observed stageflow request failed (${identifier}): ${response.status} ${text}`);
    }

    const payload = await response.json();
    console.log(`[API] nwpsObservedStageflowData:${identifier}:`, payload);
    return payload;
}

async function fetchClosestHydrologicalGauges(lat, lon, maxCount = HYDRO_MAX_CLOSEST_GAUGES) {
    const baseLat = toFiniteNumber(lat);
    const baseLon = toFiniteNumber(lon);
    if (baseLat === null || baseLon === null) {
        return [];
    }

    const searchRings = [0.25, 0.5, 1, 2, 4, 8];
    const uniqueByLid = new Map();

    try {
        for (const ring of searchRings) {
            const gaugesInRing = await fetchNwpsGaugesByBoundingBox(baseLat, baseLon, ring);
            gaugesInRing.forEach(gauge => {
                const key = String(gauge?.lid || gauge?.usgsId || '').trim();
                if (!key || uniqueByLid.has(key)) {
                    return;
                }

                const distanceMiles = haversineDistanceMiles(baseLat, baseLon, gauge?.latitude, gauge?.longitude);
                uniqueByLid.set(key, {
                    ...gauge,
                    gaugeId: key,
                    distanceMiles
                });
            });

            if (uniqueByLid.size >= maxCount) {
                break;
            }
        }

        const closest = Array.from(uniqueByLid.values())
            .sort((a, b) => a.distanceMiles - b.distanceMiles)
            .slice(0, maxCount);

        const enriched = await Promise.all(closest.map(async gauge => {
            const identifier = gauge?.gaugeId;
            if (!identifier) {
                return null;
            }

            try {
                const [gaugeMetadata, observedStageFlow] = await Promise.all([
                    fetchNwpsGaugeMetadata(identifier),
                    fetchNwpsObservedStageFlow(identifier)
                ]);

                const latestObservedDatum = findMostRecentGaugeDatum(observedStageFlow?.data);
                const observedStatus = gaugeMetadata?.status?.observed || gauge?.status?.observed || null;

                return {
                    identifier,
                    name: gaugeMetadata?.name || gauge?.name || identifier,
                    latitude: toFiniteNumber(gaugeMetadata?.latitude ?? gauge?.latitude),
                    longitude: toFiniteNumber(gaugeMetadata?.longitude ?? gauge?.longitude),
                    distanceMiles: Number.isFinite(gauge?.distanceMiles) ? Number(gauge.distanceMiles.toFixed(1)) : null,
                    stageUnits: observedStageFlow?.primaryUnits || null,
                    flowUnits: observedStageFlow?.secondaryUnits || null,
                    currentStage: toFiniteNumber(latestObservedDatum?.primary ?? observedStatus?.primary),
                    currentFlow: toFiniteNumber(latestObservedDatum?.secondary ?? observedStatus?.secondary),
                    observedTime: latestObservedDatum?.validTime || observedStatus?.validTime || null,
                    floodCategory: observedStatus?.floodCategory || gaugeMetadata?.ObservedFloodCategory || null,
                    gaugeMetadata,
                    observedStageFlow
                };
            } catch (error) {
                console.warn(`[API] NWPS gauge enrichment unavailable (${identifier}):`, error);

                const observedStatus = gauge?.status?.observed || null;
                return {
                    identifier,
                    name: gauge?.name || identifier,
                    latitude: toFiniteNumber(gauge?.latitude),
                    longitude: toFiniteNumber(gauge?.longitude),
                    distanceMiles: Number.isFinite(gauge?.distanceMiles) ? Number(gauge.distanceMiles.toFixed(1)) : null,
                    stageUnits: observedStatus?.primaryUnit || null,
                    flowUnits: observedStatus?.secondaryUnit || null,
                    currentStage: toFiniteNumber(observedStatus?.primary),
                    currentFlow: toFiniteNumber(observedStatus?.secondary),
                    observedTime: observedStatus?.validTime || null,
                    floodCategory: observedStatus?.floodCategory || null,
                    gaugeMetadata: null,
                    observedStageFlow: null
                };
            }
        }));

        return enriched.filter(Boolean);
    } catch (error) {
        console.warn('[API] NWPS hydrological data unavailable:', error);
        return [];
    }
}

function formatCoopsDateTimeUtc(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');
    return `${year}${month}${day} ${hour}:${minute}`;
}

function getCoopsDateRange(hoursBack = MARINE_LOOKBACK_HOURS) {
    const lookbackHours = Math.max(1, Number(hoursBack) || MARINE_LOOKBACK_HOURS);
    const end = new Date();
    const begin = new Date(end.getTime() - lookbackHours * 60 * 60 * 1000);

    return {
        beginDate: formatCoopsDateTimeUtc(begin),
        endDate: formatCoopsDateTimeUtc(end)
    };
}

function findMostRecentCoopsDatum(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return null;
    }

    let latest = null;
    let latestTimestamp = Number.NEGATIVE_INFINITY;

    data.forEach(entry => {
        const rawTimestamp = String(entry?.t || '').trim();
        if (!rawTimestamp) {
            return;
        }

        const parsedTimestamp = Date.parse(`${rawTimestamp.replace(' ', 'T')}Z`);
        if (!Number.isFinite(parsedTimestamp)) {
            return;
        }

        if (parsedTimestamp > latestTimestamp) {
            latestTimestamp = parsedTimestamp;
            latest = entry;
        }
    });

    return latest || data[data.length - 1] || null;
}

async function fetchCoopsWaterLevelStations() {
    if (Array.isArray(cachedCoopsWaterLevelStations) && cachedCoopsWaterLevelStations.length > 0) {
        return cachedCoopsWaterLevelStations;
    }

    const fetchStationsByType = async stationType => {
        const params = new URLSearchParams();
        params.set('type', stationType);
        params.set('units', 'english');

        const url = `${COOPS_MDAPI_BASE_URL}/stations.json?${params.toString()}`;
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`CO-OPS ${stationType} station list request failed: ${response.status} ${text}`);
        }

        const payload = await response.json();
        console.log(`[API] coops${stationType}StationListData:`, payload);
        return Array.isArray(payload?.stations) ? payload.stations : [];
    };

    const [waterLevelStations, meteorologicalStations] = await Promise.all([
        fetchStationsByType('waterlevels'),
        fetchStationsByType('met')
    ]);

    const stationsById = new Map();
    [...waterLevelStations, ...meteorologicalStations].forEach(station => {
        const stationId = String(station?.id || '').trim();
        if (!stationId || stationsById.has(stationId)) {
            return;
        }

        stationsById.set(stationId, station);
    });

    const stations = Array.from(stationsById.values());
    cachedCoopsWaterLevelStations = stations;
    return stations;
}

async function fetchCoopsDatagetterProduct(stationId, product, additionalParams = {}) {
    const safeStationId = String(stationId || '').trim();
    const safeProduct = String(product || '').trim();

    if (!safeStationId || !safeProduct) {
        return null;
    }

    const { beginDate, endDate } = getCoopsDateRange();
    const params = new URLSearchParams();
    params.set('product', safeProduct);
    params.set('application', 'weatherapp');
    params.set('begin_date', beginDate);
    params.set('end_date', endDate);
    params.set('station', safeStationId);
    params.set('time_zone', 'gmt');
    params.set('units', 'english');
    params.set('format', 'json');

    Object.entries(additionalParams).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
            return;
        }

        params.set(key, String(value));
    });

    const url = `${COOPS_DATAGETTER_BASE_URL}?${params.toString()}`;
    const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`CO-OPS ${safeProduct} request failed (${safeStationId}): ${response.status} ${text}`);
    }

    const payload = await response.json();
    if (payload?.error?.message) {
        throw new Error(`CO-OPS ${safeProduct} error (${safeStationId}): ${payload.error.message}`);
    }

    console.log(`[API] coops${safeProduct}Data:${safeStationId}:`, payload);
    return payload;
}

function getNextTideExtrema(predictions) {
    const rows = Array.isArray(predictions) ? predictions : [];
    const nowMs = Date.now();

    const parsed = rows
        .map(row => {
            const timestampText = String(row?.t || '').trim();
            const parsedMs = Date.parse(`${timestampText.replace(' ', 'T')}Z`);

            return {
                raw: row,
                timeText: timestampText,
                timeMs: Number.isFinite(parsedMs) ? parsedMs : Number.POSITIVE_INFINITY,
                type: String(row?.type || '').trim().toUpperCase(),
                height: toFiniteNumber(row?.v)
            };
        })
        .filter(row => row.timeText && Number.isFinite(row.timeMs) && (row.type === 'H' || row.type === 'L'))
        .sort((a, b) => a.timeMs - b.timeMs);

    const upcoming = parsed.filter(row => row.timeMs >= nowMs);
    const candidateRows = upcoming.length > 0 ? upcoming : parsed;
    const nextHigh = candidateRows.find(row => row.type === 'H') || null;
    const nextLow = candidateRows.find(row => row.type === 'L') || null;

    return {
        nextHigh,
        nextLow
    };
}

async function fetchCoopsTidePredictions(stationId, daysAhead = MARINE_PREDICTION_DAYS_AHEAD) {
    const safeStationId = String(stationId || '').trim();
    if (!safeStationId) {
        return null;
    }

    const safeDaysAhead = Math.max(1, Number(daysAhead) || MARINE_PREDICTION_DAYS_AHEAD);
    const beginDate = formatCoopsDateTimeUtc(new Date()).slice(0, 8);
    const endDate = formatCoopsDateTimeUtc(new Date(Date.now() + safeDaysAhead * 24 * 60 * 60 * 1000)).slice(0, 8);

    const params = new URLSearchParams();
    params.set('product', 'predictions');
    params.set('application', 'weatherapp');
    params.set('begin_date', beginDate);
    params.set('end_date', endDate);
    params.set('datum', 'MLLW');
    params.set('station', safeStationId);
    params.set('time_zone', 'gmt');
    params.set('units', 'english');
    params.set('interval', 'hilo');
    params.set('format', 'json');

    const url = `${COOPS_DATAGETTER_BASE_URL}?${params.toString()}`;
    const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`CO-OPS predictions request failed (${safeStationId}): ${response.status} ${text}`);
    }

    const payload = await response.json();
    if (payload?.error?.message) {
        throw new Error(`CO-OPS predictions error (${safeStationId}): ${payload.error.message}`);
    }

    console.log(`[API] coopsPredictionsData:${safeStationId}:`, payload);
    return payload;
}

function getForecastOfficeCode(forecastOfficeUrl, fallbackCode = '') {
    const match = String(forecastOfficeUrl || '').match(/\/offices\/([A-Z]{3})$/i);
    if (match && match[1]) {
        return match[1].toUpperCase();
    }

    return String(fallbackCode || '').trim().toUpperCase();
}

async function fetchLatestSurfForecastProductByOffice(officeCode) {
    const safeOffice = String(officeCode || '').trim().toUpperCase();
    if (!safeOffice) {
        return null;
    }

    const listUrl = `https://api.weather.gov/products/types/SRF/locations/${encodeURIComponent(safeOffice)}`;
    const listResponse = await fetch(listUrl, {
        headers: { 'Accept': 'application/geo+json' }
    });

    if (!listResponse.ok) {
        const text = await listResponse.text();
        throw new Error(`SRF list request failed (${safeOffice}): ${listResponse.status} ${text}`);
    }

    const listPayload = await listResponse.json();
    const products = Array.isArray(listPayload?.['@graph']) ? listPayload['@graph'] : [];
    if (products.length === 0) {
        return null;
    }

    const latestProduct = products
        .slice()
        .sort((a, b) => Date.parse(String(b?.issuanceTime || '')) - Date.parse(String(a?.issuanceTime || '')))[0];

    const productId = String(latestProduct?.id || '').trim();
    if (!productId) {
        return null;
    }

    const productUrl = `https://api.weather.gov/products/${encodeURIComponent(productId)}`;
    const productResponse = await fetch(productUrl, {
        headers: { 'Accept': 'application/geo+json' }
    });

    if (!productResponse.ok) {
        const text = await productResponse.text();
        throw new Error(`SRF product request failed (${safeOffice}/${productId}): ${productResponse.status} ${text}`);
    }

    const productPayload = await productResponse.json();
    return {
        officeCode: safeOffice,
        productId,
        issuanceTime: String(productPayload?.issuanceTime || latestProduct?.issuanceTime || '').trim() || null,
        productText: String(productPayload?.productText || '').trim()
    };
}

function parseSurfZoneSections(productText) {
    const text = String(productText || '').replace(/\r/g, '');
    if (!text) {
        return [];
    }

    const rawSections = text
        .split(/\n\$\$\n/g)
        .map(section => section.trim())
        .filter(Boolean);

    const zoneSections = [];

    rawSections.forEach(section => {
        const sectionHeaderLine = section
            .split('\n')
            .map(line => String(line || '').trim())
            .find(line => /^[A-Z]{2}Z\d{3}(?:-\d{3})+-\d{6}-$/.test(line) || /^[A-Z]{2}Z\d{3}-\d{6}-$/.test(line));

        if (!sectionHeaderLine) {
            return;
        }

        const compactHeader = sectionHeaderLine.replace(/-$/, '');
        const headerParts = compactHeader.split('-').filter(Boolean);
        const zonePrefixMatch = headerParts[0]?.match(/^([A-Z]{2}Z)(\d{3})$/i);
        if (!zonePrefixMatch) {
            return;
        }

        const zonePrefix = String(zonePrefixMatch[1] || '').toUpperCase();
        const zoneIds = headerParts
            .slice(0, -1)
            .map((part, index) => {
                if (index === 0) {
                    return `${zonePrefix}${zonePrefixMatch[2]}`;
                }

                const numericMatch = String(part || '').match(/^(\d{3})$/);
                return numericMatch ? `${zonePrefix}${numericMatch[1]}` : null;
            })
            .filter(Boolean);

        if (zoneIds.length === 0) {
            return;
        }

        const zoneId = zoneIds[0];
        const lines = section.split('\n');
        const zoneHeaderIndex = lines.findIndex(line => line.includes(`${zoneId}-`));

        let zoneName = zoneId;
        for (let index = zoneHeaderIndex + 1; index < lines.length; index += 1) {
            const line = String(lines[index] || '').trim();
            if (!line) {
                continue;
            }

            if (/^Including the beaches of/i.test(line) || /^\./.test(line) || /^\d/.test(line)) {
                break;
            }

            zoneName = line.replace(/-+$/, '').trim() || zoneId;
            break;
        }

        const todayStart = lines.findIndex(line => /^\.(?:TODAY|REST OF TODAY)\.\.\./i.test(String(line || '').trim()));
        if (todayStart < 0) {
            return;
        }

        let todayEnd = lines.length;
        for (let index = todayStart + 1; index < lines.length; index += 1) {
            const trimmed = String(lines[index] || '').trim();
            if (/^\.[A-Z0-9 ]+\.\.\./.test(trimmed) || trimmed === '&&') {
                todayEnd = index;
                break;
            }
        }

        const todayLines = lines.slice(todayStart + 1, todayEnd);
        const todayBlock = todayLines.join('\n');

        const readField = label => {
            const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const fieldMatch = todayBlock.match(new RegExp(`^\\s*${escapedLabel}\\*{0,2}\\.*\\s*(.+)$`, 'im'));
            if (!fieldMatch) {
                return null;
            }

            return sanitizeMarineDisplayText(fieldMatch[1]);
        };

        const readFieldFromLabels = labels => {
            const keys = Array.isArray(labels) ? labels : [];
            for (const label of keys) {
                const value = readField(label);
                if (value) {
                    return value;
                }
            }

            return null;
        };

        const tides = [];
        const tidesStart = todayLines.findIndex(line => /^\s*Tides\.\.\./i.test(String(line || '').trim()));
        if (tidesStart >= 0) {
            let tideLocation = '';

            for (let index = tidesStart + 1; index < todayLines.length; index += 1) {
                const rawLine = String(todayLines[index] || '');
                const trimmed = rawLine.trim();
                if (!trimmed) {
                    continue;
                }

                if (/^(Sunrise|Sunset|Weather|Winds|High Temperature|Max Heat Index|Rip Current Risk|Surf Height)/i.test(trimmed)) {
                    break;
                }

                const withLocation = rawLine.match(/^\s*([^\.\n].*?)\.{2,}\s*(Low|High)\s+at\s+(.+?)\.?\s*$/i);
                if (withLocation) {
                    tideLocation = sanitizeMarineDisplayText(withLocation[1]);
                    tides.push({
                        location: tideLocation,
                        level: String(withLocation[2] || '').trim().toLowerCase(),
                        timeText: sanitizeMarineDisplayText(withLocation[3])
                    });
                    continue;
                }

                const levelOnly = rawLine.match(/^\s*(Low|High)\s+at\s+(.+?)\.?\s*$/i);
                if (levelOnly) {
                    tides.push({
                        location: sanitizeMarineDisplayText(tideLocation || zoneName),
                        level: String(levelOnly[1] || '').trim().toLowerCase(),
                        timeText: sanitizeMarineDisplayText(levelOnly[2])
                    });
                }
            }
        }

        const extractConsiderationCategory = value => {
            const raw = String(value || '').trim();
            if (!raw) {
                return null;
            }

            const firstSegment = raw
                .replace(/\s+/g, ' ')
                .split(/[.;]/)[0]
                .trim();

            if (!firstSegment) {
                return null;
            }

            const knownCategory = firstSegment.match(/\b(LOW|MODERATE|HIGH|EXTREME|ELEVATED|LIMITED|ISOLATED|SCATTERED|LIKELY)\b/i);
            if (knownCategory) {
                return knownCategory[1].toUpperCase();
            }

            const leadingWords = firstSegment.split(' ').slice(0, 3).join(' ').trim();
            return leadingWords.toUpperCase() || null;
        };

        const specialLabels = [
            'Rip Current Risk',
            'Swim Risk',
            'Thunderstorm Potential',
            'Thunderstorm Risk',
            'Waterspout Risk',
            'Lightning Risk',
            'Shark Risk'
        ];

        const specialConsiderations = specialLabels
            .map(label => {
                const rawValue = readField(label);
                const category = extractConsiderationCategory(rawValue);
                return {
                    label,
                    category
                };
            })
            .filter(item => item.category)
            .filter(item => !/^none\b/i.test(String(item.category || '').trim()));

        zoneIds.forEach(currentZoneId => {
            zoneSections.push({
                zoneId: currentZoneId,
                name: zoneName,
                surfHeightText: readField('Surf Height'),
                waterTemperatureText: readFieldFromLabels(['Water Temperature', 'Surf Temperature']),
                windsText: readField('Winds'),
                tides,
                specialConsiderations
            });
        });
    });

    return zoneSections;
}

function getGeometryCoordinatePairs(geometry) {
    const pairs = [];

    const traverseCoordinates = node => {
        if (!Array.isArray(node)) {
            return;
        }

        if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
            pairs.push([node[0], node[1]]);
            return;
        }

        node.forEach(traverseCoordinates);
    };

    const visitGeometry = currentGeometry => {
        if (!currentGeometry || typeof currentGeometry !== 'object') {
            return;
        }

        if (Array.isArray(currentGeometry.coordinates)) {
            traverseCoordinates(currentGeometry.coordinates);
        }

        if (Array.isArray(currentGeometry.geometries)) {
            currentGeometry.geometries.forEach(visitGeometry);
        }
    };

    visitGeometry(geometry);
    return pairs;
}

function getGeometryCenterPoint(geometry) {
    const pairs = getGeometryCoordinatePairs(geometry);
    if (pairs.length === 0) {
        return { latitude: null, longitude: null };
    }

    let lonSum = 0;
    let latSum = 0;
    pairs.forEach(pair => {
        lonSum += pair[0];
        latSum += pair[1];
    });

    return {
        latitude: latSum / pairs.length,
        longitude: lonSum / pairs.length
    };
}

function getGeometryDistanceMiles(baseLat, baseLon, geometry) {
    const pairs = getGeometryCoordinatePairs(geometry);
    if (pairs.length === 0) {
        return Number.POSITIVE_INFINITY;
    }

    let nearestDistance = Number.POSITIVE_INFINITY;

    pairs.forEach(pair => {
        const distanceMiles = haversineDistanceMiles(baseLat, baseLon, pair[1], pair[0]);
        if (distanceMiles < nearestDistance) {
            nearestDistance = distanceMiles;
        }
    });

    return nearestDistance;
}

async function fetchForecastZoneMetadata(zoneId) {
    const safeZoneId = String(zoneId || '').trim().toUpperCase();
    if (!safeZoneId) {
        return null;
    }

    if (cachedSurfZoneMetadataById.has(safeZoneId)) {
        return cachedSurfZoneMetadataById.get(safeZoneId);
    }

    const url = `https://api.weather.gov/zones/forecast/${encodeURIComponent(safeZoneId)}`;
    const response = await fetch(url, {
        headers: { 'Accept': 'application/geo+json' }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Forecast zone metadata request failed (${safeZoneId}): ${response.status} ${text}`);
    }

    const payload = await response.json();
    cachedSurfZoneMetadataById.set(safeZoneId, payload);
    return payload;
}

async function fetchClosestSurfZones(lat, lon, officeCode, maxCount = SURF_MAX_CLOSEST_ZONES, radiusMiles = MARINE_RADIUS_MILES) {
    const baseLat = toFiniteNumber(lat);
    const baseLon = toFiniteNumber(lon);
    if (baseLat === null || baseLon === null) {
        return [];
    }

    const safeOfficeCode = getForecastOfficeCode(officeCode, officeCode);
    if (!safeOfficeCode) {
        return [];
    }

    const maxDistanceMiles = Math.max(1, Number(radiusMiles) || MARINE_RADIUS_MILES);
    const safeMaxCount = Math.max(1, Number(maxCount) || SURF_MAX_CLOSEST_ZONES);

    try {
        const latestProduct = await fetchLatestSurfForecastProductByOffice(safeOfficeCode);
        if (!latestProduct?.productText) {
            return [];
        }

        const parsedSurfZones = parseSurfZoneSections(latestProduct.productText);
        if (parsedSurfZones.length === 0) {
            return [];
        }

        const enriched = await Promise.all(parsedSurfZones.map(async zone => {
            try {
                const zoneMetadata = await fetchForecastZoneMetadata(zone.zoneId);
                const distanceMiles = getGeometryDistanceMiles(baseLat, baseLon, zoneMetadata?.geometry);

                return {
                    zoneId: zone.zoneId,
                    name: zoneMetadata?.properties?.name || zone.name || zone.zoneId,
                    distanceMiles: Number.isFinite(distanceMiles) ? Number(distanceMiles.toFixed(1)) : null,
                    waterTemperatureText: zone.waterTemperatureText || null,
                    windsText: zone.windsText || null,
                    surfHeightText: zone.surfHeightText || null,
                    tides: Array.isArray(zone.tides) ? zone.tides : [],
                    specialConsiderations: Array.isArray(zone.specialConsiderations) ? zone.specialConsiderations : [],
                    productIssuedTime: latestProduct.issuanceTime,
                    officeCode: safeOfficeCode
                };
            } catch (error) {
                console.warn(`[API] SRF zone metadata unavailable (${zone.zoneId}):`, error);
                return null;
            }
        }));

        const validByDistance = enriched
            .filter(zone => zone && Number.isFinite(zone.distanceMiles))
            .sort((a, b) => a.distanceMiles - b.distanceMiles);

        const inRange = validByDistance.filter(zone => zone.distanceMiles <= maxDistanceMiles);
        if (inRange.length > 0) {
            return inRange.slice(0, safeMaxCount);
        }

        // If all zones are outside the local radius, fall back to nearest available zones.
        return validByDistance.slice(0, safeMaxCount);
    } catch (error) {
        console.warn('[API] SRF surf zone data unavailable:', error);
        return [];
    }
}

async function fetchRadarStations() {
    if (Array.isArray(cachedRadarStations) && cachedRadarStations.length > 0) {
        return cachedRadarStations;
    }

    const response = await fetch(NWS_RADAR_STATIONS_URL, {
        headers: { 'Accept': 'application/geo+json' }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Radar stations request failed: ${response.status} ${text}`);
    }

    const payload = await response.json();
    console.log('[API] radarStationListData:', payload);

    const stations = (Array.isArray(payload?.features) ? payload.features : [])
        .map(feature => {
            const coordinates = Array.isArray(feature?.geometry?.coordinates)
                ? feature.geometry.coordinates
                : [];
            const stationId = String(feature?.properties?.id || '').trim();

            return {
                stationId,
                name: String(feature?.properties?.name || stationId || '').trim(),
                latitude: toFiniteNumber(coordinates[1]),
                longitude: toFiniteNumber(coordinates[0])
            };
        })
        .filter(station => station.stationId && station.latitude !== null && station.longitude !== null);

    cachedRadarStations = stations;
    return stations;
}

async function fetchClosestRadarLoop(lat, lon) {
    const baseLat = toFiniteNumber(lat);
    const baseLon = toFiniteNumber(lon);
    if (baseLat === null || baseLon === null) {
        return null;
    }

    try {
        const stations = await fetchRadarStations();
        if (!Array.isArray(stations) || stations.length === 0) {
            return null;
        }

        const nearestStation = stations
            .map(station => ({
                ...station,
                distanceMiles: haversineDistanceMiles(baseLat, baseLon, station.latitude, station.longitude)
            }))
            // Ridge loop images are available for station IDs such as Kxxx/Pxxx.
            .filter(station => /^[KP][A-Z0-9]{3}$/i.test(String(station.stationId || '')))
            .filter(station => Number.isFinite(station.distanceMiles))
            .sort((a, b) => a.distanceMiles - b.distanceMiles)[0] || null;

        if (!nearestStation) {
            return null;
        }

        const stationId = String(nearestStation.stationId || '').trim().toUpperCase();

        return {
            stationId,
            stationName: nearestStation.name,
            distanceMiles: Number(nearestStation.distanceMiles.toFixed(1)),
            radarLoopGifUrl: `${RADAR_LOOP_GIF_BASE_URL}/${encodeURIComponent(stationId)}_loop.gif`
        };
    } catch (error) {
        console.warn('[API] Radar data unavailable:', error);
        return null;
    }
}

function getHydroCategoryFromThresholds(currentValue, thresholds) {
    const value = toFiniteNumber(currentValue);
    if (value === null || !thresholds || typeof thresholds !== 'object') {
        return 'none';
    }

    const orderedCategories = ['action', 'minor', 'moderate', 'major'];
    let returnCategory = 'none';

    for (const category of orderedCategories) {
        const categoryThreshold = toFiniteNumber(thresholds[category]);

        if (categoryThreshold === null) {
            break;
        }

        if (categoryThreshold === -9999) {
            break;
        }

        if (value >= categoryThreshold) {
            returnCategory = category;
            continue;
        }

        break;
    }

    return returnCategory;
}

function isHydroNoDataValue(value) {
    const numericValue = toFiniteNumber(value);
    return numericValue === null || numericValue <= -900;
}

function getHydroCategoryRank(category) {
    const rankByCategory = {
        none: 0,
        action: 1,
        minor: 2,
        moderate: 3,
        major: 4
    };

    return rankByCategory[String(category || '').toLowerCase()] ?? -1;
}

function getHydroCardImagePath(category) {
    const normalizedCategory = String(category || 'none').toLowerCase();
    const knownCategories = new Set(['none', 'action', 'minor', 'moderate', 'major']);
    const safeCategory = knownCategories.has(normalizedCategory) ? normalizedCategory : 'none';
    return `hydrological/${safeCategory}.png`;
}

function getHydroThresholdsByType(gaugeData, valueType) {
    const categories = gaugeData?.gaugeMetadata?.flood?.categories || null;
    if (!categories || typeof categories !== 'object') {
        return null;
    }

    const key = valueType === 'flow' ? 'flow' : 'stage';
    return {
        action: toFiniteNumber(categories.action?.[key]),
        minor: toFiniteNumber(categories.minor?.[key]),
        moderate: toFiniteNumber(categories.moderate?.[key]),
        major: toFiniteNumber(categories.major?.[key])
    };
}

function getHydroImpactStatement(gaugeData) {
    const impactRowsRaw = Array.isArray(gaugeData?.gaugeMetadata?.flood?.impacts)
        ? gaugeData.gaugeMetadata.flood.impacts
        : [];

    const impactRows = impactRowsRaw
        .map(row => ({
            stage: toFiniteNumber(row?.stage),
            statement: String(row?.statement || '').trim()
        }))
        .filter(row => row.stage !== null && row.statement);

    if (impactRows.length === 0 || isHydroNoDataValue(gaugeData?.currentStage)) {
        return 'No impact statement available.';
    }

    const currentStage = toFiniteNumber(gaugeData?.currentStage);
    const eligible = impactRows
        .filter(row => row.stage <= currentStage)
        .sort((a, b) => b.stage - a.stage);

    if (eligible.length > 0) {
        return eligible[0].statement;
    }

    return 'No impact statement available.';
}

function formatHydroValue(value, units) {
    const numericValue = toFiniteNumber(value);
    if (numericValue === null || numericValue <= -900) {
        return '--';
    }

    const formattedValue = Number.isInteger(numericValue)
        ? String(numericValue)
        : numericValue.toFixed(1);
    const unitLabel = String(units || '').trim().toUpperCase();
    return unitLabel ? `${formattedValue} ${unitLabel}` : formattedValue;
}

function formatSunTime(isoTime) {
    if (!isoTime) {
        return '--:--';
    }

    const parsed = new Date(isoTime);
    if (Number.isNaN(parsed.getTime())) {
        return '--:--';
    }

    return parsed.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
    }).toUpperCase();
}

function formatHourOnly(isoTime) {
    if (!isoTime) {
        return '--';
    }

    const parsed = new Date(isoTime);
    if (Number.isNaN(parsed.getTime())) {
        return '--';
    }

    return parsed.toLocaleTimeString([], {
        hour: 'numeric'
    }).toUpperCase();
}

async function fetchSunTimes(lat, lon) {
    const sunTimesUrl = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`;

    try {
        const response = await fetch(sunTimesUrl, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Sun times request failed: ${response.status}`);
        }

        const sunPayload = await response.json();
        if (!sunPayload || sunPayload.status !== 'OK' || !sunPayload.results) {
            return null;
        }

        return {
            sunrise: sunPayload.results.sunrise || null,
            sunset: sunPayload.results.sunset || null
        };
    } catch (error) {
        console.warn('[API] Sunrise/Sunset unavailable:', error);
        return null;
    }
}

function normalizeEpaUvDateTime(rawDateTime) {
    if (!rawDateTime) {
        return null;
    }

    const text = String(rawDateTime).trim();
    if (!text) {
        return null;
    }

    const directParsed = new Date(text);
    if (!Number.isNaN(directParsed.getTime())) {
        return directParsed.toISOString();
    }

    // EPA UV hourly format can look like: "May/23/2026 07 AM"
    const match = text.match(/^([A-Za-z]+)\/(\d{1,2})\/(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (!match) {
        return null;
    }

    const monthLookup = {
        jan: 0,
        january: 0,
        feb: 1,
        february: 1,
        mar: 2,
        march: 2,
        apr: 3,
        april: 3,
        may: 4,
        jun: 5,
        june: 5,
        jul: 6,
        july: 6,
        aug: 7,
        august: 7,
        sep: 8,
        sept: 8,
        september: 8,
        oct: 9,
        october: 9,
        nov: 10,
        november: 10,
        dec: 11,
        december: 11
    };

    const monthIndex = monthLookup[String(match[1]).toLowerCase()];
    if (!Number.isInteger(monthIndex)) {
        return null;
    }

    const day = Number(match[2]);
    const year = Number(match[3]);
    const hour12 = Number(match[4]);
    const minute = Number(match[5] || 0);
    const meridiem = String(match[6]).toUpperCase();

    if (!Number.isFinite(day) || !Number.isFinite(year) || !Number.isFinite(hour12) || !Number.isFinite(minute)) {
        return null;
    }

    let hour24 = hour12 % 12;
    if (meridiem === 'PM') {
        hour24 += 12;
    }

    const parsed = new Date(year, monthIndex, day, hour24, minute, 0, 0);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed.toISOString();
}

async function fetchCurrentUv(zipCode) {
    const normalizedZip = String(zipCode || '').trim();
    if (!/^\d{5}$/.test(normalizedZip)) {
        console.warn('[API] EPA UV skipped: no ZIP code was found in geolocation data.');
        return null;
    }

    const uvHourlyUrl = `https://data.epa.gov/efservice/getEnvirofactsUVHOURLY/ZIP/${encodeURIComponent(normalizedZip)}/JSON`;
    const uvDailyUrl = `https://data.epa.gov/efservice/getEnvirofactsUVDAILY/ZIP/${encodeURIComponent(normalizedZip)}/JSON`;

    try {
        const [hourlyResponse, dailyResponse] = await Promise.all([
            fetch(uvHourlyUrl, { headers: { 'Accept': 'application/json' } }),
            fetch(uvDailyUrl, { headers: { 'Accept': 'application/json' } })
        ]);

        if (!hourlyResponse.ok) {
            throw new Error(`EPA UV hourly request failed: ${hourlyResponse.status}`);
        }

        const hourlyPayload = await hourlyResponse.json();
        const dailyPayload = dailyResponse.ok ? await dailyResponse.json() : [];
        console.log('[API] epaUvHourlyData:', hourlyPayload);
        console.log('[API] epaUvDailyData:', dailyPayload);

        const hourlyRows = Array.isArray(hourlyPayload) ? hourlyPayload : [];

        let current = null;
        let currentTime = null;
        let closestDistance = Number.POSITIVE_INFINITY;

        let peakValue = null;
        let peakTime = null;
        const nowMs = Date.now();

        hourlyRows.forEach(row => {
            const uvValue = Number(row && row.UV_VALUE);
            if (!Number.isFinite(uvValue)) {
                return;
            }

            const normalizedDateTime = normalizeEpaUvDateTime(row && row.DATE_TIME);
            if (normalizedDateTime) {
                const distance = Math.abs(new Date(normalizedDateTime).getTime() - nowMs);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    current = uvValue;
                    currentTime = normalizedDateTime;
                }
            }

            if (peakValue === null || uvValue > peakValue) {
                peakValue = uvValue;
                peakTime = normalizedDateTime;
            }
        });

        if (peakValue === null) {
            const dailyRows = Array.isArray(dailyPayload) ? dailyPayload : [];
            const dailyRow = dailyRows[0] || null;
            const dailyPeak = Number(dailyRow && dailyRow.UV_INDEX);
            if (Number.isFinite(dailyPeak)) {
                peakValue = dailyPeak;
                peakTime = normalizeEpaUvDateTime(dailyRow && dailyRow.DATE);
            }
        }

        if (current === null && peakValue !== null) {
            current = peakValue;
            currentTime = peakTime;
        }

        return {
            current,
            currentTime,
            peakValue,
            peakTime
        };
    } catch (error) {
        console.warn('[API] UV unavailable:', error);
        return null;
    }
}

function pickNumericValue(source, keys) {
    for (const key of keys) {
        const numericValue = Number(source && source[key]);
        if (Number.isFinite(numericValue)) {
            return numericValue;
        }
    }

    return null;
}

function parseUsnoPhaseDateTime(dateValue, timeValue) {
    const dateText = String(dateValue || '').trim();
    if (!dateText) {
        return null;
    }

    const timeText = String(timeValue || '').trim();
    if (timeText) {
        const combined = `${dateText} ${timeText}`;
        const parsedCombined = new Date(combined);
        if (!Number.isNaN(parsedCombined.getTime())) {
            return parsedCombined;
        }
    }

    const parsedDateOnly = new Date(dateText);
    if (!Number.isNaN(parsedDateOnly.getTime())) {
        return parsedDateOnly;
    }

    return null;
}

function parseUsnoPhaseDateTimeFromRow(row) {
    const dateFromText = parseUsnoPhaseDateTime(row?.date, row?.time);
    if (dateFromText instanceof Date && !Number.isNaN(dateFromText.getTime())) {
        return dateFromText;
    }

    const year = Number(row?.year);
    const month = Number(row?.month);
    const day = Number(row?.day);
    const timeText = String(row?.time || '').trim();
    const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})$/);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return null;
    }

    const hour = timeMatch ? Number(timeMatch[1]) : 0;
    const minute = timeMatch ? Number(timeMatch[2]) : 0;
    const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatIsoDateOnly(dateValue) {
    if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
        return '';
    }

    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseHorizonsDateTime(dateText) {
    const normalized = String(dateText || '').trim();
    if (!normalized) {
        return null;
    }

    const parsed = new Date(`${normalized} UTC`);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed;
    }

    return null;
}

function buildHorizonsMoonApiUrl(lat, lon, startDate, stopDate, stepSize = '12h') {
    const params = new URLSearchParams();
    params.set('format', 'json');
    params.set('COMMAND', "'301'");
    params.set('OBJ_DATA', "'NO'");
    params.set('MAKE_EPHEM', "'YES'");
    params.set('EPHEM_TYPE', "'OBSERVER'");
    params.set('CENTER', "'coord@399'");
    params.set('COORD_TYPE', "'GEODETIC'");
    params.set('SITE_COORD', `'${lon},${lat},0'`);
    params.set('START_TIME', `'${startDate}'`);
    params.set('STOP_TIME', `'${stopDate}'`);
    params.set('STEP_SIZE', `'${stepSize}'`);
    params.set('CSV_FORMAT', "'YES'");

    return `https://ssd.jpl.nasa.gov/api/horizons.api?${params.toString()}`;
}

function formatMonthDay(dateValue) {
    if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
        return '--';
    }

    return dateValue.toLocaleDateString([], {
        month: 'short',
        day: 'numeric'
    }).toUpperCase();
}

function formatShortWeekday(dateValue) {
    if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
        return '---';
    }

    return dateValue.toLocaleDateString([], {
        weekday: 'short'
    }).toUpperCase();
}

function getAllergySeasonIconPath(season) {
    const normalized = String(season || '').trim().toLowerCase();
    if (normalized.includes('tree')) {
        return 'allergy icons/tree.webp';
    }
    if (normalized.includes('weed')) {
        return 'allergy icons/weeds.webp';
    }
    if (normalized.includes('grass')) {
        return 'allergy icons/grass.webp';
    }

    return '';
}

function getPollenIndexLevel(indexValue) {
    const numeric = Number(indexValue);
    if (!Number.isFinite(numeric)) {
        return 'low';
    }
    if (numeric < 2.5) {
        return 'low';
    }
    if (numeric < 4.9) {
        return 'low-medium';
    }
    if (numeric < 7.3) {
        return 'medium';
    }
    if (numeric < 9.7) {
        return 'medium-high';
    }

    return 'high';
}

function getPollenCategoryHeightPercent(level) {
    const heightByLevel = {
        'low': 10,
        'low-medium': 30,
        'medium': 50,
        'medium-high': 70,
        'high': 90
    };

    return heightByLevel[level] || 10;
}

function findClosestNasaSnapshot(nasaRows, targetDate) {
    if (!Array.isArray(nasaRows) || nasaRows.length === 0 || !(targetDate instanceof Date) || Number.isNaN(targetDate.getTime())) {
        return null;
    }

    let closestSnapshot = null;
    let closestDistanceMs = Number.POSITIVE_INFINITY;
    const targetMs = targetDate.getTime();

    nasaRows.forEach(snapshot => {
        if (!snapshot || !(snapshot.date instanceof Date) || Number.isNaN(snapshot.date.getTime())) {
            return;
        }

        const distanceMs = Math.abs(snapshot.date.getTime() - targetMs);
        if (distanceMs < closestDistanceMs) {
            closestDistanceMs = distanceMs;
            closestSnapshot = snapshot;
        }
    });

    return closestSnapshot;
}

function normalizeIlluminationPercent(rawValue) {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
        return null;
    }

    return numeric <= 1 ? numeric * 100 : numeric;
}

function computeMoonSizePercent(distanceKm) {
    const closestBoundKm = 363104;
    const farthestBoundKm = 405696;
    const numericDistance = Number(distanceKm);

    if (!Number.isFinite(numericDistance)) {
        return null;
    }

    const ratio = (farthestBoundKm - numericDistance) / (farthestBoundKm - closestBoundKm);
    return Math.min(100, Math.max(0, ratio * 100));
}

function buildHorizonsMoonSnapshots(resultText) {
    const lines = String(resultText || '')
        .split(/\r?\n/)
        .map(line => line.trimEnd());

    const headerLine = lines.find(line => line.trim().startsWith('Date__(UT)__HR:MN,'));
    if (!headerLine) {
        return [];
    }

    const headerColumns = headerLine.split(',').map(value => value.trim());
    const idxDate = headerColumns.indexOf('Date__(UT)__HR:MN');
    const idxIllu = headerColumns.indexOf('Illu%');
    const idxAngDiam = headerColumns.indexOf('Ang-diam');
    const idxDelta = headerColumns.indexOf('delta');

    if (idxDate < 0 || idxIllu < 0 || idxAngDiam < 0 || idxDelta < 0) {
        return [];
    }

    const startIndex = lines.findIndex(line => line.includes('$$SOE'));
    const endIndex = lines.findIndex(line => line.includes('$$EOE'));
    if (startIndex < 0 || endIndex <= startIndex) {
        return [];
    }

    const AU_TO_KM = 149597870.7;

    return lines
        .slice(startIndex + 1, endIndex)
        .map(line => {
            const columns = line.split(',').map(value => value.trim());
            const date = parseHorizonsDateTime(columns[idxDate]);
            const illuminationPercent = normalizeIlluminationPercent(columns[idxIllu]);
            const apparentSizeArcMin = Number(columns[idxAngDiam]);
            const distanceAu = Number(columns[idxDelta]);
            const distanceKm = Number.isFinite(distanceAu) ? distanceAu * AU_TO_KM : null;

            return {
                date,
                illuminationPercent,
                distanceKm,
                apparentSizeArcMin: Number.isFinite(apparentSizeArcMin) ? apparentSizeArcMin : null
            };
        })
        .filter(snapshot => snapshot.date instanceof Date && !Number.isNaN(snapshot.date.getTime()));
}

function isWaningFromSnapshots(snapshots, referenceDate) {
    if (!Array.isArray(snapshots) || snapshots.length < 2 || !(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) {
        return false;
    }

    const sortedSnapshots = [...snapshots]
        .filter(snapshot => snapshot && snapshot.date instanceof Date && Number.isFinite(snapshot.illuminationPercent))
        .sort((a, b) => a.date - b.date);

    if (sortedSnapshots.length < 2) {
        return false;
    }

    const nowSnapshot = findClosestNasaSnapshot(sortedSnapshots, referenceDate);
    if (!nowSnapshot) {
        return false;
    }

    const currentIndex = sortedSnapshots.findIndex(snapshot => snapshot.date.getTime() === nowSnapshot.date.getTime());
    if (currentIndex < 0 || currentIndex >= sortedSnapshots.length - 1) {
        return false;
    }

    const nextSnapshot = sortedSnapshots[currentIndex + 1];
    return Number(nextSnapshot.illuminationPercent) < Number(nowSnapshot.illuminationPercent);
}

async function fetchJsonWithCorsFallback(url, apiLabel) {
    // Build the proxy URL for each candidate service.
    function buildProxyUrl(service, targetUrl) {
        const encoded = encodeURIComponent(targetUrl);
        switch (service) {
            case 'allorigins':  return `https://api.allorigins.win/raw?url=${encoded}`;
            case 'corsproxy':   return `https://corsproxy.io/?${encoded}`;
            case 'codetabs':    return `https://api.codetabs.com/v1/proxy?quest=${encoded}`;
            case 'thingproxy':  return `https://thingproxy.freeboard.io/fetch/${targetUrl}`;
            default:            return null;
        }
    }

    // Attempt a direct fetch first (works when the server sends CORS headers).
    let directError = null;
    try {
        const directResponse = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

        if (!directResponse.ok) {
            throw new Error(`${apiLabel} direct request failed: ${directResponse.status}`);
        }

        return await directResponse.json();
    } catch (err) {
        directError = err;
        console.warn(`[CORS] ${apiLabel} direct fetch failed, trying proxies…`, err.message);
    }

    const proxyServices = ['allorigins', 'corsproxy', 'codetabs', 'thingproxy'];

    for (const service of proxyServices) {
        const proxyUrl = buildProxyUrl(service, url);
        if (!proxyUrl) {
            continue;
        }

        try {
            const proxyResponse = await fetch(proxyUrl, {
                headers: { 'Accept': 'application/json' }
            });

            if (!proxyResponse.ok) {
                console.warn(`[CORS] proxy "${service}" returned ${proxyResponse.status} for ${apiLabel}`);
                continue;
            }

            const text = await proxyResponse.text();
            if (!text || !text.trim().startsWith('{') && !text.trim().startsWith('[')) {
                console.warn(`[CORS] proxy "${service}" returned non-JSON body for ${apiLabel}`);
                continue;
            }

            console.log(`[CORS] ${apiLabel} succeeded via proxy "${service}"`);
            return JSON.parse(text);
        } catch (proxyError) {
            console.warn(`[CORS] proxy "${service}" threw for ${apiLabel}:`, proxyError.message);
        }
    }

    throw directError;
}

async function fetchLunarData(lat, lon) {
    const now = new Date();
    const nowDateIso = now.toISOString().slice(0, 10);
    const horizonsStartDate = formatIsoDateOnly(new Date(now.getTime() - (24 * 60 * 60 * 1000)));
    const horizonsStopDate = formatIsoDateOnly(new Date(now.getTime() + (400 * 24 * 60 * 60 * 1000)));
    const nasaHorizonsUrl = buildHorizonsMoonApiUrl(lat, lon, horizonsStartDate, horizonsStopDate, '12h');
    const usnoUrl = `https://aa.usno.navy.mil/api/moon/phases/date?date=${encodeURIComponent(nowDateIso)}&nump=60`;

    try {
        const [nasaResult, usnoResult] = await Promise.allSettled([
            fetchJsonWithCorsFallback(nasaHorizonsUrl, 'NASA Horizons'),
            fetchJsonWithCorsFallback(usnoUrl, 'USNO phases')
        ]);

        let nasaSnapshots = [];
        if (nasaResult.status === 'fulfilled') {
            const nasaPayload = nasaResult.value;
            console.log('[API] nasaHorizonsMoonData:', nasaPayload);
            nasaSnapshots = buildHorizonsMoonSnapshots(nasaPayload?.result);
        } else {
            console.warn('[API] NASA moon unavailable:', nasaResult.reason);
        }

        let phaseRows = [];
        if (usnoResult.status === 'fulfilled') {
            const usnoPayload = usnoResult.value;
            console.log('[API] usnoMoonPhases:', usnoPayload);
            phaseRows = Array.isArray(usnoPayload?.phasedata) ? usnoPayload.phasedata : [];
        } else {
            console.warn('[API] USNO moon unavailable:', usnoResult.reason);
        }

        const nowSnapshot = findClosestNasaSnapshot(nasaSnapshots, now);
        const currentIlluminationPercent = nowSnapshot && Number.isFinite(nowSnapshot.illuminationPercent)
            ? nowSnapshot.illuminationPercent
            : null;
        const currentDistanceKm = nowSnapshot && Number.isFinite(nowSnapshot.distanceKm)
            ? nowSnapshot.distanceKm
            : null;
        const currentSizePercent = computeMoonSizePercent(currentDistanceKm);
        const futurePhases = phaseRows
            .map(row => {
                const phaseName = String(row?.phase || '').trim();
                const phaseDate = parseUsnoPhaseDateTimeFromRow(row);
                return { phaseName, phaseDate };
            })
            .filter(entry => entry.phaseDate instanceof Date && !Number.isNaN(entry.phaseDate.getTime()) && entry.phaseDate.getTime() >= now.getTime())
            .sort((a, b) => a.phaseDate - b.phaseDate);

        const majorPhases = futurePhases.filter(entry => {
            const name = entry.phaseName.toLowerCase();
            return name.includes('new') || name.includes('full');
        });
        const nextMajorPhase = majorPhases.length > 0 ? majorPhases[0] : (futurePhases.length > 0 ? futurePhases[0] : null);
        const nextMajorPhaseName = nextMajorPhase && nextMajorPhase.phaseName
            ? String(nextMajorPhase.phaseName).toUpperCase()
            : '--';
        const nextMajorPhaseDateText = nextMajorPhase && nextMajorPhase.phaseDate
            ? formatMonthDay(nextMajorPhase.phaseDate)
            : '--';

        const nextFullMoon = futurePhases.find(entry => entry.phaseName.toLowerCase().includes('full')) || null;

        const futureFullMoons = futurePhases.filter(entry => entry.phaseName.toLowerCase().includes('full'));
        let nextSuperMoonText = '--';

        if (futureFullMoons.length > 0 && nasaSnapshots.length > 0) {
            const rankedByDistance = futureFullMoons
                .map(fullMoon => {
                    const snapshot = findClosestNasaSnapshot(nasaSnapshots, fullMoon.phaseDate);
                    return {
                        phaseDate: fullMoon.phaseDate,
                        distanceKm: snapshot && Number.isFinite(snapshot.distanceKm) ? snapshot.distanceKm : null
                    };
                })
                .filter(entry => Number.isFinite(entry.distanceKm))
                .sort((a, b) => a.distanceKm - b.distanceKm);

            if (rankedByDistance.length > 0) {
                nextSuperMoonText = formatMonthDay(rankedByDistance[0].phaseDate);
            } else if (nextFullMoon) {
                nextSuperMoonText = formatMonthDay(nextFullMoon.phaseDate);
            }
        } else if (nextFullMoon) {
            nextSuperMoonText = formatMonthDay(nextFullMoon.phaseDate);
        }

        return {
            currentIlluminationPercent,
            currentSizePercent,
            nextMajorPhaseName,
            nextMajorPhaseDateText,
            nextSuperMoonText
        };
    } catch (error) {
        console.warn('[API] Lunar data unavailable:', error);
        return null;
    }
}

/* ===========================================
   WEATHER.GOV API: Fetch forecast and alerts
   =========================================== */
async function fetchWeatherGovData(lat, lon) {
    // Get NWS point metadata and forecast URL
    const pointsURL = `https://api.weather.gov/points/${lat},${lon}`;
    const pointsResponse = await fetch(pointsURL, {
        headers: { 'Accept': 'application/geo+json' }
    });
    if (!pointsResponse.ok) {
        const text = await pointsResponse.text();
        throw new Error(`Points request failed: ${pointsResponse.status} ${text}`);
    }
    const pointsData = await pointsResponse.json();
    // Debug: inspect point metadata and endpoint URLs from weather.gov
    console.log('[API] pointsData:', pointsData);

    // Get hourly forecast instead of station observations
    const hourlyURL = pointsData.properties.forecastHourly;
    if (!hourlyURL) {
        throw new Error('No hourly forecast URL returned from weather.gov');
    }

    const hourlyResponse = await fetch(hourlyURL, {
        headers: { 'Accept': 'application/geo+json' }
    });
    if (!hourlyResponse.ok) {
        const text = await hourlyResponse.text();
        throw new Error(`Hourly forecast request failed: ${hourlyResponse.status} ${text}`);
    }
    const hourlyData = await hourlyResponse.json();
    // Debug: inspect hourly forecast payload
    console.log('[API] hourlyData:', hourlyData);

    // Get METAR observations
    const observationURL = pointsData.properties.observationStations;
    if (!observationURL) {
        throw new Error('No observation stations returned from weather.gov');
    }

    const observationResponse = await fetch(observationURL, {
        headers: { 'Accept': 'application/geo+json' }
    });
    if (!observationResponse.ok) {
        const text = await observationResponse.text();
        throw new Error(`Observation request failed: ${observationResponse.status} ${text}`);
    }
    const observationData = await observationResponse.json();
    // Debug: inspect observation stations payload
    console.log('[API] observationData:', observationData);
    const stationCode = observationData.features[0].properties.stationIdentifier;

    const metarURL = `https://api.weather.gov/stations/${stationCode}/observations/latest`;
    const metarResponse = await fetch(metarURL, {
        headers: { 'Accept': 'application/geo+json' }
    });
    if (!metarResponse.ok) {
        const text = await metarResponse.text();
        throw new Error(`METAR observations request failed: ${metarResponse.status} ${text}`);
    }
    const metarData = await metarResponse.json();
    // Debug: inspect latest station observation payload
    console.log('[API] metarData:', metarData);

    const forecastURL = pointsData.properties.forecast;
    if (!forecastURL) {
        throw new Error('No forecast URL returned from weather.gov');
    }

    const forecastResponse = await fetch(forecastURL, {
        headers: { 'Accept': 'application/geo+json' }
    });
    if (!forecastResponse.ok) {
        const text = await forecastResponse.text();
        throw new Error(`Forecast request failed: ${forecastResponse.status} ${text}`);
    }
    const forecastData = await forecastResponse.json();
    // Debug: inspect daily forecast payload
    console.log('[API] forecastData:', forecastData);

    // Get zone ID for alerts
    const zoneUrl = pointsData.properties.forecastZone;
    if (!zoneUrl) {
        throw new Error('No forecast zone ID returned from weather.gov');
    }

    // Extract last 6 characters from the zone URL
    const zoneId = zoneUrl.slice(-6);

    // Use zone-specific alerts endpoint
    const alertsURL = `https://api.weather.gov/alerts/active/zone/${zoneId}`;
    const alertsResponse = await fetch(alertsURL, {
        headers: { 'Accept': 'application/geo+json' }
    });
    if (!alertsResponse.ok) {
        const text = await alertsResponse.text();
        throw new Error(`Alerts request failed: ${alertsResponse.status} ${text}`);
    }
    const alertsData = await alertsResponse.json();
    // Debug: inspect active alerts payload
    console.log('[API] alertsData:', alertsData);

    return { forecastData, alertsData, hourlyData, metarData, pointsData };
}

/* ===========================================
   DATA PROCESSING: Extract weather values
   =========================================== */
function processWeatherData(forecastData, alertsData, hourlyData, metarData, airNowData, sunTimesData, uvData, lunarData, pollenData, pollenExtendedData, hydrologicalData, marineData, radarData) {
    const currentHourlyPeriod = hourlyData.properties.periods[0];
    const currentPeriod = forecastData.properties.periods[0];
    const firstForecastPeriod = forecastData.properties.periods[0] || null;
    const nextPeriod = forecastData.properties.periods[1] || currentPeriod;
    const weeklyForecast = buildSevenDayForecast(forecastData.properties.periods);
    const hourlyForecast = buildHourlyForecast(hourlyData.properties.periods);

    /*Hourly data*/
    const temperatureCurrent = currentHourlyPeriod.temperature;
    const humidityCurrent = currentHourlyPeriod.relativeHumidity.value;
    const conditionCurrent = summarizeCondition(currentHourlyPeriod.shortForecast, 3);
    const windSpeedCurrent = currentHourlyPeriod.windSpeed;
    const windDirectionCurrent = currentHourlyPeriod.windDirection;
    const windDisplayCurrent = formatWindDisplay(windSpeedCurrent, windDirectionCurrent, 'CALM');
    const dewpointCurrent = currentHourlyPeriod.dewpoint ? {
        value: Math.round(((currentHourlyPeriod.dewpoint.value * 9/5) + 32) * 100) / 100, // C to F, round to 2 decimal places
        unit: 'F'
    } : null;

    /*METAR data (use only for data not provided by hourly forecast)*/
    // Convert units: pressure (Pa to millibars), wind (km/h to mph), visibility (m to miles)
    const pressureCurrent = metarData.properties.barometricPressure ? {
        value: Math.round(metarData.properties.barometricPressure.value / 100), // Pa to millibars (whole number)
        unit: 'millibars'
    } : null;

    const windGustValueCurrent = metarData.properties.windGust
        ? Math.round((metarData.properties.windGust.value * 0.621371) * 10) / 10
        : null;
    const windGustDisplayCurrent = formatWindDisplay(
        windGustValueCurrent,
        windDirectionCurrent,
        'NONE'
    );

    const visibilityCurrent = metarData.properties.visibility ? {
        value: Math.round((metarData.properties.visibility.value * 0.000621371) * 100) / 100, // m to miles
        unit: 'miles'
    } : null;

    /*half day forecast data*/
    const temperatureHigh = currentPeriod.isDaytime ? currentPeriod.temperature : nextPeriod.temperature;
    const temperatureLow = currentPeriod.isDaytime ? nextPeriod.temperature : currentPeriod.temperature;

    // Process alerts
    const hasAlerts = alertsData.features && alertsData.features.length > 0;
    const activeAlerts = hasAlerts ? alertsData.features.map(alert => alert.properties.headline).join('; ') : 'None';

    const heatIndexCurrent = computeHeatIndex(temperatureCurrent, humidityCurrent);
    const detailedForecastSegments = build36HourSegments(forecastData.properties.periods);
    const airDayLabel = new Date().toLocaleDateString([], { weekday: 'long' }).toUpperCase();
    const airAqi = airNowData && Number.isFinite(Number(airNowData.aqi)) ? Number(airNowData.aqi) : null;
    const airPrimaryPollutant = airNowData && airNowData.primaryPollutant ? airNowData.primaryPollutant : 'N/A';
    const sunriseTime = formatSunTime(sunTimesData && sunTimesData.sunrise ? sunTimesData.sunrise : null);
    const sunsetTime = formatSunTime(sunTimesData && sunTimesData.sunset ? sunTimesData.sunset : null);
    const sunriseIso = sunTimesData && sunTimesData.sunrise ? String(sunTimesData.sunrise) : null;
    const sunsetIso = sunTimesData && sunTimesData.sunset ? String(sunTimesData.sunset) : null;
    const uvCurrent = uvData && Number.isFinite(Number(uvData.current)) ? Number(uvData.current) : null;
    const uvCurrentTime = formatHourOnly(uvData && uvData.currentTime ? uvData.currentTime : null);
    const uvPeakValue = uvData && Number.isFinite(Number(uvData.peakValue)) ? Number(uvData.peakValue) : null;
    const uvPeakTime = formatHourOnly(uvData && uvData.peakTime ? uvData.peakTime : null);
    const moonIlluminationPercent = lunarData && Number.isFinite(Number(lunarData.currentIlluminationPercent))
        ? Number(lunarData.currentIlluminationPercent)
        : null;
    const moonCurrentSizePercent = lunarData && Number.isFinite(Number(lunarData.currentSizePercent))
        ? Number(lunarData.currentSizePercent)
        : null;
    const moonNextPhaseName = lunarData && lunarData.nextMajorPhaseName
        ? String(lunarData.nextMajorPhaseName)
        : '--';
    const moonNextPhaseDate = lunarData && lunarData.nextMajorPhaseDateText
        ? String(lunarData.nextMajorPhaseDateText)
        : '--';
    const moonNextSuperMoon = lunarData && lunarData.nextSuperMoonText
        ? String(lunarData.nextSuperMoonText)
        : '--';
    const allergySeason = pollenData && pollenData.Season
        ? String(pollenData.Season)
        : '--';
    const allergySeasonIconPath = getAllergySeasonIconPath(allergySeason);
    const allergyPeriodsRaw = Array.isArray(pollenExtendedData?.Location?.periods)
        ? pollenExtendedData.Location.periods
        : [];
    const allergyPeriods = allergyPeriodsRaw.slice(0, 5).map(period => {
        const dateValue = new Date(period?.Period);
        const indexValue = Number(period?.Index);
        const level = getPollenIndexLevel(indexValue);

        return {
            dayLabel: formatShortWeekday(dateValue),
            valueText: Number.isFinite(indexValue) ? indexValue.toFixed(1) : '--',
            barHeightPercent: getPollenCategoryHeightPercent(level),
            levelClass: `allergy-bar-${level}`
        };
    });
    const winterSummary = buildWinterForecastSummary(
        hourlyData?.properties?.periods,
        forecastData?.properties?.periods,
        metarData,
        temperatureLow
    );

    return {
        temperatureCurrent,
        temperatureHigh,
        temperatureLow,
        weeklyForecast,
        hourlyForecast,
        conditionCurrent,
        windDisplayCurrent,
        windGustDisplayCurrent,
        humidityCurrent,
        dewpointCurrent,
        pressureCurrent,
        visibilityCurrent,
        heatIndexCurrent,
        detailedForecastSegments,
        sunriseTime,
        sunsetTime,
        sunriseIso,
        sunsetIso,
        uvCurrent,
        uvCurrentTime,
        uvPeakValue,
        uvPeakTime,
        moonIlluminationPercent,
        moonCurrentSizePercent,
        moonNextPhaseName,
        moonNextPhaseDate,
        moonNextSuperMoon,
        allergySeason,
        allergySeasonIconPath,
        allergyPeriods,
        hydrologicalGauges: Array.isArray(hydrologicalData) ? hydrologicalData : [],
        marineSurfZones: Array.isArray(marineData) ? marineData : [],
        radarLoopGifUrl: String(radarData?.radarLoopGifUrl || '').trim() || null,
        radarStationId: String(radarData?.stationId || '').trim() || null,
        airDayLabel,
        airAqi,
        airPrimaryPollutant,
        winterPrimaryLabel: winterSummary.winterPrimaryLabel,
        winterPrimaryValue: winterSummary.winterPrimaryValue,
        winterPrimaryStartTime: winterSummary.winterPrimaryStartTime,
        winterSnowDepthText: winterSummary.winterSnowDepthText,
        winterIceAccumulationText: winterSummary.winterIceAccumulationText,
        winterWindGustsText: winterSummary.winterWindGustsText,
        winterTodayLowText: winterSummary.winterTodayLowText,
        alerts: activeAlerts
    };
}

function getLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildSevenDayForecast(periods) {
    if (!Array.isArray(periods) || periods.length === 0) {
        return [];
    }

    const dayBuckets = new Map();

    periods.forEach(period => {
        if (!period || !period.startTime) {
            return;
        }

        const startDate = new Date(period.startTime);
        if (Number.isNaN(startDate.getTime())) {
            return;
        }

        const dateKey = getLocalDateKey(startDate);

        if (!dayBuckets.has(dateKey)) {
            dayBuckets.set(dateKey, {
                date: startDate,
                high: null,
                low: null,
                condition: '',
                dayCondition: ''
            });
        }

        const bucket = dayBuckets.get(dateKey);

        if (typeof period.temperature === 'number') {
            if (period.isDaytime) {
                bucket.high = bucket.high === null ? period.temperature : Math.max(bucket.high, period.temperature);
            } else {
                bucket.low = bucket.low === null ? period.temperature : Math.min(bucket.low, period.temperature);
            }
        }

        if (period.shortForecast && !bucket.condition) {
            bucket.condition = period.shortForecast;
        }

        if (period.isDaytime && period.shortForecast && !bucket.dayCondition) {
            bucket.dayCondition = period.shortForecast;
        }
    });

    return Array.from(dayBuckets.values())
        .sort((a, b) => a.date - b.date)
        .slice(0, 7)
        .map(day => {
            const displayCondition = summarizeCondition(day.dayCondition || day.condition || '', 3);
            return {
                label: day.date.toLocaleDateString([], { weekday: 'short' }).toUpperCase(),
                condition: displayCondition,
                high: day.high,
                low: day.low,
                iconPath: getConditionIconPath(displayCondition)
            };
        });
}

function formatHourlyLabel(date) {
    const label = date.toLocaleTimeString([], { hour: 'numeric', hour12: true });
    return label.replace(' ', '').toUpperCase();
}

function buildHourlyForecast(periods) {
    if (!Array.isArray(periods) || periods.length === 0) {
        return [];
    }

    return periods
        .slice(0, 7)
        .map(period => {
            const startDate = new Date(period.startTime);
            const condition = summarizeCondition(period.shortForecast || '', 3);
            return {
                label: Number.isNaN(startDate.getTime()) ? '---' : formatHourlyLabel(startDate),
                condition,
                temperature: typeof period.temperature === 'number' ? period.temperature : null,
                iconPath: getConditionIconPath(condition)
            };
        });
}

function computeHeatIndex(tempF, humidity) {
    if (tempF === null || humidity === null) return null;
    if (tempF < 80 || humidity < 40) return null;
    const t = tempF;
    const r = humidity;
    const hi = -42.379 + 2.04901523 * t + 10.14333127 * r - 0.22475541 * t * r - 0.00683783 * t * t - 0.05481717 * r * r + 0.00122874 * t * t * r + 0.00085282 * t * r * r - 0.00000199 * t * t * r * r;
    return Math.round(hi * 100) / 100;
}

function normalizeWindDirection(directionRaw) {
    if (!directionRaw) {
        return '';
    }

    const direction = String(directionRaw).trim().toUpperCase();
    if (!direction) {
        return '';
    }

    if (/^[NSEW]{1,3}$/.test(direction)) {
        return direction;
    }

    if (direction === 'VARIABLE') {
        return 'VRB';
    }

    const normalized = direction.replace(/[-\s]+/g, ' ').trim();
    const directionMap = {
        'NORTH': 'N',
        'NORTH NORTHEAST': 'NNE',
        'NORTHEAST': 'NE',
        'EAST NORTHEAST': 'ENE',
        'EAST': 'E',
        'EAST SOUTHEAST': 'ESE',
        'SOUTHEAST': 'SE',
        'SOUTH SOUTHEAST': 'SSE',
        'SOUTH': 'S',
        'SOUTH SOUTHWEST': 'SSW',
        'SOUTHWEST': 'SW',
        'WEST SOUTHWEST': 'WSW',
        'WEST': 'W',
        'WEST NORTHWEST': 'WNW',
        'NORTHWEST': 'NW',
        'NORTH NORTHWEST': 'NNW'
    };

    if (directionMap[normalized]) {
        return directionMap[normalized];
    }

    const initials = normalized
        .split(' ')
        .map(word => word[0])
        .join('');

    return /^[NSEW]{1,3}$/.test(initials) ? initials : '';
}

function formatWindDisplay(windSpeedRaw, windDirectionRaw, calmLabel = 'NONE') {
    if (windSpeedRaw === null || windSpeedRaw === undefined) {
        return calmLabel;
    }

    const speedText = String(windSpeedRaw).trim().toUpperCase();
    if (!speedText || speedText.includes('CALM')) {
        return calmLabel;
    }

    const numericMatch = speedText.match(/\d+(?:\.\d+)?/);
    if (!numericMatch) {
        return calmLabel;
    }

    const speedValue = Number(numericMatch[0]);
    if (!Number.isFinite(speedValue) || speedValue === 0) {
        return calmLabel;
    }

    const direction = normalizeWindDirection(windDirectionRaw);
    const speed = Number.isInteger(speedValue) ? String(speedValue) : speedValue.toFixed(1);

    return direction ? `${direction} ${speed}` : speed;
}

function pickRandomArrayItem(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return null;
    }

    const randomIndex = Math.floor(Math.random() * items.length);
    return items[randomIndex] || null;
}

function clearIntroSceneSequence() {
    introSequenceTimeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
    introSequenceTimeoutIds = [];

    const introPanel = document.getElementById('intro-panel');
    if (!introPanel) {
        return;
    }

    introPanel.classList.remove('text-fade');
    introPanel.classList.remove('brand-visible');
    introPanel.classList.remove('brand-fade-out');
    const introSteps = introPanel.querySelectorAll('.intro-step');
    introSteps.forEach(step => step.classList.remove('is-visible'));
}

function getIntroGreeting(sunriseIso = null, sunsetIso = null) {
    const segment = getCurrentTimeSegment(sunriseIso, sunsetIso);
    if (segment === 'morning') {
        return 'Good Morning';
    }

    if (segment === 'day') {
        return 'Good Afternoon';
    }

    if (segment === 'sunset') {
        return 'Good Evening';
    }

    return 'Good Night';
}

function runIntroSceneSequence() {
    const introPanel = document.getElementById('intro-panel');
    if (!introPanel || currentScene !== 'scene-intro') {
        return;
    }

    clearIntroSceneSequence();

    const greetingEl = document.getElementById('intro-greeting');
    const sentenceEl = document.getElementById('intro-sentence');
    const nowForEl = document.getElementById('intro-now-for');

    if (greetingEl) {
        greetingEl.textContent = getIntroGreeting(latestSunriseIso, latestSunsetIso);
    }

    if (sentenceEl) {
        sentenceEl.textContent = pickRandomArrayItem(INTRO_SENTENCES) || INTRO_SENTENCES[0];
    }

    const revealStep = (element, delayMs) => {
        if (!element) {
            return;
        }

        const timeoutId = setTimeout(() => {
            element.classList.add('is-visible');
        }, delayMs);

        introSequenceTimeoutIds.push(timeoutId);
    };

    revealStep(greetingEl, 0);
    revealStep(sentenceEl, 3000);
    revealStep(nowForEl, 6000);

    const crossFadeTimeoutId = setTimeout(() => {
        introPanel.classList.add('text-fade');
        introPanel.classList.add('brand-visible');
    }, 9000);
    introSequenceTimeoutIds.push(crossFadeTimeoutId);

    const brandFadeOutTimeoutId = setTimeout(() => {
        introPanel.classList.add('brand-fade-out');
    }, 14000);
    introSequenceTimeoutIds.push(brandFadeOutTimeoutId);
}

function clearBackgroundMusicStartTimeout() {
    if (pendingBackgroundStartTimeoutId !== null) {
        clearTimeout(pendingBackgroundStartTimeoutId);
        pendingBackgroundStartTimeoutId = null;
    }
}

function clearBackgroundMusicFadeInterval() {
    if (pendingBackgroundFadeIntervalId !== null) {
        clearInterval(pendingBackgroundFadeIntervalId);
        pendingBackgroundFadeIntervalId = null;
    }
}

function stopWelcomeMusic() {
    if (!welcomeMusicAudio) {
        return;
    }

    welcomeMusicAudio.pause();
    welcomeMusicAudio.currentTime = 0;
}

function getAlertMusicMode(alertsText) {
    const normalized = String(alertsText || '').toLowerCase();
    if (!normalized || normalized === 'none') {
        return 'normal';
    }

    if (normalized.includes('warning')) {
        return 'warning';
    }

    if (normalized.includes('watch')) {
        return 'watch';
    }

    return 'normal';
}

function chooseBackgroundTrackForAlerts(alertsText) {
    const previousMode = selectedAlertMusicMode;
    const previousTrack = selectedBackgroundMusicTrack;
    const mode = getAlertMusicMode(alertsText);
    const modeChanged = previousMode !== mode;
    const modeTracks = getTracksForMode(mode);
    const selectedTrack = modeChanged || !selectedBackgroundMusicTrack
        ? (pickRandomArrayItem(modeTracks) || pickRandomArrayItem(getTracksForMode('normal')) || '')
        : selectedBackgroundMusicTrack;

    selectedAlertMusicMode = mode;
    selectedBackgroundMusicTrack = selectedTrack;

    const trackChanged = previousTrack !== selectedBackgroundMusicTrack;
    if (!trackChanged && !modeChanged) {
        return;
    }

    // Switch background music as soon as alert mode changes, outside welcome sequence.
    if (hasAudioGesture && !isWelcomeMusicSequenceActive) {
        startBackgroundMusicFromSelectedTrack({ forceTransition: true });
    }
}

function ensureBackgroundMusicAudio() {
    if (backgroundMusicAudio) {
        return backgroundMusicAudio;
    }

    const audio = new Audio();
    audio.preload = 'auto';
    audio.loop = true;
    audio.volume = 0;
    audio.muted = isAudioMuted;
    backgroundMusicAudio = audio;
    return backgroundMusicAudio;
}

function ensureWelcomeMusicAudio() {
    if (welcomeMusicAudio) {
        return welcomeMusicAudio;
    }

    const audio = new Audio();
    audio.preload = 'auto';
    audio.loop = false;
    audio.volume = 0;
    audio.muted = isAudioMuted;
    welcomeMusicAudio = audio;
    return welcomeMusicAudio;
}

function fadeAudioVolume(audio, startVolume, endVolume, durationMs, stepMs = MUSIC_BACKGROUND_FADE_STEP_MS) {
    if (!audio) {
        return Promise.resolve();
    }

    const safeStart = Number.isFinite(Number(startVolume)) ? Number(startVolume) : audio.volume;
    const safeEnd = Number.isFinite(Number(endVolume)) ? Number(endVolume) : audio.volume;
    const safeDuration = Math.max(0, Number(durationMs) || 0);

    clearBackgroundMusicFadeInterval();
    audio.volume = Math.min(1, Math.max(0, safeStart));

    if (safeDuration === 0 || Math.abs(safeStart - safeEnd) < 0.001) {
        audio.volume = Math.min(1, Math.max(0, safeEnd));
        return Promise.resolve();
    }

    const totalSteps = Math.max(1, Math.round(safeDuration / stepMs));
    let step = 0;

    return new Promise(resolve => {
        pendingBackgroundFadeIntervalId = setInterval(() => {
            step += 1;
            const progress = Math.min(1, step / totalSteps);
            const nextVolume = safeStart + ((safeEnd - safeStart) * progress);
            audio.volume = Math.min(1, Math.max(0, nextVolume));

            if (progress >= 1) {
                clearBackgroundMusicFadeInterval();
                resolve();
            }
        }, stepMs);
    });
}

async function startBackgroundMusicFromSelectedTrack(options = {}) {
    if (isAudioMuted) {
        return;
    }

    const forceTransition = Boolean(options?.forceTransition);
    if (!hasAudioGesture) {
        return;
    }

    if (!selectedBackgroundMusicTrack) {
        return;
    }

    const audio = ensureBackgroundMusicAudio();
    const nextTrackUrl = new URL(selectedBackgroundMusicTrack, window.location.href).href;
    const srcChanged = audio.src !== nextTrackUrl;

    if (audio.paused === false && (srcChanged || forceTransition)) {
        await fadeAudioVolume(audio, audio.volume, 0, MUSIC_TRACK_CROSSFADE_MS);
        audio.pause();
        audio.currentTime = 0;
    }

    if (srcChanged) {
        audio.src = selectedBackgroundMusicTrack;
    }

    try {
        if (audio.paused || srcChanged || forceTransition) {
            audio.currentTime = 0;
            await audio.play();
        }

        await fadeAudioVolume(audio, audio.volume, MUSIC_BACKGROUND_VOLUME_TARGET, MUSIC_TRACK_CROSSFADE_MS);
    } catch (error) {
        console.warn('[AUDIO] Background music play was blocked:', error);
    }
}

function scheduleBackgroundMusicStart() {
    clearBackgroundMusicStartTimeout();
    isWelcomeMusicSequenceActive = false;
    startBackgroundMusicFromSelectedTrack({ forceTransition: true });
}

function getHourKey(dateValue = new Date()) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    return `${year}-${month}-${day}-${hour}`;
}

function shouldPlayWelcomeMusicNow(referenceDate = new Date()) {
    if (currentScene !== 'scene-intro') {
        return false;
    }

    const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    const hourKey = getHourKey(now);
    if (!hourKey) {
        return false;
    }

    if (!hasPlayedInitialWelcomeMusic) {
        hasPlayedInitialWelcomeMusic = true;
        lastWelcomeMusicHourKey = hourKey;
        return true;
    }

    if (now.getMinutes() !== 0) {
        return false;
    }

    if (lastWelcomeMusicHourKey === hourKey) {
        return false;
    }

    lastWelcomeMusicHourKey = hourKey;
    return true;
}

async function startWelcomeMusicSequence() {
    if (isAudioMuted) {
        return;
    }

    if (!hasAudioGesture || isWelcomeMusicSequenceActive) {
        return;
    }

    if (!shouldPlayWelcomeMusicNow()) {
        return;
    }

    const welcomeAudio = ensureWelcomeMusicAudio();
    const welcomeTrack = pickRandomArrayItem(getTracksForMode('welcome')) || '';
    const backgroundAudio = ensureBackgroundMusicAudio();
    isWelcomeMusicSequenceActive = true;

    clearBackgroundMusicStartTimeout();
    clearBackgroundMusicFadeInterval();
    if (!welcomeAudio || !welcomeTrack) {
        scheduleBackgroundMusicStart();
        return;
    }

    if (backgroundAudio && !backgroundAudio.paused) {
        await fadeAudioVolume(backgroundAudio, backgroundAudio.volume, 0, MUSIC_TRACK_CROSSFADE_MS);
        backgroundAudio.pause();
        backgroundAudio.currentTime = 0;
    }

    stopWelcomeMusic();
    welcomeAudio.src = welcomeTrack;
    welcomeAudio.volume = 0;
    welcomeAudio.currentTime = 0;

    welcomeAudio.onended = () => {
        scheduleBackgroundMusicStart();
    };

    welcomeAudio.play()
        .then(() => {
            fadeAudioVolume(welcomeAudio, welcomeAudio.volume, 1, MUSIC_TRACK_CROSSFADE_MS);
        })
        .catch(error => {
            console.warn('[AUDIO] Welcome music play was blocked:', error);
            scheduleBackgroundMusicStart();
        });
}

function registerAudioGestureUnlock() {
    const unlock = () => {
        hasAudioGesture = true;
        if (currentScene === 'scene-intro') {
            startWelcomeMusicSequence();
            return;
        }

        if (selectedBackgroundMusicTrack) {
            startBackgroundMusicFromSelectedTrack();
        }
    };

    ['pointerdown', 'keydown', 'touchstart'].forEach(eventName => {
        document.addEventListener(eventName, unlock, { once: true, passive: true });
    });
}

function getWindDirectionCardinal(directionDegrees, fallbackCardinal = null) {
    const fallback = String(fallbackCardinal || '').trim().toUpperCase();
    if (fallback) {
        return fallback;
    }

    const degrees = toFiniteNumber(directionDegrees);
    if (degrees === null) {
        return null;
    }

    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const normalizedDegrees = ((degrees % 360) + 360) % 360;
    const directionIndex = Math.round(normalizedDegrees / 22.5) % 16;
    return directions[directionIndex] || null;
}

function formatMarineNumber(value, unit, fractionDigits = 1) {
    const numeric = toFiniteNumber(value);
    if (numeric === null) {
        return '--';
    }

    return `${numeric.toFixed(fractionDigits)} ${unit}`;
}

function sanitizeMarineDisplayText(value) {
    const text = String(value || '')
        .replace(/\*/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\.$/, '');

    return text || '';
}

function parseCoopsUtcDate(rawValue) {
    const timestampText = sanitizeMarineDisplayText(rawValue);
    if (!timestampText) {
        return null;
    }

    const parsed = new Date(`${timestampText.replace(' ', 'T')}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatMarineTime(rawValue) {
    const date = parseCoopsUtcDate(rawValue);
    if (!date) {
        return '--:--';
    }

    return date.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
    }).toUpperCase();
}

function getNextMarineTideEvent(gaugeData) {
    const highDate = parseCoopsUtcDate(gaugeData?.nextHighTideTime);
    const lowDate = parseCoopsUtcDate(gaugeData?.nextLowTideTime);

    if (highDate && lowDate) {
        return highDate.getTime() <= lowDate.getTime()
            ? { label: 'HIGH', time: gaugeData.nextHighTideTime }
            : { label: 'LOW', time: gaugeData.nextLowTideTime };
    }

    if (highDate) {
        return { label: 'HIGH', time: gaugeData?.nextHighTideTime };
    }

    if (lowDate) {
        return { label: 'LOW', time: gaugeData?.nextLowTideTime };
    }

    return null;
}

function formatMarineMagnitude(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return null;
    }

    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function formatSurfWindText(rawText) {
    const text = sanitizeMarineDisplayText(rawText);
    if (!text) {
        return 'NO DATA';
    }

    const directionBeforeWinds = text.match(/^([A-Za-z\s-]+?)\s+winds?\b/i);
    const directionFromClause = text.match(/\bfrom\s+the\s+([A-Za-z\s-]+?)\b/i);
    const directionCandidate = directionBeforeWinds?.[1] || directionFromClause?.[1] || '';
    const direction = normalizeWindDirection(directionCandidate);

    const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*mph/i);
    if (rangeMatch) {
        const low = formatMarineMagnitude(rangeMatch[1]);
        const high = formatMarineMagnitude(rangeMatch[2]);
        return `${low}-${high} mph${direction ? ` ${direction}` : ''}`;
    }

    const lessThanMatch = text.match(/(?:less than|lower than|below|under)\s*(\d+(?:\.\d+)?)\s*mph/i);
    if (lessThanMatch) {
        const threshold = formatMarineMagnitude(lessThanMatch[1]);
        return `<${threshold} mph${direction ? ` ${direction}` : ''}`;
    }

    const greaterThanMatch = text.match(/(?:greater than|more than|over|above)\s*(\d+(?:\.\d+)?)\s*mph/i);
    if (greaterThanMatch) {
        const threshold = formatMarineMagnitude(greaterThanMatch[1]);
        return `${threshold}+ mph${direction ? ` ${direction}` : ''}`;
    }

    const singleMatch = text.match(/(\d+(?:\.\d+)?)\s*mph/i);
    if (singleMatch) {
        const speed = formatMarineMagnitude(singleMatch[1]);
        return `${speed} mph${direction ? ` ${direction}` : ''}`;
    }

    return text.toUpperCase() || 'NO DATA';
}

function formatSurfWaveText(rawText) {
    const text = sanitizeMarineDisplayText(rawText);
    if (!text) {
        return 'NO DATA';
    }

    const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*(?:feet|foot|ft)?/i);
    if (rangeMatch) {
        const low = formatMarineMagnitude(rangeMatch[1]);
        const high = formatMarineMagnitude(rangeMatch[2]);
        return `${low}-${high} ft`;
    }

    const lessThanMatch = text.match(/(?:less than|lower than|below|under)\s*(\d+(?:\.\d+)?)/i);
    if (lessThanMatch) {
        const threshold = formatMarineMagnitude(lessThanMatch[1]);
        return `<${threshold} ft`;
    }

    const greaterThanMatch = text.match(/(?:greater than|more than|over|above)\s*(\d+(?:\.\d+)?)/i);
    if (greaterThanMatch) {
        const threshold = formatMarineMagnitude(greaterThanMatch[1]);
        return `${threshold}+ ft`;
    }

    const singleMatch = text.match(/(\d+(?:\.\d+)?)/);
    if (singleMatch) {
        const value = formatMarineMagnitude(singleMatch[1]);
        return `${value} ft`;
    }

    return text.toUpperCase() || 'NO DATA';
}

function parseTideTimeToday(timeText) {
    const match = String(timeText || '').match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (!match) {
        return null;
    }

    const hoursRaw = Number(match[1]);
    const minutes = Number(match[2] || '0');
    const meridiem = String(match[3] || '').toUpperCase();

    if (!Number.isFinite(hoursRaw) || !Number.isFinite(minutes)) {
        return null;
    }

    let hours24 = hoursRaw % 12;
    if (meridiem === 'PM') {
        hours24 += 12;
    }

    const date = new Date();
    date.setHours(hours24, minutes, 0, 0);
    return date;
}

function getNextUpcomingTidesByLocation(tides) {
    const tideRows = Array.isArray(tides) ? tides : [];
    if (tideRows.length === 0) {
        return [];
    }

    const rowsByLocation = new Map();
    tideRows.forEach(tide => {
        const location = String(tide?.location || '').trim() || 'Unknown Location';
        if (!rowsByLocation.has(location)) {
            rowsByLocation.set(location, []);
        }

        rowsByLocation.get(location).push(tide);
    });

    const nowMs = Date.now();
    const nextRows = [];

    rowsByLocation.forEach((rows, location) => {
        const withParsed = rows
            .map(row => ({
                ...row,
                parsedDate: parseTideTimeToday(row?.timeText)
            }))
            .sort((a, b) => {
                const aMs = a.parsedDate ? a.parsedDate.getTime() : Number.POSITIVE_INFINITY;
                const bMs = b.parsedDate ? b.parsedDate.getTime() : Number.POSITIVE_INFINITY;
                return aMs - bMs;
            });

        const upcoming = withParsed.find(row => row.parsedDate && row.parsedDate.getTime() >= nowMs);
        const chosen = upcoming || withParsed[0] || null;
        if (!chosen) {
            return;
        }

        nextRows.push({
            location,
            level: String(chosen.level || '--').trim().toLowerCase(),
            timeText: String(chosen.timeText || '--').trim().replace(/\.$/, '')
        });
    });

    return nextRows;
}

function getAqiScaleTarget(aqi) {
    if (!Number.isFinite(aqi)) {
        return {
            pointerTop: '90%',
            readout: 'AQI UNAVAILABLE'
        };
    }

    if (aqi <= 50) {
        return { pointerTop: '90%', readout: `GOOD (${aqi})` };
    }

    if (aqi <= 100) {
        return { pointerTop: '70%', readout: `MODERATE (${aqi})` };
    }

    if (aqi <= 150) {
        return { pointerTop: '50%', readout: `UNHEALTHY FOR SENSITIVE GROUPS (${aqi})` };
    }

    if (aqi <= 200) {
        return { pointerTop: '30%', readout: `UNHEALTHY (${aqi})` };
    }

    return { pointerTop: '10%', readout: `HAZARDOUS (${aqi})` };
}

function formatPrimaryPollutantLabel(rawValue) {
    const normalized = String(rawValue || '').trim().toUpperCase();
    const mapped = {
        'PM2.5': 'Fine particulate',
        'O3': 'Ozone',
        'PM10': 'Course particulate',
        'CO': 'Carbon monoxide',
        'SO2': 'Sulfur Dioxide',
        'NO2': 'Nitrogen Dioxide'
    };

    return mapped[normalized] || (normalized || 'N/A');
}

function getUvCategory(uvValue) {
    const normalizedUv = Number(uvValue);

    if (!Number.isFinite(normalizedUv) || normalizedUv <= 2) return 'LOW';
    if (normalizedUv <= 5) return 'MED';
    if (normalizedUv <= 7) return 'HIGH';
    if (normalizedUv <= 10) return 'VERY HIGH';
    return 'EXTREME';
}

function getSunIconPath(uvValue) {
    const category = getUvCategory(uvValue).toLowerCase().replace(/\s+/g, '_');
    const knownIcons = {
        low: 'sun icons/low.png'
    };

    return knownIcons[category] || 'sun icons/low.png';
}

function positionSunProgressIcon(sunriseIso, sunsetIso) {
    const icon = document.getElementById('sun-progress-icon');
    const arc = document.querySelector('.sun-arc');
    const wrap = document.querySelector('.sun-arc-wrap');
    if (!icon || !arc || !wrap) {
        return;
    }

    const arcRect = arc.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const radius = arcRect.width / 2;
    if (!Number.isFinite(radius) || radius <= 0) {
        return;
    }

    const sunriseMs = new Date(sunriseIso || '').getTime();
    const sunsetMs = new Date(sunsetIso || '').getTime();
    let clampedProgress = 0;
    if (Number.isFinite(sunriseMs) && Number.isFinite(sunsetMs) && sunsetMs > sunriseMs) {
        const nowMs = Date.now();
        clampedProgress = Math.min(1, Math.max(0, (nowMs - sunriseMs) / (sunsetMs - sunriseMs)));
    }

    const centerX = (arcRect.left - wrapRect.left) + radius;
    const centerY = (arcRect.top - wrapRect.top) + (arcRect.height / 2);
    const theta = Math.PI + (clampedProgress * Math.PI);
    const x = centerX + (radius * Math.cos(theta));
    const y = centerY + (radius * Math.sin(theta));

    icon.style.opacity = '1';
    icon.style.left = `${x}px`;
    icon.style.top = `${y}px`;
}

function animateAirScalePointer(aqiRaw) {
    const pointer = document.querySelector('.air-scale-pointer');
    const readout = document.getElementById('air-scale-readout');
    if (!pointer) {
        return;
    }

    const animationDelayMs = 500;
    const animationDurationMs = 1700;

    const aqi = Number.isFinite(Number(aqiRaw)) ? Number(aqiRaw) : NaN;
    const target = getAqiScaleTarget(aqi);

    if (readout) {
        readout.classList.remove('visible');
        readout.textContent = '';
        readout.style.top = target.pointerTop;
    }

    let revealed = false;
    const revealReadout = () => {
        if (revealed) {
            return;
        }

        revealed = true;
        pointer.removeEventListener('transitionend', revealReadout);
        if (readout) {
            readout.textContent = target.readout;
            readout.classList.add('visible');
        }
    };

    pointer.addEventListener('transitionend', revealReadout, { once: true });

    pointer.style.transition = 'none';
    pointer.style.top = '100%';
    pointer.style.left = 'calc(-1 * (var(--triangle-side) * 0.78))';
    pointer.offsetHeight;
    pointer.style.transition = 'top 1700ms cubic-bezier(0.22, 1, 0.36, 1)';

    setTimeout(() => {
        requestAnimationFrame(() => {
            pointer.style.top = target.pointerTop;
        });
    }, animationDelayMs);

    setTimeout(revealReadout, animationDelayMs + animationDurationMs + 70);
}


/* ===========================================
   DISPLAY: Update the UI with weather data
   =========================================== */
function displayWeather(weatherValues, cityName) {
    const conditionIconPath = getConditionIconPath(weatherValues.conditionCurrent);
    const radarLoopPane = document.getElementById('radar-loop-pane');
    latestSceneAvailability = createSceneAvailabilityFromWeather(weatherValues);
    rebuildPlaybackQueueForCurrentData();
    setWelcomeSceneMode(true);
    applyWelcomeSceneBackground(weatherValues);
    applyDynamicSceneBackgrounds(weatherValues);
    chooseBackgroundTrackForAlerts(weatherValues.alerts);

    if (radarLoopPane) {
        const radarLoopUrl = String(weatherValues.radarLoopGifUrl || '').trim();
        const radarLoopWithCacheBust = radarLoopUrl
            ? `${radarLoopUrl}${radarLoopUrl.includes('?') ? '&' : '?'}cb=${Date.now()}`
            : '';
        radarLoopPane.style.backgroundImage = radarLoopWithCacheBust ? `url("${radarLoopWithCacheBust}")` : 'none';
        radarLoopPane.setAttribute('aria-label', weatherValues.radarStationId
            ? `Local radar loop from ${weatherValues.radarStationId}`
            : 'Local radar loop unavailable');
    }

    document.getElementById('scene-location').textContent = cityName;
    document.getElementById('scene-condition').textContent = weatherValues.conditionCurrent;
    document.getElementById('scene-icon').style.backgroundImage = `url("${conditionIconPath}")`;
    document.getElementById('scene-icon').style.backgroundSize = 'contain';
    document.getElementById('scene-icon').style.backgroundPosition = 'center';
    document.getElementById('scene-icon').style.backgroundRepeat = 'no-repeat';
    document.getElementById('scene-temperature').textContent = weatherValues.temperatureCurrent;
    document.getElementById('scene-humidity').textContent = weatherValues.humidityCurrent;
    document.getElementById('scene-dewpoint').textContent = weatherValues.dewpointCurrent ? `${weatherValues.dewpointCurrent.value}${DEGREE_SYMBOL}${weatherValues.dewpointCurrent.unit}` : 'N/A';
    document.getElementById('scene-pressure-value').textContent = weatherValues.pressureCurrent ? weatherValues.pressureCurrent.value : 'N/A';
    document.getElementById('scene-pressure-unit').textContent = weatherValues.pressureCurrent ? weatherValues.pressureCurrent.unit.toUpperCase() : '';
    document.getElementById('scene-visibility-value').textContent = weatherValues.visibilityCurrent ? weatherValues.visibilityCurrent.value : 'N/A';
    document.getElementById('scene-visibility-unit').textContent = weatherValues.visibilityCurrent ? weatherValues.visibilityCurrent.unit.toUpperCase() : '';
    document.getElementById('scene-wind').textContent = weatherValues.windDisplayCurrent;
    document.getElementById('scene-gust').textContent = weatherValues.windGustDisplayCurrent;
    document.getElementById('scene-heat-index').textContent = weatherValues.heatIndexCurrent ? `${weatherValues.heatIndexCurrent}${DEGREE_SYMBOL}F` : 'N/A';

    const scene36Location = document.getElementById('scene-36-location');
    if (scene36Location) {
        scene36Location.textContent = cityName;
    }

    const bulletinLocation = document.getElementById('bulletin-location');
    if (bulletinLocation) {
        bulletinLocation.textContent = 'THE NATIONAL WEATHER SERVICE';
    }

    const bulletinText = document.getElementById('bulletin-text');
    if (bulletinText) {
        bulletinText.textContent = weatherValues.alerts === 'None'
            ? 'No active bulletins for this area.'
            : weatherValues.alerts;
    }

    const airLocation = document.getElementById('air-location');
    if (airLocation) {
        airLocation.textContent = cityName;
    }

    const allergyLocation = document.getElementById('allergy-location');
    if (allergyLocation) {
        allergyLocation.textContent = cityName;
    }

    const hydroLocation = document.getElementById('hydrological-location');
    if (hydroLocation) {
        hydroLocation.textContent = cityName;
    }

    const marineLocation = document.getElementById('marine-location');
    if (marineLocation) {
        marineLocation.textContent = cityName;
    }

    const marineGaugeName = document.getElementById('marine-gauge-name');
    const marineCurrentHeight = document.getElementById('marine-current-height');
    const marineWaterTemp = document.getElementById('marine-water-temp');
    const marineTideForecast = document.getElementById('marine-tide-forecast');
    const marineWind = document.getElementById('marine-wind');
    const marineWaveHeight = document.getElementById('marine-wave-height');
    const marineConsiderations = document.getElementById('marine-considerations');
    const marineBlock = document.getElementById('marine-block');

    if (marineBlock) {
        const randomMarineBackground = pickRandomArrayItem(discoveredMarineBodyImagePaths) || DEFAULT_MARINE_BODY_IMAGE_PATH;
        marineBlock.style.setProperty('--marine-body-image', randomMarineBackground ? `url("${randomMarineBackground}")` : 'none');
    }

    const marineZones = Array.isArray(weatherValues.marineSurfZones) ? weatherValues.marineSurfZones : [];
    if (marineGaugeName && marineCurrentHeight && marineWaterTemp && marineTideForecast && marineWind && marineWaveHeight && marineConsiderations) {
        if (marineZones.length === 0) {
            marineGaugeName.textContent = 'SURF ZONES';
            marineCurrentHeight.textContent = 'NO DATA';
            marineWaterTemp.textContent = 'NO DATA';
            marineTideForecast.replaceChildren();
            const emptyTideLine = document.createElement('p');
            emptyTideLine.className = 'marine-tide-line';
            emptyTideLine.textContent = 'NO DATA';
            marineTideForecast.appendChild(emptyTideLine);
            marineWind.textContent = 'NO DATA';
            marineWaveHeight.textContent = 'NO DATA';
            marineConsiderations.replaceChildren();
            marineConsiderations.hidden = true;
        } else {
            const primaryZone = pickRandomArrayItem(marineZones) || marineZones[0];
            marineGaugeName.textContent = primaryZone?.name || primaryZone?.zoneId || 'SURF ZONE';
            const zoneIdText = sanitizeMarineDisplayText(primaryZone?.zoneId) || 'ZONE --';
            const distanceText = Number.isFinite(Number(primaryZone?.distanceMiles))
                ? `${Number(primaryZone.distanceMiles).toFixed(1)} MI`
                : '-- MI';
            marineCurrentHeight.textContent = `${zoneIdText} | ${distanceText}`;

            const nextTides = getNextUpcomingTidesByLocation(primaryZone?.tides);

            marineTideForecast.replaceChildren();
            if (nextTides.length === 0) {
                const noTideDataLine = document.createElement('p');
                noTideDataLine.className = 'marine-tide-line';
                noTideDataLine.textContent = 'NO DATA';
                marineTideForecast.appendChild(noTideDataLine);
            }

            nextTides.slice(0, 6).forEach(tide => {
                const tideLineEl = document.createElement('p');
                tideLineEl.className = 'marine-tide-line';
                tideLineEl.textContent = `${sanitizeMarineDisplayText(tide.location)} - ${sanitizeMarineDisplayText(tide.level)} @ ${sanitizeMarineDisplayText(tide.timeText)}`;
                marineTideForecast.appendChild(tideLineEl);
            });

            marineWaterTemp.textContent = sanitizeMarineDisplayText(primaryZone?.waterTemperatureText) || 'NO DATA';
            marineWind.textContent = formatSurfWindText(primaryZone?.windsText);
            marineWaveHeight.textContent = formatSurfWaveText(primaryZone?.surfHeightText);

            marineConsiderations.replaceChildren();
            const considerations = Array.isArray(primaryZone?.specialConsiderations) ? primaryZone.specialConsiderations : [];
            marineConsiderations.hidden = considerations.length === 0;
            if (considerations.length !== 0) {
                considerations.forEach(item => {
                    const line = document.createElement('p');
                    line.className = 'marine-field-row';

                    const label = document.createElement('span');
                    label.className = 'marine-value-label marine-tide-heading';
                    label.textContent = `${sanitizeMarineDisplayText(item.label).toUpperCase()}:`;

                    const value = document.createElement('span');
                    value.className = 'marine-field-value';
                    value.textContent = sanitizeMarineDisplayText(item.category).toUpperCase() || 'NO DATA';

                    line.appendChild(label);
                    line.appendChild(value);
                    marineConsiderations.appendChild(line);
                });
            }
        }
    }

    const winterLocation = document.getElementById('winter-location');
    if (winterLocation) {
        winterLocation.textContent = cityName;
    }

    const winterPrimaryLabel = document.getElementById('winter-primary-label');
    if (winterPrimaryLabel) {
        winterPrimaryLabel.textContent = weatherValues.winterPrimaryLabel || 'NO WINTER PRECIP EXPECTED';
    }

    const winterPrimaryValue = document.getElementById('winter-primary-value');
    if (winterPrimaryValue) {
        winterPrimaryValue.textContent = weatherValues.winterPrimaryValue || '--';
    }

    const winterPrimaryStart = document.getElementById('winter-primary-start');
    if (winterPrimaryStart) {
        winterPrimaryStart.textContent = `@ ${weatherValues.winterPrimaryStartTime || '--'}`;
    }

    const winterSnowDepth = document.getElementById('winter-snow-depth');
    if (winterSnowDepth) {
        winterSnowDepth.textContent = weatherValues.winterSnowDepthText || '--';
    }

    const winterIceAccum = document.getElementById('winter-ice-accum');
    if (winterIceAccum) {
        winterIceAccum.textContent = weatherValues.winterIceAccumulationText || '--';
    }

    const winterWindGusts = document.getElementById('winter-wind-gusts');
    if (winterWindGusts) {
        winterWindGusts.textContent = weatherValues.winterWindGustsText || '--';
    }

    const winterTodayLow = document.getElementById('winter-today-low');
    if (winterTodayLow) {
        winterTodayLow.textContent = weatherValues.winterTodayLowText || '--';
    }

    const winterBlock = document.getElementById('winter-block');
    if (winterBlock) {
        const randomWinterBackground = pickRandomArrayItem(discoveredWinterBodyImagePaths) || DEFAULT_WINTER_BODY_IMAGE_PATH;
        winterBlock.style.setProperty('--winter-body-image', randomWinterBackground ? `url("${randomWinterBackground}")` : 'none');
    }

    const allergySeasonIcon = document.getElementById('allergy-season-icon');
    if (allergySeasonIcon) {
        const iconPath = weatherValues.allergySeasonIconPath || '';
        allergySeasonIcon.style.backgroundImage = iconPath ? `url("${iconPath}")` : '';
        allergySeasonIcon.setAttribute('aria-label', weatherValues.allergySeason || 'Current allergy season');
    }

    const allergySeasonLabel = document.getElementById('allergy-season-label');
    if (allergySeasonLabel) {
        allergySeasonLabel.textContent = weatherValues.allergySeason || '--';
    }

    for (let index = 0; index < 5; index += 1) {
        const barData = weatherValues.allergyPeriods[index] || null;
        const fillEl = document.getElementById(`allergy-bar-fill-${index + 1}`);
        const dayEl = document.getElementById(`allergy-bar-day-${index + 1}`);

        if (dayEl) {
            dayEl.textContent = barData ? barData.dayLabel : '---';
        }

        if (fillEl) {
            fillEl.className = `allergy-bar-fill ${barData ? barData.levelClass : 'allergy-bar-low'}`;
            fillEl.style.setProperty('--allergy-bar-height', `${barData ? barData.barHeightPercent : 8}%`);
        }
    }

    for (let index = 0; index < 5; index += 1) {
        const gaugeData = weatherValues.hydrologicalGauges[index] || null;
        const cardNumber = index + 1;
        const gaugeNameEl = document.getElementById(`hydro-gauge-name-${cardNumber}`);
        const gaugeMetaEl = document.getElementById(`hydro-gauge-meta-${cardNumber}`);
        const stageValueEl = document.getElementById(`hydro-stage-value-${cardNumber}`);
        const flowValueEl = document.getElementById(`hydro-flow-value-${cardNumber}`);
        const stageMeterEl = document.getElementById(`hydro-stage-meter-${cardNumber}`);
        const flowMeterEl = document.getElementById(`hydro-flow-meter-${cardNumber}`);
        const impactEl = document.getElementById(`hydro-impact-${cardNumber}`);

        if (!gaugeNameEl || !gaugeMetaEl || !stageValueEl || !flowValueEl || !stageMeterEl || !flowMeterEl || !impactEl) {
            continue;
        }

        if (!gaugeData) {
            gaugeNameEl.textContent = '--';
            gaugeMetaEl.textContent = 'NO GAUGE DATA';
            stageValueEl.textContent = 'STAGE --';
            flowValueEl.textContent = 'FLOW --';
            stageMeterEl.dataset.activeCategory = '';
            flowMeterEl.dataset.activeCategory = '';
            stageMeterEl.dataset.noData = 'true';
            flowMeterEl.dataset.noData = 'true';
            cardNumber && document.getElementById(`hydro-gauge-card-${cardNumber}`)?.style.setProperty('--hydro-card-image', `url("${getHydroCardImagePath('none')}")`);
            impactEl.textContent = 'No impact statement available.';
            continue;
        }

        const stageReadingValue = gaugeData.currentStage;
        const flowReadingValue = gaugeData.currentFlow;
        const gaugeDataForDisplay = {
            ...gaugeData,
            currentStage: stageReadingValue,
            currentFlow: flowReadingValue
        };

        const stageThresholds = getHydroThresholdsByType(gaugeData, 'stage');
        const flowThresholds = getHydroThresholdsByType(gaugeData, 'flow');
        const stageNoData = isHydroNoDataValue(stageReadingValue);
        const flowNoData = isHydroNoDataValue(flowReadingValue);
        const stageCategory = stageNoData ? null : getHydroCategoryFromThresholds(stageReadingValue, stageThresholds);
        const flowCategory = flowNoData ? null : getHydroCategoryFromThresholds(flowReadingValue, flowThresholds);
        const distanceText = Number.isFinite(Number(gaugeData.distanceMiles))
            ? `${Number(gaugeData.distanceMiles).toFixed(1)} MI`
            : '-- MI';
        const highestCategory = [stageCategory, flowCategory]
            .filter(Boolean)
            .sort((a, b) => getHydroCategoryRank(b) - getHydroCategoryRank(a))[0] || 'none';
        const cardEl = document.getElementById(`hydro-gauge-card-${cardNumber}`);

        gaugeNameEl.textContent = gaugeData.name || gaugeData.identifier || '--';
        gaugeMetaEl.textContent = `Distance to gauge: ${distanceText}`;

        stageValueEl.textContent = stageNoData ? 'STAGE NO DATA' : `STAGE ${formatHydroValue(stageReadingValue, gaugeData.stageUnits)}`;
        flowValueEl.textContent = flowNoData ? 'FLOW NO DATA' : `FLOW ${formatHydroValue(flowReadingValue, gaugeData.flowUnits)}`;

        stageMeterEl.dataset.activeCategory = stageCategory || '';
        flowMeterEl.dataset.activeCategory = flowCategory || '';
        stageMeterEl.dataset.noData = stageNoData ? 'true' : 'false';
        flowMeterEl.dataset.noData = flowNoData ? 'true' : 'false';

        if (cardEl) {
            cardEl.style.setProperty('--hydro-card-image', `url("${getHydroCardImagePath(highestCategory)}")`);
        }

        impactEl.textContent = getHydroImpactStatement(gaugeDataForDisplay);
    }

    const sunLocation = document.getElementById('sun-location');
    if (sunLocation) {
        sunLocation.textContent = cityName;
    }

    const sunriseTime = document.getElementById('sunrise-time');
    if (sunriseTime) {
        sunriseTime.textContent = weatherValues.sunriseTime;
    }

    const sunsetTime = document.getElementById('sunset-time');
    if (sunsetTime) {
        sunsetTime.textContent = weatherValues.sunsetTime;
    }

    latestSunriseIso = weatherValues.sunriseIso;
    latestSunsetIso = weatherValues.sunsetIso;
    if (currentScene === 'scene-sun') {
        positionSunProgressIcon(latestSunriseIso, latestSunsetIso);
    }

    const sunUvValue = document.getElementById('sun-uv-value');
    if (sunUvValue) {
        sunUvValue.textContent = Number.isFinite(Number(weatherValues.uvCurrent))
            ? Number(weatherValues.uvCurrent).toFixed(1)
            : '--';
    }

    const sunUvCategory = document.getElementById('sun-uv-category');
    if (sunUvCategory) {
        sunUvCategory.textContent = getUvCategory(weatherValues.uvCurrent);
    }

    const sunUvCurrentTime = document.getElementById('sun-uv-current-time');
    if (sunUvCurrentTime) {
        sunUvCurrentTime.textContent = weatherValues.uvCurrentTime || '--';
    }

    const sunUvPeakValue = document.getElementById('sun-uv-peak-value');
    if (sunUvPeakValue) {
        sunUvPeakValue.textContent = Number.isFinite(Number(weatherValues.uvPeakValue))
            ? Number(weatherValues.uvPeakValue).toFixed(1)
            : '--';
    }

    const sunUvPeakTime = document.getElementById('sun-uv-peak-time');
    if (sunUvPeakTime) {
        sunUvPeakTime.textContent = weatherValues.uvPeakTime || '--:--';
    }

    const sunUvPeakCategory = document.getElementById('sun-uv-peak-category');
    if (sunUvPeakCategory) {
        sunUvPeakCategory.textContent = getUvCategory(weatherValues.uvPeakValue);
    }

    const moonLocation = document.getElementById('moon-location');
    if (moonLocation) {
        moonLocation.textContent = cityName;
    }

    const moonIlluminationValue = document.getElementById('moon-illumination-value');
    if (moonIlluminationValue) {
        moonIlluminationValue.textContent = Number.isFinite(Number(weatherValues.moonIlluminationPercent))
            ? `${Math.round(Number(weatherValues.moonIlluminationPercent))}%`
            : '--%';
    }

    const moonSizeValue = document.getElementById('moon-size-value');
    if (moonSizeValue) {
        moonSizeValue.textContent = Number.isFinite(Number(weatherValues.moonCurrentSizePercent))
            ? `${Math.round(Number(weatherValues.moonCurrentSizePercent))}%`
            : '--%';
    }

    const moonNextPhaseName = document.getElementById('moon-next-phase-name');
    if (moonNextPhaseName) {
        moonNextPhaseName.textContent = weatherValues.moonNextPhaseName || '--';
    }

    const moonNextPhaseDate = document.getElementById('moon-next-phase-date');
    if (moonNextPhaseDate) {
        moonNextPhaseDate.textContent = weatherValues.moonNextPhaseDate || '--';
    }

    const airDay = document.getElementById('air-day');
    if (airDay) {
        airDay.textContent = weatherValues.airDayLabel;
    }

    const airPrimaryValue = document.getElementById('air-primary-value');
    if (airPrimaryValue) {
        airPrimaryValue.textContent = formatPrimaryPollutantLabel(weatherValues.airPrimaryPollutant);
    }

    latestAirAqi = weatherValues.airAqi;
    if (currentScene === 'scene-air') {
        animateAirScalePointer(latestAirAqi);
    }

    detailedForecastSegments36 = weatherValues.detailedForecastSegments || [];
    active36SegmentIndex = -1;
    is36FadeTransitioning = false;
    if (currentScene === 'scene-36-hour') {
        update36HourPaneByElapsedTime();
    }

    const weekLocation = document.getElementById('week-location');
    if (weekLocation) {
        weekLocation.textContent = cityName;
    }

    const hourLocation = document.getElementById('hour-location');
    if (hourLocation) {
        hourLocation.textContent = cityName;
    }

    for (let index = 0; index < 7; index += 1) {
        const dayData = weatherValues.weeklyForecast[index];
        const cardNumber = index + 1;
        const dayLabel = document.getElementById(`week-day-label-${cardNumber}`);
        const dayIcon = document.getElementById(`week-day-icon-${cardNumber}`);
        const dayCondition = document.getElementById(`week-day-condition-${cardNumber}`);
        const dayHigh = document.getElementById(`week-day-high-${cardNumber}`);
        const dayLow = document.getElementById(`week-day-low-${cardNumber}`);

        if (!dayLabel || !dayIcon || !dayCondition || !dayHigh || !dayLow) {
            continue;
        }

        if (!dayData) {
            dayLabel.textContent = '---';
            dayCondition.textContent = '';
            dayIcon.style.backgroundImage = '';
            dayHigh.textContent = '';
            dayLow.textContent = '';
            continue;
        }

        dayLabel.textContent = dayData.label;
        dayCondition.textContent = dayData.condition;
        dayIcon.style.backgroundImage = `url("${dayData.iconPath}")`;
        dayIcon.style.backgroundSize = 'contain';
        dayIcon.style.backgroundPosition = 'center';
        dayIcon.style.backgroundRepeat = 'no-repeat';
        dayHigh.textContent = dayData.high === null ? '' : `${dayData.high}`;
        dayLow.textContent = dayData.low === null ? '' : `${dayData.low}`;
    }

    for (let index = 0; index < 7; index += 1) {
        const hourData = weatherValues.hourlyForecast[index];
        const cardNumber = index + 1;
        const hourLabel = document.getElementById(`hour-label-${cardNumber}`);
        const hourIcon = document.getElementById(`hour-icon-${cardNumber}`);
        const hourCondition = document.getElementById(`hour-condition-${cardNumber}`);
        const hourTemp = document.getElementById(`hour-temp-${cardNumber}`);
        const hourEmpty = document.getElementById(`hour-empty-${cardNumber}`);

        if (!hourLabel || !hourIcon || !hourCondition || !hourTemp || !hourEmpty) {
            continue;
        }

        if (!hourData) {
            hourLabel.textContent = '---';
            hourCondition.textContent = '';
            hourIcon.style.backgroundImage = '';
            hourTemp.textContent = '';
            hourEmpty.textContent = '';
            continue;
        }

        hourLabel.textContent = hourData.label;
        hourCondition.textContent = hourData.condition;
        hourIcon.style.backgroundImage = `url("${hourData.iconPath}")`;
        hourIcon.style.backgroundSize = 'contain';
        hourIcon.style.backgroundPosition = 'center';
        hourIcon.style.backgroundRepeat = 'no-repeat';
        hourTemp.textContent = hourData.temperature === null ? '' : `${hourData.temperature}${DEGREE_SYMBOL}`;
        hourEmpty.textContent = '';
    }

    if (headerTemp) {
        headerTemp.textContent = `${weatherValues.temperatureCurrent}${DEGREE_SYMBOL}`;
    }
}

async function fetchPollenCurrentForecast(zipCode, lat, lon) {
    const normalizedZip = String(zipCode || '').trim();
    const hasZip = /^\d{5}$/.test(normalizedZip);
    const latNum = Number(lat);
    const lonNum = Number(lon);
    const hasCoords = Number.isFinite(latNum) && Number.isFinite(lonNum);

    if (!hasZip && !hasCoords) {
        console.warn('[API] Pollen.com skipped: no ZIP or coordinates available.');
        return null;
    }

    const proxyUrls = [];
    if (hasZip) {
        proxyUrls.push(`${POLLEN_PROXY_BASE_URL}/pollen/outlook?zip=${encodeURIComponent(normalizedZip)}`);
    }
    if (hasCoords) {
        proxyUrls.push(`${POLLEN_PROXY_BASE_URL}/pollen/outlook?lat=${encodeURIComponent(latNum)}&lon=${encodeURIComponent(lonNum)}`);
    }

    for (const proxyUrl of proxyUrls) {
        try {
            const proxyResponse = await fetch(proxyUrl, {
                headers: { 'Accept': 'application/json' }
            });

            if (!proxyResponse.ok) {
                const proxyBody = await proxyResponse.text();
                console.warn(`[API] Local pollen proxy returned ${proxyResponse.status} for ${proxyUrl}:`, proxyBody);
                continue;
            }

            const proxyPayload = await proxyResponse.json();
            if (proxyPayload && typeof proxyPayload === 'object') {
                return proxyPayload;
            }
        } catch (proxyError) {
            console.warn(`[API] Local pollen proxy unavailable for ${proxyUrl}:`, proxyError);
        }
    }

    const directUrls = [];
    if (hasZip) {
        directUrls.push(`https://www.pollen.com/api/forecast/outlook/${encodeURIComponent(normalizedZip)}`);
    }
    if (hasCoords) {
        directUrls.push(`https://www.pollen.com/api/forecast/outlook/${encodeURIComponent(latNum)}/${encodeURIComponent(lonNum)}/`);
    }

    for (const directUrl of directUrls) {
        try {
            const directPayload = await fetchJsonWithCorsFallback(directUrl, 'Pollen.com outlook');
            if (directPayload && typeof directPayload === 'object') {
                return directPayload;
            }
        } catch (directError) {
            console.warn(`[API] Pollen.com direct/proxy fallback failed for ${directUrl}:`, directError);
        }
    }

    console.warn('[API] Pollen.com unavailable after local proxy and direct fallback attempts.');
    return null;
}

async function fetchPollenExtendedForecast(zipCode) {
    const normalizedZip = String(zipCode || '').trim();
    if (!/^\d{5}$/.test(normalizedZip)) {
        console.warn('[API] Pollen extended skipped: no ZIP code available.');
        return null;
    }

    const proxyUrl = `${POLLEN_PROXY_BASE_URL}/pollen/extended?zip=${encodeURIComponent(normalizedZip)}`;
    try {
        const proxyResponse = await fetch(proxyUrl, {
            headers: { 'Accept': 'application/json' }
        });

        if (!proxyResponse.ok) {
            const proxyBody = await proxyResponse.text();
            console.warn(`[API] Local pollen extended proxy returned ${proxyResponse.status}:`, proxyBody);
            return null;
        }

        const proxyPayload = await proxyResponse.json();
        if (proxyPayload && typeof proxyPayload === 'object') {
            return proxyPayload;
        }
    } catch (proxyError) {
        console.warn('[API] Local pollen extended proxy unavailable:', proxyError);
    }

    const directUrl = `https://www.pollen.com/api/forecast/extended/pollen/${encodeURIComponent(normalizedZip)}`;
    try {
        const directPayload = await fetchJsonWithCorsFallback(directUrl, 'Pollen.com extended outlook');
        if (directPayload && typeof directPayload === 'object') {
            return directPayload;
        }
    } catch (directError) {
        console.warn('[API] Pollen extended direct/proxy fallback failed:', directError);
    }

    return null;
}