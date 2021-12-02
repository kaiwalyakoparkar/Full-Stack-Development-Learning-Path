import Navbar from '../Navbar/Navbar';
import TextForm from '../TextForm/TextForm'
import About from '../About/About'
import { BrowserRouter as Router, Routes as Switch, Route, Link } from "react-router-dom";

function App() {
  return (
    <div>
      {/*Envolpe everything into Router block*/}
      <Router>

        <Navbar title="Text Utils"/>

        <div className="container my-3">
          {/*Evolope in the Switch components to be rendered after Link in Navbar is hit*/}
          <Switch> 
            <Route exact path="/" element={<TextForm heading="Enter your text to analyse"/>} />
            <Route exact path="/about" element={<About/>} />
          </Switch>
        </div> 

      </Router>
    </div>
  );
}

export default App;
