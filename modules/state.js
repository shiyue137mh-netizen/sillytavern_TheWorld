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

    // --- Settings State ---
    isGlobalThemeEngineEnabled: false, // New state for the global feature
    isFxGlobal: false,
    isImmersiveModeEnabled: false, // New toggle for the "glass" effect
    isRaindropFxOn: false,
    weatherFxEnabled: true,
    locationFxEnabled: true,
    celestialFxEnabled: true
};