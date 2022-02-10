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

	

	return (
		<div>

			{/*
				article.map(currentArticle => (
					<div className="card" style={{width: "18rem"}}>
					  <img className="card-img-top" src={currentArticle.urlToImage} alt="Card image cap" />
					  <div className="card-body">
					    <p className="card-text">{currentArticle.description}</p>
					  </div>
					</div>
				))
			*/}

			
				<div class="container">
				  <div class="row">

				  	<div class="col">
					    <div className="card" style={{width: "18rem"}}>
						  <img className="card-img-top" src={article[0].urlToImage} alt="Card image cap" />
						  <div className="card-body">
						    <p className="card-text">{article[0].description}</p>
						  </div>
						</div>
					</div>

				    <div class="col">
					    <div className="card" style={{width: "18rem"}}>
						  <img className="card-img-top" src={article[1].urlToImage} alt="Card image cap" />
						  <div className="card-body">
						    <p className="card-text">{article[1].description}</p>
						  </div>
						</div>
					</div>

				    <div class="col">
					    <div className="card" style={{width: "18rem"}}>
						  <img className="card-img-top" src={article[2].urlToImage} alt="Card image cap" />
						  <div className="card-body">
						    <p className="card-text">{article[2].description}</p>
						  </div>
						</div>
					</div>

				    <div class="w-100"></div>

				    <div class="col">
					    <div className="card" style={{width: "18rem"}}>
						  <img className="card-img-top" src={article[3].urlToImage} alt="Card image cap" />
						  <div className="card-body">
						    <p className="card-text">{article[3].description}</p>
						  </div>
						</div>
					</div>

				    <div class="col">
					    <div className="card" style={{width: "18rem"}}>
						  <img className="card-img-top" src={article[4].urlToImage} alt="Card image cap" />
						  <div className="card-body">
						    <p className="card-text">{article[4].description}</p>
						  </div>
						</div>
					</div>

				    <div class="col">
					    <div className="card" style={{width: "18rem"}}>
						  <img className="card-img-top" src={article[5].urlToImage} alt="Card image cap" />
						  <div className="card-body">
						    <p className="card-text">{article[5].description}</p>
						  </div>
						</div>
					</div>

				  </div>
				</div>
		</div>
	)
}