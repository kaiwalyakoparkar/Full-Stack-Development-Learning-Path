import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import MoreIcon from '@mui/icons-material/MoreVert';
import Avatar from '@mui/material/Avatar';

const drawerWidth = 240

const useStyle = makeStyles({
  colors: {
  	backgroundColor: '#1e1057',
  	color: '#ffffff'
  }
})

export default function NavBar () {

	const classes = useStyle()

	return (
		<div className={classes.colors}>
			<AppBar position="static">
				<Toolbar>

					<IconButton
			            size="large"
			            edge="start"
			            color="inherit"
			            aria-label="menu"
			            sx={{ mr: 2 }}
			        >
					    <MenuIcon />
		          	</IconButton>

		          	<Typography 
		          		variant="h6" 
		          		component="div" 
		          		sx={{ flexGrow: 1 }}
		          	>
			            Spotify
			        </Typography>

			        <IconButton
			            size="large"
			            edge="end"
			            color="inherit"
			            aria-label="menu"
			            sx={{ mr: 2 }}
			        >
					    <SearchIcon />

					</IconButton>

		          	<IconButton
			            size="large"
			            edge="end"
			            color="inherit"
			            aria-label="menu"
			            sx={{ mr: 2 }}
			        >
					    <MoreIcon />
		          	</IconButton>

		          	<Avatar
		          		alt="User Image"
		          		src="https://i.imgur.com/Weaqj9c.png"
		          	/>	
				</Toolbar>
			</AppBar>
		</div>
	)
}