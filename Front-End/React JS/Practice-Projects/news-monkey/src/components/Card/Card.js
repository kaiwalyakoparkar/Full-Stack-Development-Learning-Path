import {useState, useEffect} from 'react';
import axios from 'axios';
import './Card.css'
// import CarouselsItem from '../CarouselItem/CarouselItem.js'

export default function Carousel () {

	//Setting a state where there fetched data from api will be stored
	const [article, setArticle] = useState('');

	//Helps in fetching the data
	useEffect(() => {

		const fetchData = async () => {
			try {
				// const url = "https://newsapi.org/v2/top-headlines?sources=techcrunch&apiKey=a5044755b60f42678cb8b923e3fea9ad";
		        const response = await axios.get("https://newsapi.org/v2/top-headlines?sources=techcrunch&apiKey=a5044755b60f42678cb8b923e3fea9ad");
		        // console.log(response);
		        const data = response.data.articles;
		        console.log(data);
		        setArticle(data);
		    } catch (error) {
		        console.error(error.message);
		    }
		}

		fetchData()
	},[]);

	

	return (
		<div>
			{/*
			<div className="card" style={{width: 18}}>
			  <img className="card-img-top" src={article.urltoImage} alt="Card image cap" />
			  <div className="card-body">
			    <p className="card-text">{article.description}</p>
			  </div>
			</div>
			*/}
			<div className="card" style={{width: "18rem"}}>
			  <img className="card-img-top" src="https://i.imgur.com/Y5Z8R0s.png" alt="Card image cap" />
			  <div className="card-body">
			    <p className="card-text">Something interesting would go here</p>
			  </div>
			</div>
		</div>
	)
}