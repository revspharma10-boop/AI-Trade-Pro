// One responsive recommendation surface for the deployed browser site and
// (optionally) the legacy Android APK. Research runs on the Render backend.
// Detailed local research stays available only in development builds without
// either recommendation UI flag; it is not displayed on the public web app.
import './intradayRecommendations.css';
import './androidBottomNavigation.css';
import {mountAndroidBottomNavigation} from './androidBottomNavigation.js';

if(import.meta.env.VITE_ANDROID_APP==='true'||import.meta.env.VITE_WEB_RECOMMENDATION_UI==='true'){
 if(import.meta.env.VITE_WEB_RECOMMENDATION_UI==='true'&&
    import.meta.env.VITE_ANDROID_APP!=='true'){
  document.body.classList.add('web-recommendation-shell');
 }
 mountAndroidBottomNavigation();
}else{
 // Keep the web-based research interface and browser-local demo for web users.
 import('./autoOptionResearchUI.js').then(({mountAutoOptionResearch})=>{
  mountAutoOptionResearch();
  return import('./indexDemoSessionUI.js');
 }).then(({mountIndexDemoJournal})=>mountIndexDemoJournal());
}
