import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import MoreIcon from '@mui/icons-material/MoreVert';
import Avatar from '@mui/material/Avatar';
import { makeStyles } from '@mui/styles'


export default function LearnAppBar () {

	return (
		<div>
			{/*=============== App Bar COMPONENT =================

				[Ref Site]: https://mui.com/components/app-bar/#main-content

				AppBar: The top App Bar provides content and actions related to the current screen. It's used for branding, screen titles, navigation, and actions. It can transform into a contextual action bar or be used as a navbar.

			*/}
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
		          		align="center"
		          	>
			            App Bar Tutorial
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

			<h1>Hello</h1>

		</div>
	)
}