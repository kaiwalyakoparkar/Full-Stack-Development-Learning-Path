//Imported useState from react
import {useState} from 'react'
import propTypes from 'prop-types'

export default function TextForm(props) {

	const handleOnChange = (event) => {
		setText(event.target.value);
	}

	const handleOnUpClick = () => {
		const textToUppercase = text.toUpperCase();
		setText(textToUppercase);
	}

	//Using states text is original state and we can change it via setText method.
	const [text, setText] = useState('Enter your text here');

	// text = 'This is wrong way of setting the state. This will generate errors'
	// setText('This is the correct way of setting the state');

	return (
		<div>
			<div className="mb-3">
				  <h1>{props.heading}</h1>
				  <textarea className="form-control" value={text} onChange={handleOnChange} id="myBox" rows="8"></textarea>
			</div>
			<button className="btn btn-primary" onClick={handleOnUpClick}>Convert to Upper Case</button>
		</div>
	)
}

TextForm.propTypes = {heading: propTypes.string}
TextForm.defaultProps = {heading: "Enter your text"}