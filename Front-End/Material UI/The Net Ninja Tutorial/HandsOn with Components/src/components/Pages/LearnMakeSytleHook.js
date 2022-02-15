import AcUnitOutlinedIcon from '@mui/icons-material/AcUnitOutlined';
import {Button, Typography} from '@mui/material'
import SendIcon from '@mui/icons-material/Send';
import KeyboardArrowRightOutlinedIcon from '@mui/icons-material/KeyboardArrowRightOutlined';
import { makeStyles } from '@mui/styles'

//Implementing makeSytle hook
const useStyle = makeStyles({
	btn : {
		fontSize: 60,
		backgroundColor: 'violet',
		'&:hover': {
			backgroundColor: 'blue'
		}
	},
	title: {
		textDecoration: 'underline',
		marginBottom: 20
	}
});


export default function LearnMakeSytleHook () {
	
	//Invoking the hook
	const classes = useStyle()
	
	return (
		<div>
			{/*=============== makeStyle Hook COMPONENT =================

				[Ref Site]: https://mui.com/styles/api/#makestyles-styles-options-hook

			*/}

			<Typography
				className={classes.title}
				variant="h6"
				component="h2"
				gutterBottom
				color="textSecondary"
			>
				Learning makeStyle Hook Component
			</Typography>

			<Button 
				//Using it to apply styles to preferred button
				className={classes.btn}
				variant="contained" 
				color="secondary"
				onClick={()=> console.log('Clicked')}
				type="submit"
				endIcon={<KeyboardArrowRightOutlinedIcon />}
			>
				Submit
			</Button>

		</div>
	)
}