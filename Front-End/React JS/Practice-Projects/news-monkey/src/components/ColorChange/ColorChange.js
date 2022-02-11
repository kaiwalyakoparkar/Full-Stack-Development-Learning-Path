import './ColorChange.css'
import React, {useContext} from 'react';
//Import the context
import styleContext from '../../context/styleContext.js'

export default function ColorChange () {
	//Consume the context
	const textColor = useContext(styleContext);
	return (

		<div className="color-container">
			{/*
				<div class="card" style="width: 18rem;">
				  <div class="card-body">
				    <h5 class="card-title">Special title treatment</h5>
				    <p class="card-text">With supporting text below as a natural lead-in to additional content.</p>
				    <a href="#" class="btn btn-primary">Go somewhere</a>
				  </div>
				</div>
			*/}

			{/*Using the context doing textColor.styleState.color because we passed value={{styleState, update}}*/}
			<p>{textColor.styleState.color}</p>
		</div>
	)
}