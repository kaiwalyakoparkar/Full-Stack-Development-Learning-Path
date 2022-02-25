import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './components/App/App';
import {createTheme, ThemeProvider} from '@mui/material/styles'

const customTheme = createTheme({
    palette: {
      //Commented to use other components smoothly
      mode: 'dark',
      primary: {
        main: '#ffffff'
      }
    }
})

ReactDOM.render(
  <React.StrictMode>
    <ThemeProvider theme={customTheme}>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
  document.getElementById('root')
);