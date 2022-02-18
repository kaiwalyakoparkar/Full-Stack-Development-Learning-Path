import {
  BrowserRouter as Router,
  Routes as Switch,
  Route,
} from "react-router-dom";

//Importing libraries to overrite the default theme of material ui
import {createTheme, ThemeProvider} from '@mui/material/styles'
import { purple } from '@mui/material/colors'

import LearnTypography from '../Pages/LearnTypography.js';
import LearnButton from '../Pages/LearnButton.js';
import LearnIcons from '../Pages/LearnIcons.js';
import LearnMakeSytleHook from '../Pages/LearnMakeSytleHook.js'
import LearnTextField from '../Pages/LearnTextField.js'
import LearnRadioButton from '../Pages/LearnRadioButton.js'
import LearnGridLayout from '../Pages/LearnGridLayout.js'
import LearnCard from '../Pages/LearnCard.js'
import LearnParmanentDrawer from '../Pages/LearnParmanentDrawer.js'
import './App.css';

//Creating override object
const customTheme = createTheme({
    palette: {
      //Commented to use other components smoothly
      // primary: {
      //   main: '#fafafa'
      // },
      secondary: purple
    }
})


function App() {
  return (
    <ThemeProvider theme={customTheme}>
      <Router>
        <Switch>
 
          <Route exact path="/typography" element={<LearnTypography />} />
          <Route exact path="/button" element={<LearnButton />} />
          <Route exact path="/icons" element={<LearnIcons />}/>
          <Route exact path="/makestyle" element={<LearnMakeSytleHook />}/>
          <Route exact path="/textfield" element={<LearnTextField />}/>
          <Route exact path="/radiobutton" element={<LearnRadioButton />}/>
          <Route exact path="/gridlayout" element={<LearnGridLayout />}/>
          <Route exact path="/card" element={<LearnCard />}/>
          <Route exact path="/drawer" element={<LearnParmanentDrawer />}/>

        </Switch>
      </Router>
    </ThemeProvider>
  );
}

export default App;
