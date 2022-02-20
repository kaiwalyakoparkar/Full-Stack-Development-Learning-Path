// import { useState, useEffect } from 'react';
// import axios from 'axios';
import Typography from '@mui/material/Typography';
import AnimeCard from '../AnimeCard/AnimeCard.js'
import Grid from '@mui/material/Grid';
import { makeStyles } from '@mui/styles';
import IconButton from '@mui/material/IconButton';
import ScreenSearchDesktopRoundedIcon from '@mui/icons-material/ScreenSearchDesktopRounded';

export default async function SuggestionBox () {
	const useStyles = makeStyles({
	  search: {
	    '& svg': {
	      fontSize: 75
	    }
	  },
	});

	const classes = useStyles();

	// const [animeData, setAnimeData] = useState('');

	// const response = (await axios.get("https://api.jikan.moe/v4/recommendations/anime"));
	// setAnimeData({response});
	// // console.log(response);
	// console.log(animeData);

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
				Hello this is non api
			</Typography>


			<Grid 
				container 
				justifyContent="space-evenly"
				alignItems="center"
				mt={10}
			>

			  <Grid item xs={3}>
			    <AnimeCard 
			    	img="https://cdn.myanimelist.net/images/anime/6/82898.jpg"
			    	title="3-gatsu no Lion"
			    />
			  </Grid>


			  <Grid >
			  	<IconButton 
			  		aria-label="New Suggestions" 
			  		color="primary"
			  		tooltip="Get New Suggestion"
			  		className={classes.search}
			  		onClick={() => {
			  			console.log('clicked')
			  		}}
			  	>
			  		<ScreenSearchDesktopRoundedIcon />
			  	</IconButton>
			  </Grid>


			  <Grid item xs={3}>
			    <AnimeCard 
			    	img="https://cdn.myanimelist.net/images/anime/3/88469.jpg"
			    	title="3-gatsu no Lion 2nd Season"
			    />
			  </Grid>

			</Grid>


		</div>
	)
}