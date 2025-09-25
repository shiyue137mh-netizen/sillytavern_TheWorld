/**
 * The World - State Management
 * @description A simple, centralized object to hold the application's state.
 */
export const TheWorldState = {
    // --- Data from AI ---
    latestMapData: null,
    latestWorldStateData: null,
    
    // --- UI State ---
    isPanelVisible: false,
    selectedMainLocation: null,
    selectedSubLocation: null,
    panelWidth: 450,
    panelHeight: null, 
    panelTop: 60,
    panelLeft: null,
    buttonTop: 10,
    buttonLeft: null,
    liteMapPathStack: [], // NEW: For lite map navigation state
    currentPlayerLocationId: null, // NEW: For Macro API

    // --- Settings State ---
    activeSkyThemeId: 'default', // NEW: To store the selected sky theme
    isGlobalThemeEngineEnabled: false, // New state for the global feature
    isFxGlobal: false,
    isImmersiveModeEnabled: false, // New toggle for the "glass" effect
    isRaindropFxOn: false,
    weatherFxEnabled: true,
    isCloudFxEnabled: true,
    locationFxEnabled: true,
    celestialFxEnabled: true,
    isSkygazingModeActive: false,
    hasLoadedBefore: false,
    fontSize: '14px',
    mapMode: 'advanced', // 'lite' or 'advanced'

    // --- Audio Settings ---
    isAudioEnabled: true,
    ambientVolume: 0.5,
    sfxVolume: 0.8,
};