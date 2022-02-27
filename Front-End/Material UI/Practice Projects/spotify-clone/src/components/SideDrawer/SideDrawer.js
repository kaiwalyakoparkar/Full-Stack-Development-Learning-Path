import * as React from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import CssBaseline from '@mui/material/CssBaseline';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import ListItem from '@mui/material/ListItem';
import Button from "@mui/material/Button";
import Stack from '@mui/material/Stack';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import Navbar from '../NavBar/NavBar.js';
import { makeStyles } from '@mui/styles';
import logo from '../../data/images/Spotify_Logo.png'

const drawerWidth = 240

const useStyle = makeStyles({
  drawer: {
    width: drawerWidth
  },
  drawerPaper: {
    width: drawerWidth
  },
  root: {
    display: 'flex'
  },
  logo: {
    width: '11vw',
    height: '6vh',
    marginTop: '3vh',
    marginLeft: '3vw'
  }
})

export default function SideDrawer () {

  const classes = useStyle()

  return (
    <div >
        <Drawer
          variant="permanent"
          anchor="left"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
          className={classes.drawer}
          classes={{
            paper: classes.drawerPaper
          }}
        >

          <img src={logo} alt="Spotify logo" className={classes.logo}/>

          <Stack 
            direction="column"
            justifyContent="center"
            alignItems="flex-start"
            spacing={1}
            mt={3}
            ml={3}
          >
                <Button
                  size="large"
                  startIcon={
                    <HomeIcon />
                  }
                >
                  Home
                </Button>

                <Button
                  size="large"
                  startIcon={
                    <SearchIcon />
                  }
                >
                  Search
                </Button>

                <Button
                  size="large"
                  startIcon={
                    <QueueMusicIcon />
                  }
                >
                  Library
                </Button>
          </Stack>

          <List>
            {/*icon list here*/}
          </List>

        </Drawer>
    </div>
  );
}
