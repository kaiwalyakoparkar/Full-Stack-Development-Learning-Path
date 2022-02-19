import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

export default function LearnCard () {
	return (
		<div>
			{/*=============== Card COMPONENT =================

				[Ref Site]: https://mui.com/components/cards/#main-content

				CardHeader: Helps you add header content to the top of the card
				CardContent: Contains main body/paragraph text of the card
				CardMedia: Helps include photoes etc to the card
				CardAction: Helps add action components to the card (ideally at bottom)
			*/}

			<h1>Card Tutorial</h1>
			<Card>
				<CardHeader 
					title="This is title"
					subheader="Building a card"
				/>
				<CardMedia 
					component="img"
					alt="Card image"
					image="https://i.imgur.com/J5M2lUu.png"
					height="194"
				/>
				<CardContent>
					<Typography>
						This the a sample card I am trying to create while following the tutorial lets see how it goes
					</Typography>
				</CardContent>
				<CardActions>
			        <Button size="small">Share</Button>
			        <Button size="small">Learn More</Button>
			     </CardActions>
			</Card>	
		</div>
	)
}