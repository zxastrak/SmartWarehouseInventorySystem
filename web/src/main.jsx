import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import './styles/signup.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
