import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles'


const drawerWidth = 240

const useStyle = makeStyles({
	drawer: {
		width: drawerWidth
	},
	drawerPaper: {
		width: drawerWidth
	},
	//This will put the drawer and the page side by side instead of overlapping
	root: {
		display: 'flex'
	}
})

export default function LearnParmanentDrawer () {

	const classes = useStyle();

	return (
		<div className={classes.root}>
			{/*=============== Drawer COMPONENT =================

				[Ref Site]: https://mui.com/components/drawers/#main-content

				variant: Tells what is the type of the drawer
				anchor: Tells the position drawer should be placed (right, left, top, bottom)

			*/}
			<Drawer
				className={classes.drawer}
				variant="permanent"
				anchor="left"
				classes={{
					paper: classes.drawerPaper
				}}
			>
				<Typography variant="h5">
					Learning Parmanent Drawer
				</Typography>	
			</Drawer>
			<h1>This is Page</h1>
		</div>	
	)
}