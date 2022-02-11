import './ButtonSwitch.css';
import ColorChange from '../ColorChange/ColorChange.js'
import {useContext} from 'react'
import styleContext from '../../context/styleContext'

export default function ButtonSwitch () {

	const currentColor = useContext(styleContext);

	return (
		<div className="button-container">
			
			<div className="btn-group btn-group-toggle" data-toggle="buttons">
				  <label className="btn btn-secondary active">
				    <input type="radio" name="options" id="red" autoComplete="off" onClick={() => {currentColor.update('red'); console.log('red')}}/> Red
				  </label>
				  <label className="btn btn-secondary">
				    <input type="radio" name="options" id="green" autoComplete="off" onClick={() => {currentColor.update('green'); console.log('green')}}/> Green
				  </label>
				  <label className="btn btn-secondary">
				    <input type="radio" name="options" id="blue" autoComplete="off" onClick={() => {currentColor.update('blue'); console.log('blue')}}/> Blue
				  </label>
			</div>

			<ColorChange />

		</div>	
	)
}