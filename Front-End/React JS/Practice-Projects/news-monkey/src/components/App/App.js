import './App.css'
import Navbar from '../Navbar/Navbar.js'
import Carousel from '../Carousel/Carousel.js'

export default function App () {
	return (
		<div>
			<Navbar />
			<div className="carousel">
				<Carousel />
			</div>
			<h1>Hello this is working</h1>
		</div>
	);
};