// Two deliberately separate surfaces:
// - Android APK: minimal last recommendation; all research computed by Render.
// - Existing GitHub Pages website: full research UI unchanged.
import './intradayRecommendations.css';
import './androidBottomNavigation.css';
import {mountAndroidBottomNavigation} from './androidBottomNavigation.js';

if(import.meta.env.VITE_ANDROID_APP==='true'){
 mountAndroidBottomNavigation();
}else{
 // Keep the web-based research interface and browser-local demo for web users.
 import('./autoOptionResearchUI.js').then(({mountAutoOptionResearch})=>{
  mountAutoOptionResearch();
  return import('./indexDemoSessionUI.js');
 }).then(({mountIndexDemoJournal})=>mountIndexDemoJournal());
}
