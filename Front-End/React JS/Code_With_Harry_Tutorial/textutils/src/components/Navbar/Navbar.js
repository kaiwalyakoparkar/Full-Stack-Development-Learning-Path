import propTypes from 'prop-types'

export default function Navbar(props) {
	return(
		<div>
			<nav className="navbar navbar-expand-lg navbar-dark bg-dark">
		        <div className="container-fluid">
		          <a className="navbar-brand" href="/">{props.title}</a>
		          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
		            <span className="navbar-toggler-icon"></span>
		          </button>
		          <div className="collapse navbar-collapse" id="navbarNav">
		            <ul className="navbar-nav">
		              <li className="nav-item">
		                <a className="nav-link active" aria-current="page" href="/">Home</a>
		              </li>
		              <li className="nav-item">
		                <a className="nav-link" href="/">About</a>
		              </li>
		              <li className="nav-item">
		                <a className="nav-link" href="/">Contact</a>
		              </li>
		            </ul>
		          </div>
		        </div>
	      	</nav>
      	</div>
	);
}

//This will enforce the title to be passed else it will raise the error
// Navbar.propTypes = {title: propTypes.string.isRequired}

//Set the rules for the datatype of prop passed per heading
Navbar.propTypes = {title: propTypes.string}

//Even if the title is required and not passed, if you set default it won't raise an error
Navbar.defaultProps = {title: "Title here"};