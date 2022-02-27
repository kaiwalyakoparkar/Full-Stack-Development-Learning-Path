import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import MoreIcon from '@mui/icons-material/MoreVert';
import Avatar from '@mui/material/Avatar';
import Button from "@mui/material/Button";
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';

const drawerWidth = 240

const useStyle = makeStyles({
  colors: {
  	backgroundColor: '#201060',
  },
  toolbarButtons: {
    marginLeft: 'auto',
  }
})

export default function NavBar () {

	const classes = useStyle()

	return (
		<div className={classes.colors} >
			<Box sx={{ flexGrow: 1 }}>
				<AppBar position="static">
					<Toolbar>
				
							<Button variant="rounded" sx={ { borderRadius: 50 } } >
							  <ChevronLeftIcon />
							</Button>
							
							<Button variant="rounded" sx={ { borderRadius: 50 } } >
							  <ChevronRightIcon />
							</Button>

						<div className={classes.toolbarButtons}>

							<Button 
					        	variant="outlined"
					        	sx={ { borderRadius: 28 } }
					        >
							  Upgrade
							</Button>

				          	<Button
						        variant="circular"
						        size="small"
						        sx={ { borderRadius: 28 } }
						        startIcon={
						          <Avatar
						            src="https://i.imgur.com/Weaqj9c.png"
						          />
						        }
						    >
						        Kaiwalya Koparkar
						    </Button>

						</div>

					</Toolbar>
				</AppBar>
			</Box>
		</div>
	)
}