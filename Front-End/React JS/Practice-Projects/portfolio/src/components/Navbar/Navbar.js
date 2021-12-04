export default function Navbar() {
	
	return(
		<div >
			<nav className="navbar navbar-expand-lg navbar-dark bg-primary">
			  <div className="container-fluid" >
			    <a className="navbar-brand" href="/">Portfolio</a>
			    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNavAltMarkup" aria-controls="navbarNavAltMarkup" aria-expanded="false" aria-label="Toggle navigation">
			      <span className="navbar-toggler-icon"></span>
			    </button>
			    <div className="collapse navbar-collapse" id="navbarNavAltMarkup">
			      <div className="navbar-nav">
			        <a className="nav-link active" href="/">Home</a>
			        <a className="nav-link active" href="/">About</a>
			        <a className="nav-link active" href="/">Certifications</a>
			        <a className="nav-link active" href="/">Contact</a>
			      </div>
			    </div>
			  </div>
			</nav>
		</div>
	)
}