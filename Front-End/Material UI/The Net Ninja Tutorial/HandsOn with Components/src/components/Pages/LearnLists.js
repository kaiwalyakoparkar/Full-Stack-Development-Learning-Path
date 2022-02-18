import {useNavigate, useLocation} from 'react-router-dom'
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles'
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import SubjectOutlinedIcon from '@mui/icons-material/SubjectOutlined';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined'
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
	},
	active: {
		backgroud: '#f4f4f4'
	}
})


export default function LearnLists () {

	const classes = useStyle();
	const navigate = useNavigate();

	const menuItems = [
		{
			text: 'Card Component',
			icon: <SubjectOutlinedIcon color="secondary"/>,
			path: '/card'
		},
		{
			text: 'Button Component',
			icon: <AddCircleOutlinedIcon color="secondary" />,
			path: '/button'
		}
	]

	return (
		<div className={classes.root}>
			{/*=============== List COMPONENT =================

				[Ref Site]: https://mui.com/components/lists/#main-content

			*/}
			<Drawer
				className={classes.drawer}
				variant="permanent"
				anchor="left"
				classes={{paper: classes.drawerPaper}}
			>
				<div>
					<Typography variant="h5">
						Learning lists
					</Typography>	
				</div>

				<List>

					{menuItems.map(item => {
						return(
							<ListItem 
								button
								key={item.text}
								onClick={()=> navigate(item.path)}
							>
								<ListItemIcon>{item.icon}</ListItemIcon>
								<ListItemText primary={item.text}/>
							</ListItem>
						)
						
					})}

				</List>

			</Drawer>
			<h1>This is Page</h1>
		</div>	
	)
}