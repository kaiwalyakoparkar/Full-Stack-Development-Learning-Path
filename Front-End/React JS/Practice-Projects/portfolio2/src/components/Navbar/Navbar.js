import './Navbar.css';
import {
  BrowserRouter as Router,
  Routes as Switch,
  Route,
  Link
} from "react-router-dom";

export default function Navbar () {
	return (
		<div>
			<nav className="navbar navbar-expand-lg navbar-dark bg-info">
			  <Link className="navbar-brand" to="/">Portfolio 2</Link>
			  <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNavAltMarkup" aria-controls="navbarNavAltMarkup" aria-expanded="false" aria-label="Toggle navigation">
			    <span className="navbar-toggler-icon"></span>
			  </button>
			  <div className="collapse navbar-collapse " id="navbarNavAltMarkup">
			    <div className="navbar-nav">
			      <Link className="nav-item nav-link active" to="/">Home <span className="sr-only">(current)</span></Link>
			      <Link className="nav-item nav-link" to="/about">About</Link>
			      <Link className="nav-item nav-link" to="/contact">Contact</Link>
			    </div>
			  </div>
			</nav>
		</div>
	);
}