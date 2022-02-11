import './ColorChange.css'
import React, {useContext} from 'react';
import styleContext from '../../context/styleContext.js'

export default function ColorChange () {
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

			<p>{textColor.styleState.color}</p>
		</div>
	)
}