import './Navbar.css';

export default function Navbar () {
	return (
		<div>
			<nav className="navbar navbar-expand-lg navbar-dark bg-info">
			  <a className="navbar-brand" href="/">Portfolio 2</a>
			  <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNavAltMarkup" aria-controls="navbarNavAltMarkup" aria-expanded="false" aria-label="Toggle navigation">
			    <span className="navbar-toggler-icon"></span>
			  </button>
			  <div className="collapse navbar-collapse " id="navbarNavAltMarkup">
			    <div className="navbar-nav">
			      <a className="nav-item nav-link active" href="/">Home <span className="sr-only">(current)</span></a>
			      <a className="nav-item nav-link" href="/">About</a>
			      <a className="nav-item nav-link" href="/">Contact</a>
			    </div>
			  </div>
			</nav>
		</div>
	);
}