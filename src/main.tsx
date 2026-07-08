import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ReactGA from "react-ga4";
import './index.css';

ReactGA.initialize("G-RM09G759SP");
ReactGA.send({ hitType: "pageview", page: window.location.pathname });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
