import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';

//This section is used to give example of grid. This represents a class for components we need to add a grid layout to
import { styled } from '@mui/material/styles';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));
//section ends here

export default function LearnGridLayout () {
	return (
		<div>
			{/*=============== Grid Layout COMPONENT =================
	
				[Ref Site]: https://mui.com/components/grid/#main-content
				
				Column widths (xs) are integer values between 1 and 12; they apply at any breakpoint and indicate how many columns are occupied by the component.

				This sums up to 12 (xs={8} + xs={4}) so it will be in a single line
				<Grid item xs={8}>
					<Item>xs=8</Item>
				</Grid>

				<Grid item xs={4}>
					<Item>xs=4</Item>
				</Grid>

				xs={1-12} for larger screens
				sm={1-12} for small screens
				md={1-12} for medium screens
			*/}
			<h1>Grid Layout Tutorial</h1>

			<Grid container spacing={2}>

				{/*Divided into two uneven groups*/}
				<Grid item xs={8}>
					<Item>xs=8</Item>
				</Grid>

				<Grid item xs={4}>
					<Item>xs=4</Item>
				</Grid>

				<Grid item xs={4}>
					<Item>xs=4</Item>
				</Grid>

				<Grid item xs={8}>
					<Item>xs=8</Item>
				</Grid>

				{/*Divided into two even groups*/}
				<Grid item xs={6}>
					<Item>xs=6</Item>
				</Grid>

				<Grid item xs={6}>
					<Item>xs=6</Item>
				</Grid>

			</Grid>
		</div>
	)
}