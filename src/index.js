import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.scss';
import {ParallaxProvider} from "react-scroll-parallax";

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
      <ParallaxProvider>
        <App />
      </ParallaxProvider>
  </React.StrictMode>
);