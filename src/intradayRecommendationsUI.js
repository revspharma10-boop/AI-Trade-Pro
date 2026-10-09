// AI Trade Pro — simple automatic CE/PE research and paper-demo entrypoint.
// Legacy manual contract search remains in tested services / read-only backend.
import './intradayRecommendations.css';
import {mountAutoOptionResearch} from './autoOptionResearchUI.js';
import {mountIndexDemoJournal} from './indexDemoSessionUI.js';
import {mountAndroidBottomNavigation} from './androidBottomNavigation.js';
import './androidBottomNavigation.css';

mountAutoOptionResearch();
mountIndexDemoJournal();

// Android build enables this native-style shell. The GitHub Pages web UI is unaffected.
if(import.meta.env.VITE_ANDROID_APP==='true')mountAndroidBottomNavigation();
