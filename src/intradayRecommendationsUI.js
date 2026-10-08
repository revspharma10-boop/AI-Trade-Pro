// AI Trade Pro — simple automatic CE/PE research and paper-demo entrypoint.
// Legacy manual contract search remains in tested services / read-only backend.
import './intradayRecommendations.css';
import {mountAutoOptionResearch} from './autoOptionResearchUI.js';
import {mountIndexDemoJournal} from './indexDemoSessionUI.js';

mountAutoOptionResearch();
mountIndexDemoJournal();
