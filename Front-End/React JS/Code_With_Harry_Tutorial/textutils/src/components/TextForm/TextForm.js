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

	const handleOnLowClick = () => {
		const textToLowercase = text.toLowerCase();
		setText(textToLowercase);
	}

	const handleClearText = () => {
		setText('');
	}

	const handleReverseClick = () => {
		const reversedText = text.split("").reverse().join("");
		setText(reversedText);
	}

	//Using states text is original state and we can change it via setText method.
	const [text, setText] = useState('');

	// text = 'This is wrong way of setting the state. This will generate errors'
	// setText('This is the correct way of setting the state');

	return (
		<div className="conainer">
			<div className="container">
				<div className="mb-3">
					  <h1>{props.heading}</h1>
					  <textarea className="form-control" value={text} onChange={handleOnChange} id="myBox" rows="8"></textarea>
				</div>
				<div className="container">
					<button className="btn btn-primary mx-3 my-2" onClick={handleOnUpClick}>Convert to Upper Case</button>
					<button className="btn btn-primary mx-3 my-2" onClick={handleOnLowClick}>Convert to Lower Case</button>
					<button className="btn btn-primary mx-3 my-2" onClick={handleClearText}>Clear text</button>
					<button className="btn btn-primary mx-3 my-2" onClick={handleReverseClick}>Reverse text</button>
				</div>
			</div>
			<div className="container my-3">
				<h1>Your text summary is:</h1>
				<p>{text.split(" ").length} words and {text.length} characters</p>
				<p>{0.008 * text.split(" ").length} minutes of read time</p>
				<h2>Preview:</h2>
				<p>{text}</p>
			</div>
		</div>
	)
}

TextForm.propTypes = {heading: propTypes.string}
TextForm.defaultProps = {heading: "Enter your text"}