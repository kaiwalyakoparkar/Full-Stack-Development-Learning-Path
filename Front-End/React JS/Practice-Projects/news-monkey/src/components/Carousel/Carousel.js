import {useState, useEffect} from 'react';
import CarouselsItem from '../CarouselItem/CarouselItem.js'

export default function Carousel () {

	const [article, setArticle] = useState(null);

	//Helps in fetching the data
	useEffect(async () => {
		const url = "https://newsapi.org/v2/top-headlines?sources=techcrunch&apiKey=a5044755b60f42678cb8b923e3fea9ad";
		const response = await fetch(url)
		const data = response.json();
		const item = data.articles[0];
		setArticle(item);
	});

	console.log(article);

	return (
		<div id="carouselExampleCaptions" className="carousel slide" data-bs-ride="carousel">
		  <div className="carousel-indicators">
		    <button type="button" data-bs-target="#carouselExampleCaptions" data-bs-slide-to="0" className="active" aria-current="true" aria-label="Slide 1"></button>
		    <button type="button" data-bs-target="#carouselExampleCaptions" data-bs-slide-to="1" aria-label="Slide 2"></button>
		    <button type="button" data-bs-target="#carouselExampleCaptions" data-bs-slide-to="2" aria-label="Slide 3"></button>
		  </div>
		  <div className="carousel-inner">

		  	{/*<div className="carousel-item ">
		      <img src={article.urlToImage} className="d-block w-100" alt="..." />
		      <div className="carousel-caption d-none d-md-block">
		        <h5>{article.title}</h5>
		        <p>{article.description}</p>
		      </div>
		    </div>*/}

		    <div className="carousel-item active">
		      <img src="https://i.imgur.com/RWOfVrd.png" className="d-block w-100" alt="..." />
		      <div className="carousel-caption d-none d-md-block">
		        <h5>First slide label</h5>
		        <p>Some representative placeholder content for the first slide.</p>
		      </div>
		    </div>

		    <div className="carousel-item">
		      <img src="https://i.imgur.com/RWOfVrd.png" className="d-block w-100" alt="..." />
		      <div className="carousel-caption d-none d-md-block">
		        <h5>Second slide label</h5>
		        <p>Some representative placeholder content for the second slide.</p>
		      </div>
		    </div>
			
		    <div className="carousel-item">
		      <img src="https://i.imgur.com/RWOfVrd.png" className="d-block w-100" alt="..." />
		      <div className="carousel-caption d-none d-md-block">
		        <h5>Third slide label</h5>
		        <p>Some representative placeholder content for the third slide.</p>
		      </div>
		    </div>
		    
		  </div>
		  <button className="carousel-control-prev" type="button" data-bs-target="#carouselExampleCaptions" data-bs-slide="prev">
		    <span className="carousel-control-prev-icon" aria-hidden="true"></span>
		    <span className="visually-hidden">Previous</span>
		  </button>
		  <button className="carousel-control-next" type="button" data-bs-target="#carouselExampleCaptions" data-bs-slide="next">
		    <span className="carousel-control-next-icon" aria-hidden="true"></span>
		    <span className="visually-hidden">Next</span>
		  </button>
		</div>
	)
}