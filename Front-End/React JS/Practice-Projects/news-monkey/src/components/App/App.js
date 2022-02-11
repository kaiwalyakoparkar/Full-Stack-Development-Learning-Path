import './App.css'
import Navbar from '../Navbar/Navbar.js'
import Card from '../Card/Card.js'
import ButtonSwitch from '../ButtonSwitch/ButtonSwitch.js'
//wrap entire application in state 
import StyleState from '../../context/styleState.js'

export default function App () {
	return (
	<div>

		<StyleState>
			<Navbar />
			<div className="card-component">
				<Card />
				<ButtonSwitch />
			</div>
		</StyleState>
		
	</div>
	);
};