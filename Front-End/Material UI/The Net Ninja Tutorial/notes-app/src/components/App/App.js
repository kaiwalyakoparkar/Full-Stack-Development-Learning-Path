import {
  BrowserRouter as Router,
  Routes as Switch,
  Route,
} from "react-router-dom";


import Notes from '../Pages/Notes.js';
import Create from '../Pages/Create.js';
import './App.css';

function App() {
  return (
    <Router>
      <Switch>
        <Route exact path="/" element={<Notes />} />
        <Route path="/create" element={<Create />} />
      </Switch>
    </Router>
  );
}

export default App;
