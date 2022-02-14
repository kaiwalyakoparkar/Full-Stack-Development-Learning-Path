import * as React from 'react';
//importing the material UI library
import {Typography} from '@mui/material';

export default function Notes () {
	return (
		<div>
			{/*
				This is how you consume the Component with it's attributes
				
				[Ref Site]: https://mui.com/api/typography/
			

				<Typography 
					variant="h3" 
					component="h3" 
					gutterBottom
					color="primary"
					align="center"
				>
					All Notes
				</Typography>

	
				noWrap will truncate the sentence if it exceeds the frame window

				<Typography 
					color="secondary"
					noWrap
				>
					Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.
				</Typography>
			*/}

			<Typography
				variant="h6"
				component="h2"
			>
				See all Notes
			</Typography>
		</div>
	)
}