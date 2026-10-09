// Responsive web-first AI Trade Pro. The same verified, minimal paper card
// appears on any browser; no native Android APK is required.
// All OHLC, technical, option-chain, premium and risk checks remain on Render.
import './intradayRecommendations.css';
import './androidBottomNavigation.css';
import {mountAndroidBottomNavigation} from './androidBottomNavigation.js';

// Browser chrome (including the phone status bar) manages its own insets.
// Keep the Capacitor-only spacing for legacy, manually built Android clients.
if(import.meta.env.VITE_ANDROID_APP!=='true'){
 document.body.classList.add('web-recommendation-shell');
}
mountAndroidBottomNavigation();
