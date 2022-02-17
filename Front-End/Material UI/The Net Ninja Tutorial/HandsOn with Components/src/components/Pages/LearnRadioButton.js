import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';

export default function LearnRadioButton () {
	return (
		<div>

			{/*=============== Radio Button COMPONENT =================

				[Ref Site]: https://mui.com/components/radio-buttons/#main-content
				
				FormControl: Component to help wrap the form
				FormLabel: Add label to the form
				FormControlLabel: Helps in creation of radio buttons
				RadioGroup: Helps wrap radio buttons/FormControlLabel of similar category
				Radio: Radio button class.
			*/}

			<FormControl>
				<FormLabel>Radio Button Tutorial</FormLabel>

				{/*
					value: The value here will tell the group which button needs to be default selected or selected even if window reloaded
					onChange: Will trigger the function to executed after change in radio button options
				*/}

				<RadioGroup 
					onChange={((e) => {
							console.log(e.target.value+" selected")
						})
					}
				>
					<FormControlLabel value="maths" control={<Radio />} label="Maths"/>
					<FormControlLabel value="physics" control={<Radio />} label="Physics"/>
					<FormControlLabel value="chemistry" control={<Radio />} label="Chemistry"/>
				</RadioGroup>
			</FormControl>
		</div>
	)
}