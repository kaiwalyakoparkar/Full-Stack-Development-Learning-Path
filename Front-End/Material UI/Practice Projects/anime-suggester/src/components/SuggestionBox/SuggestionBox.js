import Typography from '@mui/material/Typography';
import AnimeCard from '../AnimeCard/AnimeCard.js'
import Grid from '@mui/material/Grid';
import { makeStyles } from '@mui/styles';
import IconButton from '@mui/material/IconButton';
import ScreenSearchDesktopRoundedIcon from '@mui/icons-material/ScreenSearchDesktopRounded';
import { useState, useEffect } from 'react';
import axios from 'axios';
import data from '../../dev-data/anime.json'

const useStyles = makeStyles({
  search: {
    '& svg': {
      fontSize: 75
    }
  },
});



export default function SuggestionBox () {

	const classes = useStyles();
	const [animeData, setAnimeData] = useState(data);
	const [next, setNext] = useState(0);

	const anime_img_1 = animeData.data[next].entry[0].images.jpg.image_url;
	const anime_title_1 =  animeData.data[next].entry[0].title;
	const anime_url_1 = animeData.data[next].entry[0].url;
	const anime_user_1 = animeData.data[next].user.username;

	const anime_img_2 = animeData.data[next].entry[1].images.jpg.image_url ;
	const anime_title_2 =  animeData.data[next].entry[1].title ;
	const anime_url_2 = animeData.data[next].entry[0].url;
	const anime_user_2 = animeData.data[next].user.username;

	const anime_content = animeData.data[next].content;
	// console.log(animeData.data[next].entry[0].images.jpg.image_url)

	return (
		<div>
			<Typography
				variant="h4"
				component="h4"
				mt={5}
				align="center"
				color="primary"
			>
				Your Anime Suggestion
			</Typography>


			<Typography
				variant="h6"
				component="h6"
				mt={5}
				align="center"
				color="secondary"
			>
				{/*Recommending you 2 relate animes*/}
				{anime_content}
			</Typography>

			<Grid 
				container 
				justifyContent="space-evenly"
				alignItems="center"
				mt={10}
			>

			  <Grid item xs={3}>
			    <AnimeCard 
			    	img = { anime_img_1 }
			    	title = { anime_title_1 }
			    	url = { anime_url_1 }
			    	user = { anime_user_1 }
			    />
			  </Grid>
			

			  <Grid >
			  	<IconButton 
			  		aria-label="New Suggestions" 
			  		color="primary"
			  		tooltip="Get New Suggestion"
			  		className={classes.search}
			  		onClick={() => {
			  			setNext(Math.floor(Math.random() * 10))
			  		}}
			  	>
			  		<ScreenSearchDesktopRoundedIcon />
			  	</IconButton>
			  </Grid>
			
			<Grid item xs={3}>
			    <AnimeCard 
			    	img={ anime_img_2 }
			    	title={ anime_title_2 }
			    	url={ anime_url_2 }
			    	user = { anime_user_2 }
			    />
			  </Grid>
			
			
			</Grid>
		</div>
	)
}