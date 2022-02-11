import StyleContext from './styleContext.js'
import {useState} from 'react';

const StyleState = (props) => {

	//Creating a default
	const st1 = {
		"color":"red"
	}

	//Creating a state to hold the default
	const [styleState, setStyleState] = useState(st1);

	//This will update the context
	const update = (passedColor) => {
		setStyleState({color: passedColor})
	}

	return (
		//Exporting both the state and the update function.
		<StyleContext.Provider value={{styleState, update}}> 
			{props.children}
		</StyleContext.Provider>
	)
}

export default StyleState;