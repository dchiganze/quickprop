import { createRoot } from 'react-dom/client';

import App from './App';
import { preloadFacebookSdk } from './utils/shareLinks';

import './index.css';

preloadFacebookSdk();
createRoot(document.getElementById('root')!).render(<App />);
