import {
  BrowserRouter as Router,
  Routes as Switch,
  Route,
} from "react-router-dom";


import LearnTypography from '../Pages/LearnTypography.js';
import LearnButton from '../Pages/LearnButton.js';
import './App.css';

function App() {
  return (
    <Router>
      <Switch>
        <Route exact path="/typography" element={<LearnTypography />} />
        <Route path="/button" element={<LearnButton />} />
      </Switch>
    </Router>
  );
}

export default App;
