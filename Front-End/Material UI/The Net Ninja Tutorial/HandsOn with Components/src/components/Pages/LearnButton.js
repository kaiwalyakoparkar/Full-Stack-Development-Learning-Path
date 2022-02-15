import {Button, ButtonGroup} from '@mui/material'

export default function LearnButton () {
	return (
		<div>
			{/*=============== Button COMPONENT =================

				[Ref Site]: https://mui.com/api/button/
							https://mui.com/components/buttons/#main-content

				<Button variant="text">Text</Button>
				<Button variant="outlined">Outlined</Button>
				<Button variant="contained" color="secondary">Click here</Button>
			*/}


			<Button 
				variant="contained" 
				color="secondary"
				onClick={()=> console.log('Clicked')}
				type="submit"
			>
				Submit
			</Button>

			<br />
			<br />
			{/*=============== ButtonGroup COMPONENT =================

				[Ref Site]: https://mui.com/api/button/
							https://mui.com/components/button-group/

			*/}
			<ButtonGroup variant="contained">
				<Button>One</Button>
				<Button>Two</Button>
				<Button>Three</Button>
			</ButtonGroup>
		</div>
	)
}