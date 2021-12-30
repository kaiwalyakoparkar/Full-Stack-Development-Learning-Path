import './App.css';
import Navbar from '../Navbar/Navbar.js';
import Home from '../Home/Home.js';
import About from '../About/About.js';
import Contact from '../Contact/Contact.js';

import { BrowserRouter as Router, Routes as Switch, Route, Link } from "react-router-dom";


function App() {
  return (
    <div>
      <Router>  
        <Navbar />
        <Switch>
          <Route exact path="/" element={<Home />} />
          <Route exact path="/about" element={<About />} />
          <Route exact path="/contact" element={<Contact />} />
        </Switch>
      </Router>
    </div>
  );
}

export default App;
