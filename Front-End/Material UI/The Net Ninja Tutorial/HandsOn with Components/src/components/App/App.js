import {
  BrowserRouter as Router,
  Routes as Switch,
  Route,
} from "react-router-dom";


import LearnTypography from '../Pages/LearnTypography.js';
import LearnButton from '../Pages/LearnButton.js';
import LearnIcons from '../Pages/LearnIcons.js';
import LearnMakeSytleHook from '../Pages/LearnMakeSytleHook.js'
import './App.css';

function App() {
  return (
    <Router>
      <Switch>
        <Route exact path="/typography" element={<LearnTypography />} />
        <Route exact path="/button" element={<LearnButton />} />
        <Route exact path="/icons" element={<LearnIcons />}/>
        <Route exact path="/makestyle" element={<LearnMakeSytleHook />}/>
      </Switch>
    </Router>
  );
}

export default App;
