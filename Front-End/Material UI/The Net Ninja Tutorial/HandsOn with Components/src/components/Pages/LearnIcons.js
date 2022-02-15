import AcUnitOutlinedIcon from '@mui/icons-material/AcUnitOutlined';
import {Button} from '@mui/material'
import SendIcon from '@mui/icons-material/Send';
import KeyboardArrowRightOutlinedIcon from '@mui/icons-material/KeyboardArrowRightOutlined';

export default function LearnIcons () {
	return (
		<div>
			{/*=============== Icons COMPONENT =================

				[Ref Site]: https://mui.com/components/material-icons/?theme=Outlined
							https://mui.com/components/icons/


				<AcUnitOutlinedIcon />
				<AcUnitOutlinedIcon color="secondary"/>
				<AcUnitOutlinedIcon color="secondary" fontSize="large"/>
				<AcUnitOutlinedIcon color="secondary" fontSize="small"/>
				<AcUnitOutlinedIcon color="action" fontSize="small"/>
				<AcUnitOutlinedIcon color="error" fontSize="small"/>
				<AcUnitOutlinedIcon color="disabled" fontSize="small"/>
			*/}

			<Button 
				variant="contained" 
				color="secondary"
				onClick={()=> console.log('Clicked')}
				type="submit"
				// startIcon={<SendIcon />}
				endIcon={<KeyboardArrowRightOutlinedIcon />}
			>
				Submit
			</Button>

		</div>
	)
}