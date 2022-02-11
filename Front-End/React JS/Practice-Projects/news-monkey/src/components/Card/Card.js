import {useState, useEffect} from 'react';
import axios from 'axios';
import './Card.css'

export default function Carousel () {

	//Setting a state where there fetched data from api will be stored
	const [article, setArticle] = useState('');

	//Helps in fetching the data
	useEffect(() => {

		const fetchData = async () => {
			try {
		        const response = await axios.get("https://newsapi.org/v2/top-headlines?sources=techcrunch&apiKey=a5044755b60f42678cb8b923e3fea9ad");
		        // console.log(response);
		        const data = response.data.articles;
		        // console.log(data);
		        setArticle(data);
		    } catch (error) {
		        console.error(error.message);
		    }
		}

		fetchData()
	},[]);

	// const image = article[0].urlToImage || "https://i.imgur.com/OLp0CsG.png"
	// const description = article[0].description || "Something interesting here"

	const image = "https://i.imgur.com/OLp0CsG.png"
	const description = "Something interesting here"

	return (
		<div>
			
			{/*
				article.map(currentArticle => (
					<div className="card" style={{width: "18rem"}}>
					  <img className="card-img-top" src={currentArticle.urlToImage} alt="Card cap" />
					  <div className="card-body">
					    <p className="card-text">{currentArticle.description}</p>
					  </div>
					</div>
				))
			*/}

		{
			<div className="card" style={{width: "18rem"}}>
			  <img className="card-img-top" src={image} alt="Card cap" />
			  <div className="card-body">
			    <p className="card-text">{description}</p>
			  </div>
			</div>
		}
		

		</div>
	)
}