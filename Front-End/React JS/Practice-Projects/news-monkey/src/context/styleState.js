import StyleContext from './styleContext.js'
import {useState} from 'react';

const StyleState = (props) => {

	const st1 = {
		"color":"red"
	}

	const [styleState, setStyleState] = useState(st1);

	const update = (passedColor) => {
		setStyleState({color: passedColor})
	}

	return (
		<StyleContext.Provider value={{styleState, update}}> 
			{props.children}
		</StyleContext.Provider>
	)
}

export default StyleState;